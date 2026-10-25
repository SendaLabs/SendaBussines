import {
  BUSINESS_CATEGORY_KEYS,
  BUSINESS_COUNTRIES,
  type BusinessCategoryKey,
  type BusinessCountry,
  type BusinessDashboard,
  type BusinessDashboardFilters,
} from "@senda/shared";
import type { CompanyBook, StoredSupplierPayment } from "../store/types.js";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDateInBuenosAires(now: Date): string {
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha en Buenos Aires.");
  }
  return `${year}-${month}-${day}`;
}

function byListedOrder<T extends string>(order: readonly T[], value: T): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export function buildDashboard(
  book: CompanyBook,
  filters: BusinessDashboardFilters,
  now = new Date(),
): BusinessDashboard {
  const inRegion = (country: BusinessCountry) =>
    filters.region === "global" || country === filters.region;

  const upcomingPayments = book.payments
    .filter((payment) => inRegion(payment.country))
    .sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.supplier.localeCompare(b.supplier),
    )
    .map(upcomingPayment);

  const activity = book.activity
    .filter((item) => inRegion(item.from) || inRegion(item.to))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));

  const months = filters.range === "6" ? 6 : 12;
  const cashFlow = book.cashFlow
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);

  const category = book.categories[filters.categoryPeriod];
  const slices = category.slices
    .slice()
    .sort(
      (a, b) =>
        byListedOrder<BusinessCategoryKey>(BUSINESS_CATEGORY_KEYS, a.key) -
        byListedOrder<BusinessCategoryKey>(BUSINESS_CATEGORY_KEYS, b.key),
    );

  const countryVolumes = book.countryVolumes
    .filter((item) => inRegion(item.country))
    .sort(
      (a, b) =>
        byListedOrder<BusinessCountry>(BUSINESS_COUNTRIES, a.country) -
        byListedOrder<BusinessCountry>(BUSINESS_COUNTRIES, b.country),
    );

  return {
    today: calendarDateInBuenosAires(now),
    company: book.company,
    user: book.user,
    period: book.period,
    kpis: {
      balance: book.balance,
      payable: {
        value: book.payments.reduce((sum, payment) => sum + payment.amount, 0),
        invoices: book.payments.length,
      },
      spend: book.spend,
      international: book.international,
    },
    cashFlow,
    categories: {
      month: category.month,
      slices,
      total: slices.reduce((sum, slice) => sum + slice.amount, 0),
    },
    cards: book.cards,
    upcomingPayments,
    activity,
    countryVolumes,
  };
}

function upcomingPayment(payment: StoredSupplierPayment): BusinessDashboard["upcomingPayments"][number] {
  return {
    id: payment.id,
    supplier: payment.supplier,
    country: payment.country,
    amount: payment.amount,
    dueDate: payment.dueDate,
    status: payment.status,
    stellarAccount: payment.stellarAccount,
    fundedTxHash: payment.fundedTxHash,
  };
}
