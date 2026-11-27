-- LOT 04 — Clients (biz.customers)
-- Clés étrangères sur core.persons pour données personnelles séparées

create table biz.customers (
  id               uuid primary key default gen_random_uuid(),
  customer_number  text unique not null,              -- ex: CLI-000001
  kind             text not null check (kind in ('individual','company','association','administration')),
  display_name     text not null,                     -- nom commercial / nom d'affichage
  person_id        uuid references core.persons(id),  -- null si entreprise sans contact nominatif
  company_name     text,                              -- raison sociale (si kind=company)
  rc_number        text,                              -- registre du commerce
  taxpayer_id      text,                              -- numéro contribuable
  phone_e164       text check (phone_e164 ~ '^\+[1-9]\d{7,14}$'),
  email            extensions.citext,
  address_line     text,
  city             text,
  country          text not null default 'CM',
  category         text not null default 'standard'
                   check (category in ('standard','vip','member','partner','internal')),
  credit_limit_xaf bigint not null default 0 check (credit_limit_xaf >= 0),
  notes            text,
  tags             text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id),
  created_by       uuid references auth.users(id),
  version          int not null default 1,
  deleted_at       timestamptz
);

create trigger biz_customers_touch
  before update on biz.customers
  for each row execute function app.touch_row();

-- Index
create index ix_customers_kind     on biz.customers(kind)     where deleted_at is null;
create index ix_customers_category on biz.customers(category) where deleted_at is null;
create index ix_customers_phone    on biz.customers(phone_e164) where deleted_at is null and phone_e164 is not null;
create index ix_customers_search   on biz.customers using gin(to_tsvector('french', display_name)) where deleted_at is null;

-- RLS
alter table biz.customers enable row level security;

create policy "employees read customers"
  on biz.customers for select
  using (app.has_permission('biz.customers.read'));

create policy "employees write customers"
  on biz.customers for insert
  with check (app.has_permission('biz.customers.write'));

create policy "employees update customers"
  on biz.customers for update
  using (app.has_permission('biz.customers.write'));

-- Vue API
create view api.v_customers with (security_invoker = true) as
  select
    c.id, c.customer_number, c.kind, c.display_name,
    c.phone_e164, c.email, c.city, c.category,
    c.credit_limit_xaf, c.tags, c.created_at
  from biz.customers c
  where c.deleted_at is null;

-- RPC : Créer un client (avec numéro auto + audit)
create function api.customer_create(
  p_kind        text,
  p_display_name text,
  p_phone_e164  text default null,
  p_email       text default null,
  p_city        text default null,
  p_category    text default 'standard',
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = api, biz, app, public
as $$
declare
  v_number  text;
  v_id      uuid;
  v_idem    jsonb;
begin
  perform app.require_permission('biz.customers.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'customer_create');
    if (v_idem->>'already_done')::boolean then
      return v_idem->'result';
    end if;
  end if;

  v_number := app.next_number('CUSTOMER');

  insert into biz.customers (customer_number, kind, display_name, phone_e164, email, city, category, created_by)
  values (v_number, p_kind, p_display_name, p_phone_e164, p_email, p_city, p_category, auth.uid())
  returning id into v_id;

  perform app.audit('customer.created', 'biz.customer', v_id,
    jsonb_build_object('number', v_number, 'kind', p_kind, 'name', p_display_name),
    null, 'success');

  if p_idempotency_key is not null then
    perform app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('id', v_id, 'customer_number', v_number));
  end if;

  return jsonb_build_object('id', v_id, 'customer_number', v_number);
end;
$$;

grant execute on function api.customer_create to authenticated;
