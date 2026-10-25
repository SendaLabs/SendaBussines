import assert from "node:assert/strict";
import { test } from "node:test";
import { companyBookFromRow } from "./supabase-map.js";

test("supabase rows map onto the book without keeping database column names", () => {
  const book = companyBookFromRow({
    name: "Empresa Demo S.R.L.",
    country_count: 4,
    monthly_cap_usd: 50000,
    panel_faces: {
      first_name: "Delfina",
      full_name: "Delfina Corradini",
      avatar_path: "/images/P_Delfina.svg",
    },
    kpi_snapshots: [
      {
        balance_usd: 248420,
        balance_change: "0.084",
        spend_usd: 18290,
        spend_change: "-0.042",
        international_usd: 72640,
        international_payments: 24,
        period_from: "2026-10-01",
        period_to: "2026-10-31",
      },
    ],
    supplier_payments: [
      {
        id: "pay-1",
        supplier_name: "Nube Austral Hosting",
        country: "US",
        amount_usd: 1240,
        due_on: "2026-10-07",
        status: "pending",
        stellar_account: null,
        funded_tx_hash: null,
        metadata_sha256: "0123456789abcdef".repeat(4),
        escrow_contract_id: null,
        fund_tx_hash: null,
        release_tx_hash: null,
      },
    ],
    activity_entries: [
      {
        id: "act-1",
        kind: "cardSpend",
        counterparty: "Nube Austral Hosting",
        amount_usd: -86,
        from_country: "AR",
        to_country: "US",
        occurred_at: "2026-10-05T18:40:00-03:00",
      },
    ],
    cashflow_points: [{ month: "2026-05-01", income_usd: 51000, expenses_usd: 33000 }],
    category_slices: [
      { period: "current", month: "2026-10-01", slice_key: "software", amount_usd: 5120 },
      { period: "previous", month: "2026-09-01", slice_key: "services", amount_usd: 4300 },
    ],
    card_snapshots: { last4: "4821", currency: "USD", active_count: 3, total_count: 10 },
    country_volumes: [{ country: "US", amount_usd: "51000" }],
  });

  assert.equal(book.monthlyCapUsd, 50000);
  assert.equal(book.payments[0]?.metadataSha256, "0123456789abcdef".repeat(4));
  assert.equal(book.payments[0]?.escrowContractId, null);
  assert.equal(book.payments[0]?.fundTxHash, null);
  assert.equal(book.payments[0]?.releaseTxHash, null);
  assert.equal(book.user.avatar, "/images/P_Delfina.svg");
  assert.equal(book.balance.change, 0.084);
  assert.equal(book.spend.change, -0.042);
  assert.equal(book.payments[0]?.dueDate, "2026-10-07");
  assert.equal(book.payments[0]?.stellarAccount, null);
  assert.equal(book.payments[0]?.fundedTxHash, null);
  assert.equal(book.activity[0]?.amount, -86);
  assert.equal(book.cashFlow[0]?.month, "2026-05");
  assert.equal(book.categories.current.month, "2026-10");
  assert.equal(book.categories.previous.slices[0]?.key, "services");
  assert.equal(book.cards.active, 3);
  assert.equal(book.countryVolumes[0]?.amount, 51000);
});
