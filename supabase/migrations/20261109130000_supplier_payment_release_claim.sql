-- One in-flight release call per approved escrow. The claim is cleared
-- when the release is stored or when the attempt fails before that.

alter table public.supplier_payments
  add column release_claimed_at timestamptz;

alter table public.supplier_payments
  add constraint supplier_payments_release_claim_chk
  check (status = 'approved' or release_claimed_at is null);
