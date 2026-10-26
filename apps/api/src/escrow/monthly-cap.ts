export const MONTHLY_CAP_EXCEEDED = "Este pago supera el tope del mes.";

export interface FundedAmountRow {
  amount: number;
  fundTxHash: string | null;
  fundedAt: string | null;
}

/** Calendar month in UTC, `YYYY-MM`. */
export function utcCalendarMonth(instant: Date): string {
  const year = instant.getUTCFullYear();
  const month = String(instant.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Sum of amount_usd for payments whose fund_tx_hash is set and whose funding
 * instant falls in the UTC month of `now`. Unfunded rows do not count.
 */
export function fundedUsdInUtcMonth(payments: readonly FundedAmountRow[], now: Date): number {
  const month = utcCalendarMonth(now);
  let total = 0;
  for (const payment of payments) {
    if (payment.fundTxHash == null || payment.fundTxHash.length === 0) continue;
    if (payment.fundedAt == null) continue;
    const fundedAt = new Date(payment.fundedAt);
    if (Number.isNaN(fundedAt.getTime())) continue;
    if (utcCalendarMonth(fundedAt) !== month) continue;
    total += payment.amount;
  }
  return total;
}

export function exceedsMonthlyCap(fundedUsd: number, amountUsd: number, capUsd: number): boolean {
  return fundedUsd + amountUsd > capUsd;
}
