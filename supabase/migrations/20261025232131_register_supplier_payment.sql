-- One transaction for a pending supplier payment and its activity row.
-- The function returns the created payment together with the activity written
-- in that same transaction. There is no exception handler, so a failed activity
-- insert rolls the payment back and cannot leave an orphan pending row.

create function public.register_supplier_payment(
  p_supplier_name text,
  p_stellar_account text,
  p_country text,
  p_amount_usd integer,
  p_due_on date,
  p_metadata_sha256 text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_recorded_at timestamptz := pg_catalog.now();
  v_payment public.supplier_payments;
  v_activity public.activity_entries;
begin
  if p_metadata_sha256 is null or p_metadata_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'metadata_sha256' using errcode = '22023';
  end if;

  select id
  into strict v_company_id
  from public.companies;

  insert into public.supplier_payments (
    company_id,
    supplier_name,
    country,
    amount_usd,
    due_on,
    status,
    stellar_account,
    funded_tx_hash,
    metadata_sha256,
    escrow_contract_id,
    fund_tx_hash,
    release_tx_hash,
    created_at
  ) values (
    v_company_id,
    p_supplier_name,
    p_country,
    p_amount_usd,
    p_due_on,
    'pending',
    p_stellar_account,
    null,
    p_metadata_sha256,
    null,
    null,
    null,
    v_recorded_at
  )
  returning * into v_payment;

  insert into public.activity_entries (
    company_id,
    supplier_payment_id,
    kind,
    counterparty,
    amount_usd,
    from_country,
    to_country,
    occurred_at
  ) values (
    v_company_id,
    v_payment.id,
    'supplierPayment',
    p_supplier_name,
    -p_amount_usd,
    'AR',
    p_country,
    v_recorded_at
  )
  returning * into v_activity;

  return pg_catalog.jsonb_build_object(
    'payment', pg_catalog.to_jsonb(v_payment),
    'activity', pg_catalog.to_jsonb(v_activity)
  );
end;
$$;

revoke all on function public.register_supplier_payment(text, text, text, integer, date, text)
  from public, anon, authenticated;

grant execute on function public.register_supplier_payment(text, text, text, integer, date, text)
  to service_role;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'senda_runtime') then
    execute 'revoke all on function public.register_supplier_payment(text, text, text, integer, date, text) from senda_runtime';
  end if;
end $$;
