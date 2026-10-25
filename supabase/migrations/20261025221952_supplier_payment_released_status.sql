-- A released milestone is terminal. Por pagar counts pending, scheduled, and approved.

alter table public.supplier_payments
  drop constraint supplier_payments_status_check;

alter table public.supplier_payments
  add constraint supplier_payments_status_check
  check (status in ('pending', 'scheduled', 'approved', 'released'));
