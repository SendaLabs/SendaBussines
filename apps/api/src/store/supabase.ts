import {
  BUSINESS_COUNTRIES,
  type BusinessCountry,
  type SupplierPaymentCreated,
} from "@senda/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { buildDashboard } from "../dashboard/project.js";
import { paymentMetadataSha256 } from "./payment-metadata.js";
import { companyBookFromRow, storedPaymentFromRow } from "./supabase-map.js";
import type {
  BusinessStore,
  FundedSupplierPayment,
  NewSupplierPayment,
  ReleasedSupplierPayment,
} from "./types.js";

const PAYMENT_ERROR = "No se pudo registrar el pago.";
const SHA256_HEX = /^[0-9a-f]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    funded_at,
    funding_claimed_at,
    deploy_tx_hash,
    pending_fund_tx_hash
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
      return loadStoredPayment(client, id);
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
    async claimSupplierFunding(id) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({ funding_claimed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .is("funding_claimed_at", null)
        .select(PAYMENT_COLUMNS);
      if (error) throw new Error("No se pudo reservar el pago.", { cause: error.code });
      if (!Array.isArray(data) || data.length !== 1) return null;
      return storedPaymentFromRow(asRow(data[0]));
    },
    async releaseSupplierFunding(id) {
      const { error } = await client
        .from("supplier_payments")
        .update({ funding_claimed_at: null })
        .eq("id", id)
        .eq("status", "pending")
        .not("funding_claimed_at", "is", null);
      if (error) throw new Error("No se pudo reservar el pago.", { cause: error.code });
    },
    async saveDeployedEscrow(id, escrowContractId) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({
          escrow_contract_id: escrowContractId,
          deploy_tx_hash: null,
        })
        .eq("id", id)
        .eq("status", "pending")
        .is("escrow_contract_id", null)
        .not("funding_claimed_at", "is", null)
        .select("id");
      if (error) throw new Error("No se pudo guardar el depósito.", { cause: error.code });
      if (Array.isArray(data) && data.length === 1) return true;
      const current = await loadStoredPayment(client, id);
      return current?.escrowContractId === escrowContractId && current.fundingClaimedAt != null;
    },
    async savePendingDeployTx(id, txHash) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({ deploy_tx_hash: txHash })
        .eq("id", id)
        .eq("status", "pending")
        .is("escrow_contract_id", null)
        .is("deploy_tx_hash", null)
        .not("funding_claimed_at", "is", null)
        .select("id");
      if (error) throw new Error("No se pudo guardar el depósito.", { cause: error.code });
      if (Array.isArray(data) && data.length === 1) return true;
      const current = await loadStoredPayment(client, id);
      return (
        current?.status === "pending" &&
        current.fundingClaimedAt != null &&
        current.escrowContractId == null &&
        current.deployTxHash === txHash
      );
    },
    async clearPendingDeployTx(id, txHash) {
      const { error } = await client
        .from("supplier_payments")
        .update({ deploy_tx_hash: null })
        .eq("id", id)
        .eq("status", "pending")
        .eq("deploy_tx_hash", txHash)
        .not("funding_claimed_at", "is", null);
      if (error) throw new Error("No se pudo guardar el depósito.", { cause: error.code });
    },
    async savePendingFundTx(id, txHash) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({ pending_fund_tx_hash: txHash })
        .eq("id", id)
        .eq("status", "pending")
        .not("escrow_contract_id", "is", null)
        .is("pending_fund_tx_hash", null)
        .not("funding_claimed_at", "is", null)
        .select("id");
      if (error) throw new Error("No se pudo guardar el depósito.", { cause: error.code });
      if (Array.isArray(data) && data.length === 1) return true;
      const current = await loadStoredPayment(client, id);
      return (
        current?.status === "pending" &&
        current.fundingClaimedAt != null &&
        current.escrowContractId != null &&
        current.pendingFundTxHash === txHash
      );
    },
    async clearPendingFundTx(id, txHash) {
      const { error } = await client
        .from("supplier_payments")
        .update({ pending_fund_tx_hash: null })
        .eq("id", id)
        .eq("status", "pending")
        .eq("pending_fund_tx_hash", txHash)
        .not("funding_claimed_at", "is", null);
      if (error) throw new Error("No se pudo guardar el depósito.", { cause: error.code });
    },
    async markSupplierFunded(id, funded: FundedSupplierPayment) {
      const { data, error } = await client
        .from("supplier_payments")
        .update({
          status: "approved",
          escrow_contract_id: funded.escrowContractId,
          fund_tx_hash: funded.fundTxHash,
          funded_at: funded.fundedAt,
          funding_claimed_at: null,
          deploy_tx_hash: null,
          pending_fund_tx_hash: null,
        })
        .eq("id", id)
        .eq("status", "pending")
        .eq("escrow_contract_id", funded.escrowContractId)
        .not("funding_claimed_at", "is", null)
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
  funded_at,
  funding_claimed_at,
  deploy_tx_hash,
  pending_fund_tx_hash
`;

async function loadStoredPayment(
  client: SupabaseClient,
  id: string,
): Promise<ReturnType<typeof storedPaymentFromRow> | null> {
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
}

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
): Promise<SupplierPaymentCreated> {
  const metadataSha256 = paymentMetadataSha256(input);
  const { data, error } = await client.rpc("register_supplier_payment", {
    p_supplier_name: input.supplierName,
    p_stellar_account: input.stellarAccount,
    p_country: input.country,
    p_amount_usd: input.amountUsd,
    p_due_on: input.dueOn,
    p_metadata_sha256: metadataSha256,
  });
  if (error) {
    throw new Error(PAYMENT_ERROR, { cause: error.code });
  }

  const created = supplierPaymentFromRpc(data);
  if (
    created.supplierName !== input.supplierName ||
    created.stellarAccount !== input.stellarAccount ||
    created.country !== input.country ||
    created.amountUsd !== input.amountUsd ||
    created.dueOn !== input.dueOn ||
    created.metadataSha256 !== metadataSha256
  ) {
    throw new Error(PAYMENT_ERROR);
  }
  return created;
}

/** The row pair returned by `register_supplier_payment`. */
export function supplierPaymentFromRpc(value: unknown): SupplierPaymentCreated {
  const body = asRecord(rpcPayload(value));
  const payment = asRecord(body.payment);
  const activity = asRecord(body.activity);
  const id = requiredUuid(payment, "id");
  const supplierName = requiredString(payment, "supplier_name");
  const stellarAccount = requiredString(payment, "stellar_account");
  const country = requiredCountry(payment, "country");
  const amountUsd = requiredInteger(payment, "amount_usd");
  const dueOn = requiredString(payment, "due_on");
  const metadataSha256 = requiredString(payment, "metadata_sha256");
  const createdAt = requiredString(payment, "created_at");
  const companyId = requiredUuid(payment, "company_id");
  const activityId = requiredUuid(activity, "id");

  if (amountUsd < 1 || !DAY.test(dueOn) || !SHA256_HEX.test(metadataSha256)) fail();
  if (payment.status !== "pending" || payment.funded_tx_hash !== null) fail();
  if (!Number.isFinite(Date.parse(createdAt))) fail();
  if (requiredUuid(activity, "company_id") !== companyId) fail();
  if (requiredUuid(activity, "supplier_payment_id") !== id) fail();
  if (activity.kind !== "supplierPayment" || activity.counterparty !== supplierName) fail();
  if (requiredInteger(activity, "amount_usd") !== -amountUsd) fail();
  if (activity.from_country !== "AR" || activity.to_country !== country) fail();
  if (activity.occurred_at !== createdAt) fail();

  return {
    id,
    supplierName,
    stellarAccount,
    country,
    amountUsd,
    dueOn,
    status: "pending",
    fundedTxHash: null,
    metadataSha256,
    activity: {
      id: activityId,
      kind: "supplierPayment",
      counterparty: supplierName,
      amount: -amountUsd,
      from: "AR",
      to: country,
      at: createdAt,
    },
  };
}

function rpcPayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    fail();
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) fail();
  return value;
}

function requiredInteger(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) fail();
  return value;
}

function requiredUuid(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key);
  if (!UUID.test(value)) fail();
  return value;
}

function requiredCountry(row: Record<string, unknown>, key: string): BusinessCountry {
  const value = requiredString(row, key);
  if ((BUSINESS_COUNTRIES as readonly string[]).includes(value)) return value as BusinessCountry;
  fail();
}

function fail(): never {
  throw new Error(PAYMENT_ERROR);
}
