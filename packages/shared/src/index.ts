export type Network = "local" | "testnet" | "mainnet";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
}

export interface NetworkInfo {
  network: Network;
  horizonUrl: string;
  sorobanRpcUrl: string;
}

export const BUSINESS_COUNTRIES = ["AR", "CR", "US", "ES"] as const;
export type BusinessCountry = (typeof BUSINESS_COUNTRIES)[number];

export const BUSINESS_REGIONS = ["global", "AR", "CR", "US", "ES"] as const;
export type BusinessRegion = (typeof BUSINESS_REGIONS)[number];

export const BUSINESS_RANGES = ["12", "6"] as const;
export type BusinessRange = (typeof BUSINESS_RANGES)[number];

export const BUSINESS_CATEGORY_PERIODS = ["current", "previous"] as const;
export type BusinessCategoryPeriod = (typeof BUSINESS_CATEGORY_PERIODS)[number];

export const BUSINESS_PAYMENT_STATUSES = ["pending", "scheduled", "approved", "released"] as const;
export type BusinessPaymentStatus = (typeof BUSINESS_PAYMENT_STATUSES)[number];

export const BUSINESS_ACTIVITY_KINDS = [
  "supplierPayment",
  "internationalTransfer",
  "fundsReceived",
  "cardSpend",
] as const;
export type BusinessActivityKind = (typeof BUSINESS_ACTIVITY_KINDS)[number];

export const BUSINESS_CATEGORY_KEYS = [
  "software",
  "services",
  "marketing",
  "operations",
  "people",
  "other",
] as const;
export type BusinessCategoryKey = (typeof BUSINESS_CATEGORY_KEYS)[number];

export interface BusinessDashboardFilters {
  region: BusinessRegion;
  range: BusinessRange;
  categoryPeriod: BusinessCategoryPeriod;
}

export interface BusinessUpcomingPayment {
  id: string;
  supplier: string;
  country: BusinessCountry;
  amount: number;
  dueDate: string;
  status: BusinessPaymentStatus;
  stellarAccount: string | null;
  fundedTxHash: string | null;
  escrowContractId: string | null;
  releaseTxHash: string | null;
}

export interface BusinessActivity {
  id: string;
  kind: BusinessActivityKind;
  counterparty: string;
  amount: number;
  from: BusinessCountry;
  to: BusinessCountry;
  at: string;
}

export interface BusinessCategorySlice {
  key: BusinessCategoryKey;
  amount: number;
}

export interface BusinessDashboard {
  today: string;
  company: { name: string; countries: number };
  user: { firstName: string; fullName: string; avatar: string };
  period: { from: string; to: string };
  kpis: {
    balance: { value: number; change: number };
    payable: { value: number; invoices: number };
    spend: { value: number; change: number };
    international: { value: number; payments: number };
  };
  cashFlow: { month: string; income: number; expenses: number }[];
  categories: {
    month: string;
    slices: BusinessCategorySlice[];
    total: number;
  };
  cards: { last4: string; currency: string; active: number; total: number };
  upcomingPayments: BusinessUpcomingPayment[];
  activity: BusinessActivity[];
  countryVolumes: { country: BusinessCountry; amount: number }[];
}

export const API_ROUTES = {
  health: "/health",
  network: "/stellar/network",
  businessDashboard: "/business/dashboard",
  businessSupplierPayments: "/business/supplier-payments",
  sep10Challenge: "/business/sep10/challenge",
  sep10Token: "/business/sep10/token",
  businessSession: "/business/session",
} as const;

export const SESSION_COOKIE = "senda_session";

export interface Sep10ChallengeResponse {
  transaction: string;
  networkPassphrase: string;
}

export interface BusinessSessionResponse {
  account: string;
}

export function supplierPaymentFundEscrowPath(paymentId: string): string {
  return `${API_ROUTES.businessSupplierPayments}/${encodeURIComponent(paymentId)}/fund-escrow`;
}

export function supplierPaymentReleaseMilestonePath(paymentId: string): string {
  return `${API_ROUTES.businessSupplierPayments}/${encodeURIComponent(paymentId)}/release-milestone`;
}

/** Pending rows with a Stellar account. Seed payments have no account, so they stay out. */
export function supplierPaymentCanBeFunded(
  payment: Pick<BusinessUpcomingPayment, "status" | "stellarAccount">,
): boolean {
  return (
    payment.status === "pending" &&
    typeof payment.stellarAccount === "string" &&
    payment.stellarAccount.trim().length > 0
  );
}

/** Approved rows with a funded escrow and no release hash. The treasury signs server-side. */
export function supplierPaymentCanBeReleased(
  payment: Pick<BusinessUpcomingPayment, "status" | "escrowContractId" | "releaseTxHash">,
): boolean {
  return (
    payment.status === "approved" &&
    typeof payment.escrowContractId === "string" &&
    payment.escrowContractId.trim().length > 0 &&
    (payment.releaseTxHash == null || payment.releaseTxHash.trim().length === 0)
  );
}

export interface ApiErrorBody {
  error: string;
}

export const SUPPLIER_NAME_MAX_LENGTH = 80;

export const SUPPLIER_PAYMENT_ERRORS = {
  supplierName: "Ingresá el nombre del proveedor.",
  supplierNameLength: "El nombre del proveedor puede tener hasta 80 caracteres.",
  stellarAccount: "Ingresá una cuenta Stellar válida.",
  treasury: "El proveedor no puede ser la cuenta de la empresa.",
  country: "Elegí un país.",
  amountUsd: "El monto tiene que ser de al menos 1 USD.",
  dueOn: "Elegí un vencimiento.",
} as const;

export type SupplierPaymentField =
  | "supplierName"
  | "stellarAccount"
  | "country"
  | "amountUsd"
  | "dueOn";

/** Fields the company sends to its own API. This object is not a ledger payload. */
export interface SupplierPaymentInput {
  supplierName: string;
  stellarAccount: string;
  country: BusinessCountry;
  amountUsd: number;
  dueOn: string;
}

export interface SupplierPaymentCreated {
  id: string;
  supplierName: string;
  stellarAccount: string;
  country: BusinessCountry;
  amountUsd: number;
  dueOn: string;
  status: "pending";
  fundedTxHash: null;
  metadataSha256: string;
  activity: {
    id: string;
    kind: "supplierPayment";
    counterparty: string;
    amount: number;
    from: "AR";
    to: BusinessCountry;
    at: string;
  };
}

const POSTGRES_INT_MAX = 2_147_483_647;

export function parseSupplierPayment(
  body: unknown,
  options: {
    treasuryAccount: string;
    isEd25519PublicKey: (account: string) => boolean;
  },
):
  | { ok: true; value: SupplierPaymentInput }
  | {
      ok: false;
      error: string;
      fields: Partial<Record<SupplierPaymentField, string>>;
    } {
  const record = isRecord(body) ? body : {};
  const fields: Partial<Record<SupplierPaymentField, string>> = {};

  const rawName = record.supplierName;
  const supplierName = typeof rawName === "string" ? rawName.trim() : "";
  if (supplierName.length === 0) {
    fields.supplierName = SUPPLIER_PAYMENT_ERRORS.supplierName;
  } else if (supplierName.length > SUPPLIER_NAME_MAX_LENGTH) {
    fields.supplierName = SUPPLIER_PAYMENT_ERRORS.supplierNameLength;
  }

  const rawAccount = record.stellarAccount;
  const stellarAccount = typeof rawAccount === "string" ? rawAccount.trim().toUpperCase() : "";
  let accountIsValid = false;
  try {
    accountIsValid =
      stellarAccount.length > 0 && options.isEd25519PublicKey(stellarAccount);
  } catch {
    accountIsValid = false;
  }
  if (!accountIsValid) {
    fields.stellarAccount = SUPPLIER_PAYMENT_ERRORS.stellarAccount;
  } else if (stellarAccount === options.treasuryAccount) {
    fields.stellarAccount = SUPPLIER_PAYMENT_ERRORS.treasury;
  }

  const rawCountry = record.country;
  const country = typeof rawCountry === "string" ? rawCountry : "";
  if (!isBusinessCountry(country)) {
    fields.country = SUPPLIER_PAYMENT_ERRORS.country;
  }

  const amountUsd = wholeUsd(record.amountUsd);
  if (amountUsd === null) {
    fields.amountUsd = SUPPLIER_PAYMENT_ERRORS.amountUsd;
  }

  const rawDue = record.dueOn;
  const dueOn = typeof rawDue === "string" ? rawDue.trim() : "";
  if (!isCalendarDate(dueOn)) {
    fields.dueOn = SUPPLIER_PAYMENT_ERRORS.dueOn;
  }

  const error =
    fields.supplierName ??
    fields.stellarAccount ??
    fields.country ??
    fields.amountUsd ??
    fields.dueOn;
  if (error || !isBusinessCountry(country) || amountUsd === null) {
    return {
      ok: false,
      error: error ?? SUPPLIER_PAYMENT_ERRORS.supplierName,
      fields,
    };
  }

  return {
    ok: true,
    value: {
      supplierName,
      stellarAccount,
      country,
      amountUsd,
      dueOn,
    },
  };
}

export function isBusinessCountry(value: string): value is BusinessCountry {
  return (BUSINESS_COUNTRIES as readonly string[]).includes(value);
}

function wholeUsd(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value > POSTGRES_INT_MAX) return null;
    return /^[1-9]\d*$/.test(String(value)) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed > POSTGRES_INT_MAX) return null;
  return parsed;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (yearText === undefined || monthText === undefined || dayText === undefined) return false;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
