-- Monthly cap, private payment hash, and one-time SEP-10 nonces.
-- The company book stays. Existing companies receive the 50000 default.
-- senda_runtime bypasses RLS and inherits default grants, so it loses this table too.

alter table public.companies
  add column monthly_cap_usd integer not null default 50000;

alter table public.supplier_payments
  add column metadata_sha256 text,
  add column escrow_contract_id text,
  add column fund_tx_hash text,
  add column release_tx_hash text;

create table public.sep10_nonces (
  nonce text primary key,
  account text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.sep10_nonces enable row level security;

revoke all on public.sep10_nonces from anon, authenticated;

grant all on table public.sep10_nonces to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'senda_runtime') then
    execute 'revoke all on table public.sep10_nonces from senda_runtime';
  end if;
end $$;
