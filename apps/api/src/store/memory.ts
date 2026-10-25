import { buildDashboard } from "../dashboard/project.js";
import { DEMO_BOOK } from "./seed.js";
import { supplierPaymentWrite } from "./supplier-payment-write.js";
import type {
  BusinessStore,
  CompanyBook,
  FundedSupplierPayment,
  NewSupplierPayment,
  ReleasedSupplierPayment,
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
    async saveDeployedEscrow(id, escrowContractId) {
      const payment = state.payments.find((item) => item.id === id);
      if (!payment || payment.status !== "pending") {
        throw new Error("No se pudo guardar el depósito.");
      }
      payment.escrowContractId = escrowContractId;
    },
    async markSupplierFunded(id, funded: FundedSupplierPayment) {
      const payment = state.payments.find((item) => item.id === id);
      if (!payment || payment.status !== "pending") {
        throw new Error("No se pudo registrar el fondeo.");
      }
      payment.status = "approved";
      payment.escrowContractId = funded.escrowContractId;
      payment.fundTxHash = funded.fundTxHash;
      payment.fundedAt = funded.fundedAt;
    },
    async markSupplierReleased(id, released: ReleasedSupplierPayment) {
      const payment = state.payments.find((item) => item.id === id);
      const contractId = payment?.escrowContractId?.trim() ?? "";
      const existingRelease = payment?.releaseTxHash?.trim() ?? "";
      if (
        !payment ||
        payment.status !== "approved" ||
        contractId.length === 0 ||
        existingRelease.length > 0
      ) {
        throw new Error("No se pudo registrar la liberación.");
      }
      payment.status = "released";
      payment.releaseTxHash = released.releaseTxHash;
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
