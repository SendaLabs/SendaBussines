import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { buildDashboard } from "../dashboard/project.js";
import { supplierPaymentWrite } from "./supplier-payment-write.js";
import { companyBookFromRow, storedPaymentFromRow } from "./supabase-map.js";
import type {
  BusinessStore,
  FundedSupplierPayment,
  NewSupplierPayment,
  ReleasedSupplierPayment,
} from "./types.js";

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
    release_tx_hash,
    funded_at
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
    async findSupplierPayment(id) {
      const { data, error } = await client
        .from("supplier_payments")
        .select(PAYMENT_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) {
        if (error.code === "22P02") return null;
        throw new Error("No se pudo leer el pago.", { cause: error.code });
      }
      if (!data) return null;
      return storedPaymentFromRow(asRow(data));
    },
    async supplierFundingSnapshot() {
      const { data: companies, error: companyError } = await client
        .from("companies")
        .select("monthly_cap_usd");
      if (companyError || !Array.isArray(companies) || companies.length !== 1) {
        throw new Error("No se pudo leer el tope.", { cause: companyError?.code });
      }
      const company = companies[0];
      const monthlyCapUsd = monthlyCapOf(company);

      const { data: payments, error: paymentError } = await client
        .from("supplier_payments")
        .select(PAYMENT_COLUMNS);
      if (paymentError || !Array.isArray(payments)) {
        throw new Error("No se pudo leer el tope.", { cause: paymentError?.code });
      }
      return {
        monthlyCapUsd,
        payments: payments.map((row) => {
          const payment = storedPaymentFromRow(asRow(row));
          return {
            id: payment.id,
            amount: payment.amount,
            fundTxHash: payment.fundTxHash,
            fundedAt: payment.fundedAt,
          };
        }),
      };
    },
    async saveSupplierMetadata(id, metadataSha256) {
      const { error } = await client
        .from("supplier_payments")
        .update({ metadata_sha256: metadataSha256 })
        .eq("id", id);
      if (error) throw new Error("No se pudo guardar el pago.", { cause: error.code });
    },
    async saveDeployedEscrow(id, escrowContractId) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({ escrow_contract_id: escrowContractId })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error("No se pudo guardar el depósito.", { cause: error?.code });
      }
    },
    async markSupplierFunded(id, funded: FundedSupplierPayment) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({
          status: "approved",
          escrow_contract_id: funded.escrowContractId,
          fund_tx_hash: funded.fundTxHash,
          funded_at: funded.fundedAt,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error("No se pudo registrar el fondeo.", { cause: error?.code });
      }
    },
    async markSupplierReleased(id, released: ReleasedSupplierPayment) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({
          status: "released",
          release_tx_hash: released.releaseTxHash,
        })
        .eq("id", id)
        .eq("status", "approved")
        .not("escrow_contract_id", "is", null)
        .is("release_tx_hash", null)
        .select("id");
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error("No se pudo registrar la liberación.", { cause: error?.code });
      }
    },
  };
}

const PAYMENT_COLUMNS = `
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
  release_tx_hash,
  funded_at
`;

function asRow(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("No se pudo leer el pago.");
  }
  return value as Record<string, unknown>;
}

function monthlyCapOf(value: unknown): number {
  if (value === null || typeof value !== "object" || !("monthly_cap_usd" in value)) {
    throw new Error("No se pudo leer el tope.");
  }
  const raw = value.monthly_cap_usd;
  if (raw == null) return 50_000;
  const parsed = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) throw new Error("No se pudo leer el tope.");
  return parsed;
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
