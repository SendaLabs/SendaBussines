import { createHash } from "node:crypto";
import type { NewSupplierPayment } from "./types.js";

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Private book detail. This JSON is hashed locally and is not a ledger payload. */
export function canonicalPaymentMetadata(detail: NewSupplierPayment): string {
  return JSON.stringify({
    amountUsd: detail.amountUsd,
    country: detail.country,
    dueOn: detail.dueOn,
    stellarAccount: detail.stellarAccount,
    supplierName: detail.supplierName,
  });
}

export function paymentMetadataSha256(detail: NewSupplierPayment): string {
  const digest = createHash("sha256").update(canonicalPaymentMetadata(detail), "utf8").digest("hex");
  if (!SHA256_HEX.test(digest)) {
    throw new Error("El sha256 del pago no tiene 64 hex.");
  }
  return digest;
}

/** What a later ledger milestone may carry: an opaque id and the word Pago. */
export function ledgerMilestone(engagementId: string): { description: "Pago"; engagementId: string } {
  return { description: "Pago", engagementId };
}
