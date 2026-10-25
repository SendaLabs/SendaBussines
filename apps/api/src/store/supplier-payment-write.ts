import { randomUUID } from "node:crypto";
import type { BusinessActivity, SupplierPaymentCreated } from "@senda/shared";
import { paymentMetadataSha256 } from "./payment-metadata.js";
import type { NewSupplierPayment, StoredSupplierPayment } from "./types.js";

export interface SupplierPaymentWrite {
  payment: StoredSupplierPayment;
  activity: BusinessActivity;
  created: SupplierPaymentCreated;
}

/** One pending payment and the Argentina outflow that belongs with it. */
export function supplierPaymentWrite(
  input: NewSupplierPayment,
  now = new Date(),
): SupplierPaymentWrite {
  const id = randomUUID();
  const activityId = randomUUID();
  const at = now.toISOString();
  const metadataSha256 = paymentMetadataSha256(input);
  const payment: StoredSupplierPayment = {
    id,
    supplier: input.supplierName,
    country: input.country,
    amount: input.amountUsd,
    dueDate: input.dueOn,
    status: "pending",
    stellarAccount: input.stellarAccount,
    fundedTxHash: null,
    metadataSha256,
    escrowContractId: null,
    fundTxHash: null,
    releaseTxHash: null,
    fundedAt: null,
    fundingClaimedAt: null,
    deployTxHash: null,
    pendingFundTxHash: null,
  };
  const activity: BusinessActivity = {
    id: activityId,
    kind: "supplierPayment",
    counterparty: input.supplierName,
    amount: -input.amountUsd,
    from: "AR",
    to: input.country,
    at,
  };
  return {
    payment,
    activity,
    created: {
      id,
      supplierName: input.supplierName,
      stellarAccount: input.stellarAccount,
      country: input.country,
      amountUsd: input.amountUsd,
      dueOn: input.dueOn,
      status: "pending",
      fundedTxHash: null,
      metadataSha256,
      activity: {
        id: activityId,
        kind: "supplierPayment",
        counterparty: input.supplierName,
        amount: activity.amount,
        from: "AR",
        to: input.country,
        at,
      },
    },
  };
}
