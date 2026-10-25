import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { BusinessDashboardFilters } from "@senda/shared";
import { createMemoryBusinessStore } from "./memory.js";
import { canonicalPaymentMetadata, ledgerMilestone } from "./payment-metadata.js";

const FILTERS: BusinessDashboardFilters = {
  region: "global",
  range: "12",
  categoryPeriod: "current",
};

const SEED_PAYMENT_IDS = [
  "pay-nube-austral",
  "pay-rios",
  "pay-pixel",
  "pay-pacifico",
  "pay-norte",
];

const NEW_PAYMENT = {
  supplierName: "Taller Norte",
  stellarAccount: `G${"A".repeat(55)}`,
  country: "AR" as const,
  amountUsd: 100,
  dueOn: "2026-11-01",
};

function canonicalDigest(detail: typeof NEW_PAYMENT): string {
  const canonical = `{"amountUsd":100,"country":"AR","dueOn":"2026-11-01","stellarAccount":"${detail.stellarAccount}","supplierName":"Taller Norte"}`;
  assert.equal(canonicalPaymentMetadata(detail), canonical);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

test("the seeded company cap is 50000", async () => {
  const store = createMemoryBusinessStore();
  const dashboard = await store.getDashboard(FILTERS);

  assert.equal(store.monthlyCapUsd(), 50000);
  assert.deepEqual(Object.keys(dashboard.company).sort(), ["countries", "name"]);
  assert.equal(dashboard.kpis.balance.value, 248420);
  assert.equal(dashboard.kpis.spend.value, 18290);
  assert.equal(dashboard.kpis.international.value, 72640);
  assert.deepEqual(dashboard.kpis.payable, { value: 10325, invoices: 5 });

  for (const id of SEED_PAYMENT_IDS) {
    const payment = store.readSupplierPayment(id);
    assert.equal(payment?.metadataSha256, null);
    assert.equal(payment?.fundTxHash, null);
    assert.equal(payment?.escrowContractId, null);
    assert.equal(payment?.releaseTxHash, null);
  }
});

test("a new payment stores a 64-hex sha256 and reads it back", async () => {
  const store = createMemoryBusinessStore();
  const expected = canonicalDigest(NEW_PAYMENT);
  const created = store.addSupplierPayment(NEW_PAYMENT);
  const stored = store.readSupplierPayment(created.id);
  const dashboard = await store.getDashboard(FILTERS);
  const listed = dashboard.upcomingPayments.find((payment) => payment.id === created.id);
  const milestone = ledgerMilestone(created.id);

  assert.match(created.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.equal(created.metadataSha256, expected);
  assert.equal(stored?.metadataSha256, expected);
  assert.equal(stored?.supplier, "Taller Norte");
  assert.equal(stored?.status, "pending");
  assert.equal(stored?.fundTxHash, null);
  assert.equal(listed?.supplier, "Taller Norte");
  assert.equal(listed && "metadataSha256" in listed, false);
  assert.equal(milestone.description, "Pago");
  assert.equal(milestone.engagementId, created.id);
  assert.equal(JSON.stringify(milestone).includes("Taller Norte"), false);
  assert.equal(dashboard.kpis.balance.value, 248420);
  assert.equal(dashboard.kpis.spend.value, 18290);
  assert.equal(dashboard.kpis.international.value, 72640);
});

test("a used nonce cannot be reused", () => {
  const store = createMemoryBusinessStore();
  const now = new Date("2026-10-25T12:00:00.000Z");
  const later = new Date("2026-10-25T12:05:00.000Z");
  const nonce = {
    nonce: "sep10-once",
    account: `G${"B".repeat(55)}`,
    expiresAt: "2026-10-25T12:15:00.000Z",
  };

  store.rememberNonce(nonce);
  assert.equal(store.nonceIsFree(nonce.nonce, now), true);
  assert.equal(store.consumeNonce(nonce.nonce, now), true);
  assert.equal(store.nonceIsFree(nonce.nonce, later), false);
  assert.equal(store.consumeNonce(nonce.nonce, later), false);
  assert.equal(store.consumeNonce("missing-nonce", now), false);
  assert.throws(() => store.rememberNonce(nonce), /ya existe/);
});
