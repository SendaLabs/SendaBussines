import { API_ROUTES, supplierPaymentFundEscrowPath } from "@senda/shared";

export const SUPPLIER_PAYMENTS_URL = `/senda-api${API_ROUTES.businessSupplierPayments}`;

export function fundEscrowUrl(paymentId: string): string {
  return `/senda-api${supplierPaymentFundEscrowPath(paymentId)}`;
}
