-- One in-flight fund call per payment, plus a transaction hash whose result
-- is not confirmed yet. Pending hashes are not fund_tx_hash, so they stay
-- out of the monthly cap.

alter table public.supplier_payments
  add column funding_claimed_at timestamptz,
  add column deploy_tx_hash text,
  add column pending_fund_tx_hash text;

alter table public.supplier_payments
  add constraint supplier_payments_funding_claim_chk
  check (status = 'pending' or funding_claimed_at is null);

alter table public.supplier_payments
  add constraint supplier_payments_deploy_tx_chk
  check (deploy_tx_hash is null or escrow_contract_id is null);

alter table public.supplier_payments
  add constraint supplier_payments_pending_fund_tx_chk
  check (pending_fund_tx_hash is null or escrow_contract_id is not null);
