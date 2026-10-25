import { createClient } from "@supabase/supabase-js";
import type { Env } from "../config/env.js";
import { buildDashboard } from "../dashboard/project.js";
import { companyBookFromRow } from "./supabase-map.js";
import type { BusinessStore } from "./types.js";

const COMPANY_COLUMNS = `
  name,
  country_count,
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
    funded_tx_hash
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
  };
}
