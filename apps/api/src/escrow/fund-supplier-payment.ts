import { SUPPLIER_PAYMENT_ERRORS, type ApiErrorBody } from "@senda/shared";
import { paymentMetadataSha256 } from "../store/payment-metadata.js";
import type { BusinessStore, StoredSupplierPayment } from "../store/types.js";
import type { DeployEscrowInput, EscrowRecord, FundEscrowInput } from "./client.js";
import { DEPLOY_FAILED, EscrowClientError, FUND_FAILED } from "./errors.js";
import { exceedsMonthlyCap, fundedUsdInUtcMonth, MONTHLY_CAP_EXCEEDED } from "./monthly-cap.js";

export interface EscrowFundClient {
  deploy(input: DeployEscrowInput): Promise<EscrowRecord>;
  fund(input: FundEscrowInput): Promise<EscrowRecord>;
  /** Re-read a deploy transaction. Does not submit another deploy. */
  readDeploy(txHash: string): Promise<EscrowRecord>;
  /** Re-read a fund transaction. Does not submit another fund. */
  readFund(txHash: string): Promise<EscrowRecord>;
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
const IN_PROGRESS = "Ese pago ya se está depositando.";
const MISSING_ACCOUNT = "El pago no tiene una cuenta Stellar.";

type Step<T extends Record<string, string>> =
  | ({ ok: true } & T)
  | { ok: false; statusCode: number; error: string };

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

  const receiver = text(payment.stellarAccount);
  if (receiver.length === 0) return fail(409, MISSING_ACCOUNT);
  if (receiver === input.treasuryAccount.trim()) {
    return fail(409, SUPPLIER_PAYMENT_ERRORS.treasury);
  }

  const settling =
    (text(payment.deployTxHash).length > 0 && text(payment.escrowContractId).length === 0) ||
    text(payment.pendingFundTxHash).length > 0;
  if (!settling && (await capExceeded(input.store, payment.amount, now))) {
    return fail(409, MONTHLY_CAP_EXCEEDED);
  }

  if (payment.metadataSha256 == null) {
    await input.store.saveSupplierMetadata(payment.id, paymentMetadataSha256(metadataOf(payment, receiver)));
  }

  const claimed = await input.store.claimSupplierFunding(payment.id);
  if (!claimed) return fail(409, IN_PROGRESS);

  let recorded = false;
  try {
    const result = await fundClaimed(input, claimed, receiver, now);
    recorded = result.statusCode === 200;
    return result;
  } catch (error) {
    const clientError = failureFromClient(error);
    if (clientError) return clientError;
    throw error;
  } finally {
    if (!recorded) await input.store.releaseSupplierFunding(payment.id);
  }
}

async function fundClaimed(
  input: {
    store: BusinessStore;
    escrow: EscrowFundClient;
  },
  payment: StoredSupplierPayment,
  receiver: string,
  now: Date,
): Promise<FundSupplierPaymentResult> {
  const contract = await resolveContract(input, payment, receiver, now);
  if (!contract.ok) return fail(contract.statusCode, contract.error);

  const funded = await resolveFund(input, payment, contract.contractId, now);
  if (!funded.ok) return fail(funded.statusCode, funded.error);

  await input.store.markSupplierFunded(payment.id, {
    escrowContractId: funded.contractId,
    fundTxHash: funded.fundTxHash,
    fundedAt: now.toISOString(),
  });
  return {
    statusCode: 200,
    body: {
      id: payment.id,
      status: "approved",
      escrowContractId: funded.contractId,
      fundTxHash: funded.fundTxHash,
    },
  };
}

async function resolveContract(
  input: { store: BusinessStore; escrow: EscrowFundClient },
  payment: StoredSupplierPayment,
  receiver: string,
  now: Date,
): Promise<Step<{ contractId: string }>> {
  const existing = text(payment.escrowContractId);
  if (existing.length > 0) return { ok: true, contractId: existing };

  const pendingDeploy = text(payment.deployTxHash);
  if (pendingDeploy.length > 0) {
    const settled = await input.escrow.readDeploy(pendingDeploy);
    const recovered = text(settled.contractId);
    if (recovered.length > 0) {
      return savedContract(input.store, payment.id, recovered);
    }
    if (settled.indexerLagging) return { ok: false, statusCode: 502, error: DEPLOY_FAILED };
    await input.store.clearPendingDeployTx(payment.id, pendingDeploy);
  }

  if (await capExceeded(input.store, payment.amount, now)) {
    return { ok: false, statusCode: 409, error: MONTHLY_CAP_EXCEEDED };
  }

  const deployed = await input.escrow.deploy({
    engagementId: payment.id,
    amount: payment.amount,
    receiver,
  });
  const contractId = text(deployed.contractId);
  const txHash = text(deployed.txHash);
  if (contractId.length === 0) {
    if (txHash.length > 0) await input.store.savePendingDeployTx(payment.id, txHash);
    return { ok: false, statusCode: 502, error: DEPLOY_FAILED };
  }

  if (txHash.length > 0) {
    const noted = await input.store.savePendingDeployTx(payment.id, txHash);
    if (!noted) return { ok: false, statusCode: 502, error: DEPLOY_FAILED };
  }
  return savedContract(input.store, payment.id, contractId);
}

async function resolveFund(
  input: { store: BusinessStore; escrow: EscrowFundClient },
  payment: StoredSupplierPayment,
  contractId: string,
  now: Date,
): Promise<Step<{ contractId: string; fundTxHash: string }>> {
  const pendingFund = text(payment.pendingFundTxHash);
  if (pendingFund.length > 0) {
    const settled = await input.escrow.readFund(pendingFund);
    if (settled.funded && text(settled.fundTxHash).length > 0) {
      return {
        ok: true,
        fundTxHash: text(settled.fundTxHash),
        contractId: text(settled.contractId) || contractId,
      };
    }
    if (settled.indexerLagging) return { ok: false, statusCode: 502, error: FUND_FAILED };
    await input.store.clearPendingFundTx(payment.id, pendingFund);
  }

  if (await capExceeded(input.store, payment.amount, now)) {
    return { ok: false, statusCode: 409, error: MONTHLY_CAP_EXCEEDED };
  }

  const funded = await input.escrow.fund({
    engagementId: payment.id,
    contractId,
    amount: payment.amount,
  });
  if (funded.funded && text(funded.fundTxHash).length > 0) {
    const fundTxHash = text(funded.fundTxHash);
    const noted = await input.store.savePendingFundTx(payment.id, fundTxHash);
    if (!noted) return { ok: false, statusCode: 502, error: FUND_FAILED };
    return {
      ok: true,
      fundTxHash,
      contractId: text(funded.contractId) || contractId,
    };
  }

  const txHash = text(funded.txHash);
  if (txHash.length > 0) await input.store.savePendingFundTx(payment.id, txHash);
  return { ok: false, statusCode: 502, error: FUND_FAILED };
}

async function savedContract(
  store: BusinessStore,
  paymentId: string,
  contractId: string,
): Promise<Step<{ contractId: string }>> {
  const saved = await store.saveDeployedEscrow(paymentId, contractId);
  if (saved) return { ok: true, contractId };
  const current = await store.findSupplierPayment(paymentId);
  const kept = text(current?.escrowContractId);
  if (kept.length > 0) return { ok: true, contractId: kept };
  return { ok: false, statusCode: 502, error: DEPLOY_FAILED };
}

async function capExceeded(store: BusinessStore, amount: number, now: Date): Promise<boolean> {
  const snapshot = await store.supplierFundingSnapshot();
  return exceedsMonthlyCap(fundedUsdInUtcMonth(snapshot.payments, now), amount, snapshot.monthlyCapUsd);
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

function text(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function fail(statusCode: number, error: string): FundSupplierPaymentResult {
  return { statusCode, body: { error } };
}

function failureFromClient(error: unknown): FundSupplierPaymentResult | null {
  if (!(error instanceof EscrowClientError)) return null;
  const statusCode = error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 502;
  return { statusCode, body: error.body };
}
