import {
  BUSINESS_ACTIVITY_KINDS,
  BUSINESS_CATEGORY_KEYS,
  BUSINESS_CATEGORY_PERIODS,
  BUSINESS_COUNTRIES,
  BUSINESS_PAYMENT_STATUSES,
  type BusinessActivityKind,
  type BusinessCategoryKey,
  type BusinessCategoryPeriod,
  type BusinessCountry,
  type BusinessPaymentStatus,
} from "@senda/shared";
import type { CompanyBook } from "./types.js";

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`El libro tiene un ${label} inválido.`);
  }
  return value as Record<string, unknown>;
}

function manyRecords(value: unknown, label: string): Record<string, unknown>[] {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => asRecord(item, label));
}

function oneRecord(value: unknown, label: string): Record<string, unknown> {
  const rows = manyRecords(value, label);
  if (rows.length !== 1) {
    throw new Error(`Se esperaba un registro de ${label}.`);
  }
  const row = rows[0];
  if (!row) throw new Error(`Se esperaba un registro de ${label}.`);
  return row;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`El libro no tiene ${key}.`);
  }
  return value;
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) throw new Error(`El libro no tiene ${key}.`);
  return parsed;
}

function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`El libro no tiene ${key}.`);
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`El libro tiene un ${label} desconocido.`);
}

function day(value: string): string {
  return value.slice(0, 10);
}

function month(value: string): string {
  return value.slice(0, 7);
}

export function companyBookFromRow(value: unknown): CompanyBook {
  const row = asRecord(value, "empresa");
  const face = oneRecord(row.panel_faces, "cara");
  const kpi = oneRecord(row.kpi_snapshots, "indicadores");
  const cards = oneRecord(row.card_snapshots, "tarjetas");

  const categories: CompanyBook["categories"] = {
    current: { month: "", slices: [] },
    previous: { month: "", slices: [] },
  };

  for (const slice of manyRecords(row.category_slices, "categoría")) {
    const period = oneOf(
      requiredString(slice, "period"),
      BUSINESS_CATEGORY_PERIODS,
      "período",
    ) satisfies BusinessCategoryPeriod;
    const entry = categories[period];
    entry.month = month(requiredString(slice, "month"));
    entry.slices.push({
      key: oneOf(requiredString(slice, "slice_key"), BUSINESS_CATEGORY_KEYS, "rubro") satisfies BusinessCategoryKey,
      amount: requiredNumber(slice, "amount_usd"),
    });
  }

  if (categories.current.slices.length === 0 || categories.previous.slices.length === 0) {
    throw new Error("El libro no tiene los dos períodos de categorías.");
  }

  return {
    company: {
      name: requiredString(row, "name"),
      countries: requiredNumber(row, "country_count"),
    },
    user: {
      firstName: requiredString(face, "first_name"),
      fullName: requiredString(face, "full_name"),
      avatar: requiredString(face, "avatar_path"),
    },
    period: {
      from: day(requiredString(kpi, "period_from")),
      to: day(requiredString(kpi, "period_to")),
    },
    balance: {
      value: requiredNumber(kpi, "balance_usd"),
      change: requiredNumber(kpi, "balance_change"),
    },
    spend: {
      value: requiredNumber(kpi, "spend_usd"),
      change: requiredNumber(kpi, "spend_change"),
    },
    international: {
      value: requiredNumber(kpi, "international_usd"),
      payments: requiredNumber(kpi, "international_payments"),
    },
    payments: manyRecords(row.supplier_payments, "pago").map((payment) => ({
      id: requiredString(payment, "id"),
      supplier: requiredString(payment, "supplier_name"),
      country: oneOf(requiredString(payment, "country"), BUSINESS_COUNTRIES, "país") satisfies BusinessCountry,
      amount: requiredNumber(payment, "amount_usd"),
      dueDate: day(requiredString(payment, "due_on")),
      status: oneOf(
        requiredString(payment, "status"),
        BUSINESS_PAYMENT_STATUSES,
        "estado",
      ) satisfies BusinessPaymentStatus,
      stellarAccount: nullableString(payment, "stellar_account"),
      fundedTxHash: nullableString(payment, "funded_tx_hash"),
    })),
    activity: manyRecords(row.activity_entries, "actividad").map((entry) => ({
      id: requiredString(entry, "id"),
      kind: oneOf(requiredString(entry, "kind"), BUSINESS_ACTIVITY_KINDS, "movimiento") satisfies BusinessActivityKind,
      counterparty: requiredString(entry, "counterparty"),
      amount: requiredNumber(entry, "amount_usd"),
      from: oneOf(requiredString(entry, "from_country"), BUSINESS_COUNTRIES, "país") satisfies BusinessCountry,
      to: oneOf(requiredString(entry, "to_country"), BUSINESS_COUNTRIES, "país") satisfies BusinessCountry,
      at: requiredString(entry, "occurred_at"),
    })),
    cashFlow: manyRecords(row.cashflow_points, "flujo").map((point) => ({
      month: month(requiredString(point, "month")),
      income: requiredNumber(point, "income_usd"),
      expenses: requiredNumber(point, "expenses_usd"),
    })),
    categories,
    cards: {
      last4: requiredString(cards, "last4"),
      currency: requiredString(cards, "currency"),
      active: requiredNumber(cards, "active_count"),
      total: requiredNumber(cards, "total_count"),
    },
    countryVolumes: manyRecords(row.country_volumes, "volumen").map((volume) => ({
      country: oneOf(requiredString(volume, "country"), BUSINESS_COUNTRIES, "país") satisfies BusinessCountry,
      amount: requiredNumber(volume, "amount_usd"),
    })),
  };
}
