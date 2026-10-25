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
  /** UTC instant the escrow was funded. Null until fund_tx_hash is stored. */
  fundedAt: string | null;
  /**
   * Set only while one request holds the payment. A second fund call loses
   * the check-and-set and must not deploy or fund.
   */
  fundingClaimedAt: string | null;
  /** Deploy transaction whose contract id is not known yet. */
  deployTxHash: string | null;
  /**
   * Fund transaction that may already have moved USDC. It is not fund_tx_hash,
   * so it does not count toward the monthly cap until the fund is confirmed.
   */
  pendingFundTxHash: string | null;
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
  /**
   * Check-and-set. Succeeds only when the payment is pending and not already
   * claimed. The in-memory store applies that update synchronously.
   */
  claimSupplierFunding(id: string): Promise<StoredSupplierPayment | null>;
  releaseSupplierFunding(id: string): Promise<void>;
  /**
   * Persists the contract id only when it is still null. Returns false when
   * another id is already stored.
   */
  saveDeployedEscrow(id: string, escrowContractId: string): Promise<boolean>;
  /** Keeps the first uncertain deploy hash. Does not replace a different hash. */
  savePendingDeployTx(id: string, txHash: string): Promise<boolean>;
  clearPendingDeployTx(id: string, txHash: string): Promise<void>;
  /** Keeps the first uncertain fund hash. Does not replace a different hash. */
  savePendingFundTx(id: string, txHash: string): Promise<boolean>;
  clearPendingFundTx(id: string, txHash: string): Promise<void>;
  markSupplierFunded(id: string, funded: FundedSupplierPayment): Promise<void>;
}
