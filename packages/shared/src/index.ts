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

export const BUSINESS_PAYMENT_STATUSES = ["pending", "scheduled", "approved"] as const;
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
} as const;
