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
  fundTxHash: string | null;
  /** UTC instant the escrow was funded. Null until fund_tx_hash is stored. */
  fundedAt: string | null;
}

export interface SupplierFundingRow {
  id: string;
  amount: number;
  fundTxHash: string | null;
  fundedAt: string | null;
}

export interface FundedSupplierPayment {
  escrowContractId: string;
  fundTxHash: string;
  fundedAt: string;
}

export interface ReleasedSupplierPayment {
  releaseTxHash: string;
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
  findSupplierPayment(id: string): Promise<StoredSupplierPayment | null>;
  supplierFundingSnapshot(): Promise<{
    monthlyCapUsd: number;
    payments: SupplierFundingRow[];
  }>;
  saveSupplierMetadata(id: string, metadataSha256: string): Promise<void>;
  saveDeployedEscrow(id: string, escrowContractId: string): Promise<void>;
  markSupplierFunded(id: string, funded: FundedSupplierPayment): Promise<void>;
  markSupplierReleased(id: string, released: ReleasedSupplierPayment): Promise<void>;
}
