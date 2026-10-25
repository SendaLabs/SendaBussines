import "server-only";

import type {
  DashboardCountry,
  DashboardFilters,
} from "@/components/business/dashboard/filters";

/**
 * Illustrative figures for the Senda Business demo. Senda Business is not a
 * live product: none of these values come from real accounts or customers.
 */

export const DEMO_TODAY = "2026-10-07";

export type PaymentStatus = "pending" | "scheduled" | "approved";
export type ActivityKind =
  "supplierPayment" | "internationalTransfer" | "fundsReceived" | "cardSpend";
export type CategoryKey =
  "software" | "services" | "marketing" | "operations" | "people" | "other";

export type UpcomingPayment = {
  id: string;
  supplier: string;
  country: DashboardCountry;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
};

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  counterparty: string;
  amount: number;
  from: DashboardCountry;
  to: DashboardCountry;
  at: string;
};

export type CashFlowPoint = { month: string; income: number; expenses: number };
export type CategorySlice = { key: CategoryKey; amount: number };
export type CountryVolume = { country: DashboardCountry; amount: number };

const company = { name: "Empresa Demo S.R.L.", countries: 4 } as const;

const user = {
  firstName: "Delfina",
  fullName: "Delfina Corradini",
  avatar: "/images/P_Delfina.svg",
} as const;

const period = { from: "2026-10-01", to: "2026-10-31" } as const;

const kpis = {
  balance: { value: 248_420, change: 0.084 },
  payable: { value: 31_840, invoices: 12 },
  spend: { value: 18_290, change: -0.042 },
  international: { value: 72_640, payments: 24 },
} as const;

const cashFlow: readonly CashFlowPoint[] = [
  { month: "2025-11", income: 36_000, expenses: 28_000 },
  { month: "2025-12", income: 42_000, expenses: 30_000 },
  { month: "2026-01", income: 38_000, expenses: 27_000 },
  { month: "2026-02", income: 39_000, expenses: 26_000 },
  { month: "2026-03", income: 41_000, expenses: 29_000 },
  { month: "2026-04", income: 47_000, expenses: 31_000 },
  { month: "2026-05", income: 51_000, expenses: 33_000 },
  { month: "2026-06", income: 63_000, expenses: 34_000 },
  { month: "2026-07", income: 57_000, expenses: 36_000 },
  { month: "2026-08", income: 64_000, expenses: 39_000 },
  { month: "2026-09", income: 61_000, expenses: 40_000 },
  { month: "2026-10", income: 72_000, expenses: 38_000 },
];

const categories: Record<
  DashboardFilters["categoryPeriod"],
  { month: string; slices: readonly CategorySlice[] }
> = {
  current: {
    month: "2026-10",
    slices: [
      { key: "software", amount: 5_120 },
      { key: "services", amount: 4_020 },
      { key: "marketing", amount: 3_290 },
      { key: "operations", amount: 2_745 },
      { key: "people", amount: 1_830 },
      { key: "other", amount: 1_285 },
    ],
  },
  previous: {
    month: "2026-09",
    slices: [
      { key: "software", amount: 5_050 },
      { key: "services", amount: 4_300 },
      { key: "marketing", amount: 3_800 },
      { key: "operations", amount: 2_900 },
      { key: "people", amount: 1_840 },
      { key: "other", amount: 1_200 },
    ],
  },
};

const cards = { last4: "4821", currency: "USD", active: 3, total: 10 } as const;

const upcomingPayments: readonly UpcomingPayment[] = [
  {
    id: "pay-1",
    supplier: "Nube Austral Hosting",
    country: "US",
    amount: 1_240,
    dueDate: "2026-10-07",
    status: "pending",
  },
  {
    id: "pay-2",
    supplier: "Estudio Contable Ríos",
    country: "AR",
    amount: 3_850,
    dueDate: "2026-10-08",
    status: "scheduled",
  },
  {
    id: "pay-3",
    supplier: "Pixel Sur Diseño",
    country: "ES",
    amount: 860,
    dueDate: "2026-10-10",
    status: "scheduled",
  },
  {
    id: "pay-4",
    supplier: "Transportes Pacífico",
    country: "CR",
    amount: 2_400,
    dueDate: "2026-10-14",
    status: "approved",
  },
  {
    id: "pay-5",
    supplier: "Agencia Norte Media",
    country: "AR",
    amount: 1_975,
    dueDate: "2026-10-16",
    status: "pending",
  },
];

const activity: readonly ActivityItem[] = [
  {
    id: "act-1",
    kind: "supplierPayment",
    counterparty: "Pixel Sur Diseño",
    amount: -320,
    from: "AR",
    to: "ES",
    at: "2026-10-07T14:32:00-03:00",
  },
  {
    id: "act-2",
    kind: "internationalTransfer",
    counterparty: "Transportes Pacífico",
    amount: -1_250,
    from: "US",
    to: "CR",
    at: "2026-10-07T11:08:00-03:00",
  },
  {
    id: "act-3",
    kind: "fundsReceived",
    counterparty: "Cliente Delta Retail",
    amount: 8_200,
    from: "US",
    to: "AR",
    at: "2026-10-06T09:14:00-03:00",
  },
  {
    id: "act-4",
    kind: "cardSpend",
    counterparty: "Nube Austral Hosting",
    amount: -86,
    from: "AR",
    to: "US",
    at: "2026-10-05T18:40:00-03:00",
  },
];

const countryVolumes: readonly CountryVolume[] = [
  { country: "AR", amount: 124_000 },
  { country: "CR", amount: 71_000 },
  { country: "US", amount: 51_000 },
  { country: "ES", amount: 33_000 },
];

export type DemoDashboard = ReturnType<typeof getDemoDashboard>;

export function getDemoDashboard(filters: DashboardFilters) {
  const { region } = filters;
  const inRegion = (country: DashboardCountry) =>
    region === "global" || country === region;

  const categoryPeriod = categories[filters.categoryPeriod];

  return {
    today: DEMO_TODAY,
    company,
    user,
    period,
    kpis,
    cashFlow: cashFlow.slice(-Number(filters.range)),
    categories: {
      month: categoryPeriod.month,
      slices: categoryPeriod.slices,
      total: categoryPeriod.slices.reduce((sum, s) => sum + s.amount, 0),
    },
    cards,
    upcomingPayments: upcomingPayments.filter((p) => inRegion(p.country)),
    activity: activity.filter((a) => inRegion(a.from) || inRegion(a.to)),
    countryVolumes,
  };
}
