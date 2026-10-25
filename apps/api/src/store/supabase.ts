import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { buildDashboard } from "../dashboard/project.js";
import { supplierPaymentWrite } from "./supplier-payment-write.js";
import { companyBookFromRow } from "./supabase-map.js";
import type { BusinessStore, NewSupplierPayment } from "./types.js";

const COMPANY_COLUMNS = `
  name,
  country_count,
  monthly_cap_usd,
  panel_faces (first_name, full_name, avatar_path),
  kpi_snapshots (
    balance_usd,
    balance_change,
    spend_usd,
    spend_change,
    international_usd,
    international_payments,
    period_from,
    period_to
  ),
  supplier_payments (
    id,
    supplier_name,
    country,
    amount_usd,
    due_on,
    status,
    stellar_account,
    funded_tx_hash,
    metadata_sha256,
    escrow_contract_id,
    fund_tx_hash,
    release_tx_hash
  ),
  activity_entries (
    id,
    kind,
    counterparty,
    amount_usd,
    from_country,
    to_country,
    occurred_at
  ),
  cashflow_points (month, income_usd, expenses_usd),
  category_slices (period, month, slice_key, amount_usd),
  card_snapshots (last4, currency, active_count, total_count),
  country_volumes (country, amount_usd)
`;

export function createSupabaseBusinessStore(
  env: Pick<Env, "SUPABASE_URL" | "SUPABASE_SECRET_KEY">,
): BusinessStore {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return {
    async getDashboard(filters) {
      const { data, error } = await client.from("companies").select(COMPANY_COLUMNS);
      if (error) {
        throw new Error(`No se pudo leer el libro: ${error.message}`);
      }
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error("Se esperaba una empresa en el libro.");
      }
      const row: unknown = data[0];
      if (row == null) throw new Error("Se esperaba una empresa en el libro.");
      return buildDashboard(companyBookFromRow(row), filters);
    },
    async createSupplierPayment(input) {
      return insertSupplierPayment(client, input);
    },
  };
}

async function insertSupplierPayment(
  client: SupabaseClient,
  input: NewSupplierPayment,
) {
  const write = supplierPaymentWrite(input);
  const companyId = await companyIdOf(client);
  const { error: paymentError } = await client.from("supplier_payments").insert({
    id: write.payment.id,
    company_id: companyId,
    supplier_name: input.supplierName,
    country: input.country,
    amount_usd: input.amountUsd,
    due_on: input.dueOn,
    status: "pending",
    stellar_account: input.stellarAccount,
    funded_tx_hash: null,
    metadata_sha256: write.payment.metadataSha256,
    escrow_contract_id: null,
    fund_tx_hash: null,
    release_tx_hash: null,
    created_at: write.activity.at,
  });
  if (paymentError) {
    throw new Error("No se pudo registrar el pago.", { cause: paymentError.code });
  }

  const { error: activityError } = await client.from("activity_entries").insert({
    id: write.activity.id,
    company_id: companyId,
    supplier_payment_id: write.payment.id,
    kind: "supplierPayment",
    counterparty: input.supplierName,
    amount_usd: write.activity.amount,
    from_country: "AR",
    to_country: input.country,
    occurred_at: write.activity.at,
  });
  if (activityError) {
    await client.from("supplier_payments").delete().eq("id", write.payment.id);
    throw new Error("No se pudo registrar el pago.", { cause: activityError.code });
  }

  return write.created;
}

async function companyIdOf(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("companies").select("id");
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error("No se pudo registrar el pago.", { cause: error?.code });
  }
  const row: unknown = data[0];
  if (!isIdRow(row)) {
    throw new Error("No se pudo registrar el pago.");
  }
  return row.id;
}

function isIdRow(value: unknown): value is { id: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}
