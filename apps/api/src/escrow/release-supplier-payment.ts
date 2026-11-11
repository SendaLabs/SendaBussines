import type { ApiErrorBody } from "@senda/shared";
import type { BusinessStore } from "../store/types.js";
import type { EscrowRecord, ReleaseEscrowInput } from "./client.js";
import { EscrowClientError, RELEASE_FAILED } from "./errors.js";

export interface EscrowReleaseClient {
  approveAndRelease(input: ReleaseEscrowInput): Promise<EscrowRecord>;
}

export interface ReleasedMilestoneResponse {
  id: string;
  status: "released";
  releaseTxHash: string;
}

export type ReleaseSupplierMilestoneResult = {
  statusCode: number;
  body: ReleasedMilestoneResponse | ApiErrorBody;
};

const NOT_FOUND = "No encontramos ese pago.";
const NO_DEPOSIT = "Este pago no tiene un depósito para liberar.";
const ALREADY_RELEASED = "Este hito ya fue liberado.";
const IN_PROGRESS = "Ese hito ya se está liberando.";

export async function releaseSupplierMilestone(input: {
  paymentId: string;
  store: BusinessStore;
  escrow: EscrowReleaseClient;
}): Promise<ReleaseSupplierMilestoneResult> {
  const payment = await input.store.findSupplierPayment(input.paymentId);
  if (!payment) return fail(404, NOT_FOUND);

  const contractId = payment.escrowContractId?.trim() ?? "";
  const existingRelease = payment.releaseTxHash?.trim() ?? "";
  if (existingRelease.length > 0 || payment.status === "released") {
    return fail(409, ALREADY_RELEASED);
  }
  if (payment.status !== "approved" || contractId.length === 0) {
    return fail(409, NO_DEPOSIT);
  }

  const claimed = await input.store.claimSupplierRelease(payment.id);
  if (!claimed) return releaseConflict(input.store, payment.id);

  let recorded = false;
  try {
    const released = await input.escrow.approveAndRelease({
      engagementId: payment.id,
      contractId,
      milestoneIndexes: [0],
    });
    const releaseTxHash = released.releaseTxHash?.trim() ?? "";
    if (released.released !== true || releaseTxHash.length === 0) {
      return fail(502, RELEASE_FAILED);
    }

    await input.store.markSupplierReleased(payment.id, { releaseTxHash });
    recorded = true;
    return {
      statusCode: 200,
      body: {
        id: payment.id,
        status: "released",
        releaseTxHash,
      },
    };
  } catch (error) {
    const clientError = failureFromClient(error);
    if (clientError) return clientError;
    throw error;
  } finally {
    if (!recorded) await input.store.clearSupplierRelease(payment.id);
  }
}

async function releaseConflict(
  store: BusinessStore,
  paymentId: string,
): Promise<ReleaseSupplierMilestoneResult> {
  const current = await store.findSupplierPayment(paymentId);
  if (!current) return fail(404, NOT_FOUND);
  const existingRelease = current.releaseTxHash?.trim() ?? "";
  if (existingRelease.length > 0 || current.status === "released") {
    return fail(409, ALREADY_RELEASED);
  }
  if (current.status !== "approved" || (current.escrowContractId?.trim() ?? "").length === 0) {
    return fail(409, NO_DEPOSIT);
  }
  return fail(409, IN_PROGRESS);
}

function fail(statusCode: number, error: string): ReleaseSupplierMilestoneResult {
  return { statusCode, body: { error } };
}

function failureFromClient(error: unknown): ReleaseSupplierMilestoneResult | null {
  if (!(error instanceof EscrowClientError)) return null;
  const statusCode = error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 502;
  return { statusCode, body: error.body };
}
