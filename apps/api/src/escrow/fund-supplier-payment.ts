import { SUPPLIER_PAYMENT_ERRORS, type ApiErrorBody } from "@senda/shared";
import { paymentMetadataSha256 } from "../store/payment-metadata.js";
import type { BusinessStore, StoredSupplierPayment } from "../store/types.js";
import type { DeployEscrowInput, EscrowRecord, FundEscrowInput } from "./client.js";
import { DEPLOY_FAILED, EscrowClientError, FUND_FAILED } from "./errors.js";
import { exceedsMonthlyCap, fundedUsdInUtcMonth, MONTHLY_CAP_EXCEEDED } from "./monthly-cap.js";

export interface EscrowFundClient {
  deploy(input: DeployEscrowInput): Promise<EscrowRecord>;
  fund(input: FundEscrowInput): Promise<EscrowRecord>;
}

export interface FundedEscrowResponse {
  id: string;
  status: "approved";
  escrowContractId: string;
  fundTxHash: string;
}

export type FundSupplierPaymentResult = {
  statusCode: number;
  body: FundedEscrowResponse | ApiErrorBody;
};

const NOT_FOUND = "No encontramos ese pago.";
const NOT_PENDING = "El pago no está pendiente.";
const MISSING_ACCOUNT = "El pago no tiene una cuenta Stellar.";

export async function fundSupplierPayment(input: {
  paymentId: string;
  treasuryAccount: string;
  store: BusinessStore;
  escrow: EscrowFundClient;
  now?: Date;
}): Promise<FundSupplierPaymentResult> {
  const now = input.now ?? new Date();
  const payment = await input.store.findSupplierPayment(input.paymentId);
  if (!payment) return fail(404, NOT_FOUND);
  if (payment.status !== "pending") return fail(409, NOT_PENDING);

  const receiver = payment.stellarAccount?.trim() ?? "";
  if (receiver.length === 0) return fail(409, MISSING_ACCOUNT);
  if (receiver === input.treasuryAccount.trim()) {
    return fail(409, SUPPLIER_PAYMENT_ERRORS.treasury);
  }

  const snapshot = await input.store.supplierFundingSnapshot();
  const fundedUsd = fundedUsdInUtcMonth(snapshot.payments, now);
  if (exceedsMonthlyCap(fundedUsd, payment.amount, snapshot.monthlyCapUsd)) {
    return fail(409, MONTHLY_CAP_EXCEEDED);
  }

  if (payment.metadataSha256 == null) {
    await input.store.saveSupplierMetadata(payment.id, paymentMetadataSha256(metadataOf(payment, receiver)));
  }

  try {
    const contractId = await deployedContractId(input, payment, receiver);
    if (!contractId) return fail(502, DEPLOY_FAILED);

    const funded = await input.escrow.fund({
      engagementId: payment.id,
      contractId,
      amount: payment.amount,
    });
    if (!funded.funded || !funded.fundTxHash) return fail(502, FUND_FAILED);

    const escrowContractId = funded.contractId ?? contractId;
    await input.store.markSupplierFunded(payment.id, {
      escrowContractId,
      fundTxHash: funded.fundTxHash,
      fundedAt: now.toISOString(),
    });
    return {
      statusCode: 200,
      body: {
        id: payment.id,
        status: "approved",
        escrowContractId,
        fundTxHash: funded.fundTxHash,
      },
    };
  } catch (error) {
    const clientError = failureFromClient(error);
    if (clientError) return clientError;
    throw error;
  }
}

async function deployedContractId(
  input: { store: BusinessStore; escrow: EscrowFundClient },
  payment: StoredSupplierPayment,
  receiver: string,
): Promise<string | null> {
  const existing = payment.escrowContractId?.trim() ?? "";
  if (existing.length > 0) return existing;

  const deployed = await input.escrow.deploy({
    engagementId: payment.id,
    amount: payment.amount,
    receiver,
  });
  if (!deployed.contractId) return null;
  await input.store.saveDeployedEscrow(payment.id, deployed.contractId);
  return deployed.contractId;
}

function metadataOf(payment: StoredSupplierPayment, receiver: string) {
  return {
    supplierName: payment.supplier,
    stellarAccount: receiver,
    country: payment.country,
    amountUsd: payment.amount,
    dueOn: payment.dueDate,
  };
}

function fail(statusCode: number, error: string): FundSupplierPaymentResult {
  return { statusCode, body: { error } };
}

function failureFromClient(error: unknown): FundSupplierPaymentResult | null {
  if (!(error instanceof EscrowClientError)) return null;
  const statusCode = error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 502;
  return { statusCode, body: error.body };
}
