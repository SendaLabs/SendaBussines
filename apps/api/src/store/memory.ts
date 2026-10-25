import { buildDashboard } from "../dashboard/project.js";
import { DEMO_BOOK } from "./seed.js";
import { supplierPaymentWrite } from "./supplier-payment-write.js";
import type {
  BusinessStore,
  CompanyBook,
  FundedSupplierPayment,
  NewSupplierPayment,
  Sep10Nonce,
  StoredSupplierPayment,
} from "./types.js";

export interface MemoryBusinessStore extends BusinessStore {
  monthlyCapUsd(): number;
  addSupplierPayment(input: NewSupplierPayment): StoredSupplierPayment;
  readSupplierPayment(id: string): StoredSupplierPayment | null;
  rememberNonce(nonce: Omit<Sep10Nonce, "usedAt">): void;
  consumeNonce(nonce: string, now: Date): boolean;
  nonceIsFree(nonce: string, now: Date): boolean;
}

function copyPayment(payment: StoredSupplierPayment): StoredSupplierPayment {
  return { ...payment };
}

/**
 * Check-and-set with no await between the read and the write, so two
 * overlapping calls in this process cannot both hold the payment.
 */
function claimFunding(state: CompanyBook, id: string): StoredSupplierPayment | null {
  const payment = state.payments.find((item) => item.id === id);
  if (!payment || payment.status !== "pending" || payment.fundingClaimedAt != null) {
    return null;
  }
  payment.fundingClaimedAt = new Date().toISOString();
  return copyPayment(payment);
}

function releaseFunding(state: CompanyBook, id: string): void {
  const payment = state.payments.find((item) => item.id === id);
  if (!payment || payment.status !== "pending" || payment.fundingClaimedAt == null) return;
  payment.fundingClaimedAt = null;
}

function heldPayment(state: CompanyBook, id: string): StoredSupplierPayment | null {
  const payment = state.payments.find((item) => item.id === id);
  if (!payment || payment.status !== "pending" || payment.fundingClaimedAt == null) return null;
  return payment;
}

/** Writes the contract id only while it is still null. Synchronous check-and-set. */
function persistDeployedEscrow(state: CompanyBook, id: string, escrowContractId: string): boolean {
  const payment = heldPayment(state, id);
  if (!payment) return false;
  if (payment.escrowContractId === escrowContractId) {
    payment.deployTxHash = null;
    return true;
  }
  if (payment.escrowContractId != null) return false;
  payment.escrowContractId = escrowContractId;
  payment.deployTxHash = null;
  return true;
}

function persistPendingHash(
  state: CompanyBook,
  id: string,
  kind: "deploy" | "fund",
  txHash: string,
): boolean {
  const payment = heldPayment(state, id);
  if (!payment) return false;
  if (kind === "deploy") {
    if (payment.escrowContractId != null) return false;
    if (payment.deployTxHash === txHash) return true;
    if (payment.deployTxHash != null) return false;
    payment.deployTxHash = txHash;
    return true;
  }
  if (payment.escrowContractId == null) return false;
  if (payment.pendingFundTxHash === txHash) return true;
  if (payment.pendingFundTxHash != null) return false;
  payment.pendingFundTxHash = txHash;
  return true;
}

function clearPendingHash(
  state: CompanyBook,
  id: string,
  kind: "deploy" | "fund",
  txHash: string,
): void {
  const payment = heldPayment(state, id);
  if (!payment) return;
  if (kind === "deploy") {
    if (payment.deployTxHash === txHash) payment.deployTxHash = null;
    return;
  }
  if (payment.pendingFundTxHash === txHash) payment.pendingFundTxHash = null;
}

function nonceRecordIsFree(nonces: Map<string, Sep10Nonce>, nonce: string, now: Date): boolean {
  const record = nonces.get(nonce);
  if (!record || record.usedAt !== null) return false;
  const expiresAt = Date.parse(record.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function createMemoryBusinessStore(book: CompanyBook = DEMO_BOOK): MemoryBusinessStore {
  const state = structuredClone(book);
  const nonces = new Map<string, Sep10Nonce>();

  function record(input: NewSupplierPayment) {
    const write = supplierPaymentWrite(input);
    state.payments.push({ ...write.payment });
    state.activity.push({ ...write.activity });
    return write;
  }

  return {
    async getDashboard(filters) {
      return buildDashboard(state, filters);
    },
    monthlyCapUsd() {
      return state.monthlyCapUsd;
    },
    addSupplierPayment(input) {
      return copyPayment(record(input).payment);
    },
    async createSupplierPayment(input) {
      return record(input).created;
    },
    readSupplierPayment(id) {
      const payment = state.payments.find((item) => item.id === id);
      return payment ? copyPayment(payment) : null;
    },
    async findSupplierPayment(id) {
      const payment = state.payments.find((item) => item.id === id);
      return payment ? copyPayment(payment) : null;
    },
    async supplierFundingSnapshot() {
      return {
        monthlyCapUsd: state.monthlyCapUsd,
        payments: state.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          fundTxHash: payment.fundTxHash,
          fundedAt: payment.fundedAt,
        })),
      };
    },
    async saveSupplierMetadata(id, metadataSha256) {
      const payment = state.payments.find((item) => item.id === id);
      if (!payment) throw new Error("No se pudo guardar el pago.");
      payment.metadataSha256 = metadataSha256;
    },
    claimSupplierFunding(id) {
      return Promise.resolve(claimFunding(state, id));
    },
    releaseSupplierFunding(id) {
      releaseFunding(state, id);
      return Promise.resolve();
    },
    saveDeployedEscrow(id, escrowContractId) {
      return Promise.resolve(persistDeployedEscrow(state, id, escrowContractId));
    },
    savePendingDeployTx(id, txHash) {
      return Promise.resolve(persistPendingHash(state, id, "deploy", txHash));
    },
    clearPendingDeployTx(id, txHash) {
      clearPendingHash(state, id, "deploy", txHash);
      return Promise.resolve();
    },
    savePendingFundTx(id, txHash) {
      return Promise.resolve(persistPendingHash(state, id, "fund", txHash));
    },
    clearPendingFundTx(id, txHash) {
      clearPendingHash(state, id, "fund", txHash);
      return Promise.resolve();
    },
    async markSupplierFunded(id, funded: FundedSupplierPayment) {
      const payment = heldPayment(state, id);
      if (!payment || payment.escrowContractId !== funded.escrowContractId) {
        throw new Error("No se pudo registrar el fondeo.");
      }
      payment.status = "approved";
      payment.fundTxHash = funded.fundTxHash;
      payment.fundedAt = funded.fundedAt;
      payment.fundingClaimedAt = null;
      payment.deployTxHash = null;
      payment.pendingFundTxHash = null;
    },
    rememberNonce(nonce) {
      if (nonce.nonce.length === 0) {
        throw new Error("El nonce no puede estar vacío.");
      }
      if (nonces.has(nonce.nonce)) {
        throw new Error("Ese nonce ya existe.");
      }
      nonces.set(nonce.nonce, { ...nonce, usedAt: null });
    },
    consumeNonce(nonce, now) {
      if (!nonceRecordIsFree(nonces, nonce, now)) return false;
      const record = nonces.get(nonce);
      if (!record) return false;
      record.usedAt = now.toISOString();
      return true;
    },
    nonceIsFree(nonce, now) {
      return nonceRecordIsFree(nonces, nonce, now);
    },
  };
}
