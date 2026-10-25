import type {
  BusinessActivity,
  BusinessCategoryPeriod,
  BusinessCategorySlice,
  BusinessCountry,
  BusinessDashboard,
  BusinessDashboardFilters,
  BusinessUpcomingPayment,
  SupplierPaymentCreated,
  SupplierPaymentInput,
} from "@senda/shared";

export interface StoredSupplierPayment extends BusinessUpcomingPayment {
  metadataSha256: string | null;
  escrowContractId: string | null;
  fundTxHash: string | null;
  releaseTxHash: string | null;
}

export type NewSupplierPayment = SupplierPaymentInput;

export interface Sep10Nonce {
  nonce: string;
  account: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface CompanyBook {
  monthlyCapUsd: number;
  company: BusinessDashboard["company"];
  user: BusinessDashboard["user"];
  period: BusinessDashboard["period"];
  balance: BusinessDashboard["kpis"]["balance"];
  spend: BusinessDashboard["kpis"]["spend"];
  international: BusinessDashboard["kpis"]["international"];
  payments: StoredSupplierPayment[];
  activity: BusinessActivity[];
  cashFlow: BusinessDashboard["cashFlow"];
  categories: Record<BusinessCategoryPeriod, { month: string; slices: BusinessCategorySlice[] }>;
  cards: BusinessDashboard["cards"];
  countryVolumes: { country: BusinessCountry; amount: number }[];
}

export interface BusinessStore {
  getDashboard(filters: BusinessDashboardFilters): Promise<BusinessDashboard>;
  createSupplierPayment(input: NewSupplierPayment): Promise<SupplierPaymentCreated>;
}
