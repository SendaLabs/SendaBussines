import {
  API_ROUTES,
  supplierPaymentFundEscrowPath,
  supplierPaymentReleaseMilestonePath,
} from "@senda/shared";

export const SUPPLIER_PAYMENTS_URL = `/senda-api${API_ROUTES.businessSupplierPayments}`;

export function fundEscrowUrl(paymentId: string): string {
  return `/senda-api${supplierPaymentFundEscrowPath(paymentId)}`;
}

export function releaseMilestoneUrl(paymentId: string): string {
  return `/senda-api${supplierPaymentReleaseMilestonePath(paymentId)}`;
}

export const BUSINESS_API = {
  sep10Challenge: `/senda-api${API_ROUTES.sep10Challenge}`,
  sep10Token: `/senda-api${API_ROUTES.sep10Token}`,
  session: `/senda-api${API_ROUTES.businessSession}`,
} as const;
