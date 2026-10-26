-- UTC instant the escrow was funded. The monthly cap sums amount_usd
-- where fund_tx_hash is set and funded_at falls in the current UTC month.

alter table public.supplier_payments
  add column funded_at timestamptz;

alter table public.supplier_payments
  add constraint supplier_payments_funded_at_chk
  check (fund_tx_hash is null or funded_at is not null);
