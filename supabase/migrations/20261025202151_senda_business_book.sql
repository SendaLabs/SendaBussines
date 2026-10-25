-- Replace the previous public product tables with the Senda Business book.
-- auth and storage stay untouched. RLS is on and there are no policies:
-- anon and authenticated cannot read; service_role bypasses RLS.

drop table if exists
  public.users,
  public.transactions,
  public.yield_positions,
  public.sessions,
  public.setup_tokens,
  public.wallets,
  public.identities,
  public.cobros,
  public.pending_acks,
  public.credit_claims,
  public.processed_messages,
  public.meta;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country_count integer not null
);

create table public.panel_faces (
  company_id uuid primary key references public.companies (id),
  first_name text not null,
  full_name text not null,
  avatar_path text not null
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  supplier_name text not null,
  country text not null check (country in ('AR', 'CR', 'US', 'ES')),
  amount_usd integer not null check (amount_usd >= 1),
  due_on date not null,
  status text not null check (status in ('pending', 'scheduled', 'approved')),
  stellar_account text,
  funded_tx_hash text,
  created_at timestamptz not null default now(),
  constraint supplier_payments_stellar_chk check (
    stellar_account is null or stellar_account ~ '^G[A-Z2-7]{55}$'
  )
);

create table public.activity_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  supplier_payment_id uuid references public.supplier_payments (id),
  kind text not null check (kind in (
    'supplierPayment', 'internationalTransfer', 'fundsReceived', 'cardSpend'
  )),
  counterparty text not null,
  amount_usd integer not null,
  from_country text not null check (from_country in ('AR', 'CR', 'US', 'ES')),
  to_country text not null check (to_country in ('AR', 'CR', 'US', 'ES')),
  occurred_at timestamptz not null
);

create table public.kpi_snapshots (
  company_id uuid primary key references public.companies (id),
  balance_usd integer not null,
  balance_change numeric not null,
  spend_usd integer not null,
  spend_change numeric not null,
  international_usd integer not null,
  international_payments integer not null,
  period_from date not null,
  period_to date not null
);

create table public.cashflow_points (
  company_id uuid not null references public.companies (id),
  month date not null,
  income_usd integer not null,
  expenses_usd integer not null,
  primary key (company_id, month)
);

create table public.category_slices (
  company_id uuid not null references public.companies (id),
  period text not null check (period in ('current', 'previous')),
  month date not null,
  slice_key text not null check (slice_key in (
    'software', 'services', 'marketing', 'operations', 'people', 'other'
  )),
  amount_usd integer not null,
  primary key (company_id, period, slice_key)
);

create table public.card_snapshots (
  company_id uuid primary key references public.companies (id),
  last4 text not null,
  currency text not null,
  active_count integer not null,
  total_count integer not null
);

create table public.country_volumes (
  company_id uuid not null references public.companies (id),
  country text not null check (country in ('AR', 'CR', 'US', 'ES')),
  amount_usd integer not null,
  primary key (company_id, country)
);

create index supplier_payments_company_id_idx
  on public.supplier_payments (company_id);

create index activity_entries_company_id_idx
  on public.activity_entries (company_id);

create index activity_entries_supplier_payment_id_idx
  on public.activity_entries (supplier_payment_id);

alter table public.companies enable row level security;
alter table public.panel_faces enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.activity_entries enable row level security;
alter table public.kpi_snapshots enable row level security;
alter table public.cashflow_points enable row level security;
alter table public.category_slices enable row level security;
alter table public.card_snapshots enable row level security;
alter table public.country_volumes enable row level security;

revoke all on table
  public.companies,
  public.panel_faces,
  public.supplier_payments,
  public.activity_entries,
  public.kpi_snapshots,
  public.cashflow_points,
  public.category_slices,
  public.card_snapshots,
  public.country_volumes
from anon, authenticated;

grant all on table
  public.companies,
  public.panel_faces,
  public.supplier_payments,
  public.activity_entries,
  public.kpi_snapshots,
  public.cashflow_points,
  public.category_slices,
  public.card_snapshots,
  public.country_volumes
to service_role;

-- The previous product role also bypasses RLS and receives default grants.
do $$
declare
  book_table text;
begin
  if exists (select 1 from pg_roles where rolname = 'senda_runtime') then
    foreach book_table in array array[
      'companies',
      'panel_faces',
      'supplier_payments',
      'activity_entries',
      'kpi_snapshots',
      'cashflow_points',
      'category_slices',
      'card_snapshots',
      'country_volumes'
    ]
    loop
      execute format('revoke all on table public.%I from senda_runtime', book_table);
    end loop;
  end if;
end $$;

-- Re-running the seed by hand does not duplicate the company: the rest of the
-- rows are inserted only when this run actually inserts the company.
do $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name, country_count)
  values ('Empresa Demo S.R.L.', 4)
  on conflict (name) do nothing
  returning id into new_company_id;

  if new_company_id is null then
    return;
  end if;

  insert into public.panel_faces (company_id, first_name, full_name, avatar_path)
  values (new_company_id, 'Delfina', 'Delfina Corradini', '/images/P_Delfina.svg');

  insert into public.supplier_payments (
    company_id,
    supplier_name,
    country,
    amount_usd,
    due_on,
    status,
    stellar_account,
    funded_tx_hash,
    created_at
  ) values
    (new_company_id, 'Nube Austral Hosting', 'US', 1240, '2026-10-07', 'pending', null, null, timestamptz '2026-10-01 00:00:00-03'),
    (new_company_id, 'Estudio Contable Ríos', 'AR', 3850, '2026-10-08', 'scheduled', null, null, timestamptz '2026-10-01 00:00:00-03'),
    (new_company_id, 'Pixel Sur Diseño', 'ES', 860, '2026-10-10', 'scheduled', null, null, timestamptz '2026-10-01 00:00:00-03'),
    (new_company_id, 'Transportes Pacífico', 'CR', 2400, '2026-10-14', 'approved', null, null, timestamptz '2026-10-01 00:00:00-03'),
    (new_company_id, 'Agencia Norte Media', 'AR', 1975, '2026-10-16', 'pending', null, null, timestamptz '2026-10-01 00:00:00-03');

  insert into public.activity_entries (
    company_id,
    supplier_payment_id,
    kind,
    counterparty,
    amount_usd,
    from_country,
    to_country,
    occurred_at
  ) values
    (new_company_id, null, 'supplierPayment', 'Pixel Sur Diseño', -320, 'AR', 'ES', timestamptz '2026-10-07 14:32:00-03'),
    (new_company_id, null, 'internationalTransfer', 'Transportes Pacífico', -1250, 'US', 'CR', timestamptz '2026-10-07 11:08:00-03'),
    (new_company_id, null, 'fundsReceived', 'Cliente Delta Retail', 8200, 'US', 'AR', timestamptz '2026-10-06 09:14:00-03'),
    (new_company_id, null, 'cardSpend', 'Nube Austral Hosting', -86, 'AR', 'US', timestamptz '2026-10-05 18:40:00-03');

  insert into public.kpi_snapshots (
    company_id,
    balance_usd,
    balance_change,
    spend_usd,
    spend_change,
    international_usd,
    international_payments,
    period_from,
    period_to
  ) values (
    new_company_id,
    248420,
    0.084,
    18290,
    -0.042,
    72640,
    24,
    '2026-10-01',
    '2026-10-31'
  );

  insert into public.cashflow_points (company_id, month, income_usd, expenses_usd)
  values
    (new_company_id, '2025-11-01', 36000, 28000),
    (new_company_id, '2025-12-01', 42000, 30000),
    (new_company_id, '2026-01-01', 38000, 27000),
    (new_company_id, '2026-02-01', 39000, 26000),
    (new_company_id, '2026-03-01', 41000, 29000),
    (new_company_id, '2026-04-01', 47000, 31000),
    (new_company_id, '2026-05-01', 51000, 33000),
    (new_company_id, '2026-06-01', 63000, 34000),
    (new_company_id, '2026-07-01', 57000, 36000),
    (new_company_id, '2026-08-01', 64000, 39000),
    (new_company_id, '2026-09-01', 61000, 40000),
    (new_company_id, '2026-10-01', 72000, 38000);

  insert into public.category_slices (company_id, period, month, slice_key, amount_usd)
  values
    (new_company_id, 'current', '2026-10-01', 'software', 5120),
    (new_company_id, 'current', '2026-10-01', 'services', 4020),
    (new_company_id, 'current', '2026-10-01', 'marketing', 3290),
    (new_company_id, 'current', '2026-10-01', 'operations', 2745),
    (new_company_id, 'current', '2026-10-01', 'people', 1830),
    (new_company_id, 'current', '2026-10-01', 'other', 1285),
    (new_company_id, 'previous', '2026-09-01', 'software', 5050),
    (new_company_id, 'previous', '2026-09-01', 'services', 4300),
    (new_company_id, 'previous', '2026-09-01', 'marketing', 3800),
    (new_company_id, 'previous', '2026-09-01', 'operations', 2900),
    (new_company_id, 'previous', '2026-09-01', 'people', 1840),
    (new_company_id, 'previous', '2026-09-01', 'other', 1200);

  insert into public.card_snapshots (
    company_id, last4, currency, active_count, total_count
  ) values (
    new_company_id, '4821', 'USD', 3, 10
  );

  insert into public.country_volumes (company_id, country, amount_usd)
  values
    (new_company_id, 'AR', 124000),
    (new_company_id, 'CR', 71000),
    (new_company_id, 'US', 51000),
    (new_company_id, 'ES', 33000);
end $$;
