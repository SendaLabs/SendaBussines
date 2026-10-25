import { randomUUID } from "node:crypto";
import { buildDashboard } from "../dashboard/project.js";
import { paymentMetadataSha256 } from "./payment-metadata.js";
import { DEMO_BOOK } from "./seed.js";
import type {
  BusinessStore,
  CompanyBook,
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

function nonceRecordIsFree(nonces: Map<string, Sep10Nonce>, nonce: string, now: Date): boolean {
  const record = nonces.get(nonce);
  if (!record || record.usedAt !== null) return false;
  const expiresAt = Date.parse(record.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function createMemoryBusinessStore(book: CompanyBook = DEMO_BOOK): MemoryBusinessStore {
  const state = structuredClone(book);
  const nonces = new Map<string, Sep10Nonce>();

  return {
    async getDashboard(filters) {
      return buildDashboard(state, filters);
    },
    monthlyCapUsd() {
      return state.monthlyCapUsd;
    },
    addSupplierPayment(input) {
      const metadataSha256 = paymentMetadataSha256(input);
      const payment: StoredSupplierPayment = {
        id: randomUUID(),
        supplier: input.supplierName,
        country: input.country,
        amount: input.amountUsd,
        dueDate: input.dueOn,
        status: "pending",
        stellarAccount: input.stellarAccount,
        fundedTxHash: null,
        metadataSha256,
        escrowContractId: null,
        fundTxHash: null,
        releaseTxHash: null,
      };
      state.payments.push(payment);
      return copyPayment(payment);
    },
    readSupplierPayment(id) {
      const payment = state.payments.find((item) => item.id === id);
      return payment ? copyPayment(payment) : null;
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
