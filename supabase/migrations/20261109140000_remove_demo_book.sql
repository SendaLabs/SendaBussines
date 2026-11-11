-- Drop the invented demo company figures. The company row stays so
-- register_supplier_payment still has one company to attach payments to.

delete from public.activity_entries
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

delete from public.supplier_payments
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

delete from public.cashflow_points
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

delete from public.category_slices
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

delete from public.country_volumes
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

update public.card_snapshots
set last4 = '', active_count = 0, total_count = 0
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

update public.kpi_snapshots
set
  balance_usd = 0,
  balance_change = 0,
  spend_usd = 0,
  spend_change = 0,
  international_usd = 0,
  international_payments = 0
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

update public.panel_faces
set first_name = '', full_name = '', avatar_path = ''
where company_id in (
  select id from public.companies where name = 'Empresa Demo S.R.L.'
);

update public.companies
set name = 'Senda Business', country_count = 0
where name = 'Empresa Demo S.R.L.';
