import assert from "node:assert/strict";
import { test } from "node:test";
import { supplierPaymentFromRpc } from "./supabase.js";

const PAYMENT_ID = "7405f68d-65fb-459b-afa4-001d27555fea";
const ACTIVITY_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const RECORDED_AT = "2026-10-25T23:22:27.524035+00:00";
const HASH = "a".repeat(64);

function registeredPayment() {
  return {
    payment: {
      id: PAYMENT_ID,
      company_id: COMPANY_ID,
      supplier_name: "Taller Norte",
      country: "ES",
      amount_usd: 100,
      due_on: "2026-10-09",
      status: "pending",
      stellar_account: `G${"A".repeat(55)}`,
      funded_tx_hash: null,
      created_at: RECORDED_AT,
      metadata_sha256: HASH,
      escrow_contract_id: null,
      fund_tx_hash: null,
      release_tx_hash: null,
      funded_at: null,
    },
    activity: {
      id: ACTIVITY_ID,
      company_id: COMPANY_ID,
      supplier_payment_id: PAYMENT_ID,
      kind: "supplierPayment",
      counterparty: "Taller Norte",
      amount_usd: -100,
      from_country: "AR",
      to_country: "ES",
      occurred_at: RECORDED_AT,
    },
  };
}

test("the rpc payload becomes the created payment and keeps escrow fields off it", () => {
  const created = supplierPaymentFromRpc(registeredPayment());

  assert.equal(created.id, PAYMENT_ID);
  assert.equal(created.supplierName, "Taller Norte");
  assert.equal(created.stellarAccount, `G${"A".repeat(55)}`);
  assert.equal(created.country, "ES");
  assert.equal(created.amountUsd, 100);
  assert.equal(created.dueOn, "2026-10-09");
  assert.equal(created.status, "pending");
  assert.equal(created.fundedTxHash, null);
  assert.equal(created.metadataSha256, HASH);
  assert.deepEqual(created.activity, {
    id: ACTIVITY_ID,
    kind: "supplierPayment",
    counterparty: "Taller Norte",
    amount: -100,
    from: "AR",
    to: "ES",
    at: RECORDED_AT,
  });
  assert.equal(JSON.stringify(created).includes("escrow"), false);
  assert.deepEqual(supplierPaymentFromRpc(JSON.stringify(registeredPayment())), created);
});

test("a payment without its matching activity is rejected", () => {
  const unlinked = registeredPayment();
  unlinked.activity.supplier_payment_id = ACTIVITY_ID;
  const orphanAmount = registeredPayment();
  orphanAmount.activity.amount_usd = -1;

  assert.throws(() => supplierPaymentFromRpc(unlinked), /No se pudo registrar el pago/);
  assert.throws(() => supplierPaymentFromRpc(orphanAmount), /No se pudo registrar el pago/);
  assert.throws(() => supplierPaymentFromRpc(null), /No se pudo registrar el pago/);
});
