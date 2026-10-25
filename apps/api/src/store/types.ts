import type {
  BusinessActivity,
  BusinessCategoryPeriod,
  BusinessCategorySlice,
  BusinessCountry,
  BusinessDashboard,
  BusinessDashboardFilters,
  BusinessUpcomingPayment,
} from "@senda/shared";

export interface CompanyBook {
  company: BusinessDashboard["company"];
  user: BusinessDashboard["user"];
  period: BusinessDashboard["period"];
  balance: BusinessDashboard["kpis"]["balance"];
  spend: BusinessDashboard["kpis"]["spend"];
  international: BusinessDashboard["kpis"]["international"];
  payments: BusinessUpcomingPayment[];
  activity: BusinessActivity[];
  cashFlow: BusinessDashboard["cashFlow"];
  categories: Record<BusinessCategoryPeriod, { month: string; slices: BusinessCategorySlice[] }>;
  cards: BusinessDashboard["cards"];
  countryVolumes: { country: BusinessCountry; amount: number }[];
}

export interface BusinessStore {
  getDashboard(filters: BusinessDashboardFilters): Promise<BusinessDashboard>;
}
