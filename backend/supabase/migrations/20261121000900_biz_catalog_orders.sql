-- LOT 04 — Catalogue & Commandes

-- ─── Catalogue ─────────────────────────────────────────────────────────────

create table biz.service_categories (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  label_fr    text not null,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

insert into biz.service_categories (code, label_fr, sort_order) values
  ('IMPRESSION',  'Impression',              1),
  ('SCAN',        'Numérisation & Scan',     2),
  ('SECRETARIAT', 'Secrétariat & Documents', 3),
  ('RELIURE',     'Reliure & Finition',      4),
  ('COPIE',       'Photocopie',              5),
  ('FORMATION',   'Formation',               6),
  ('AUTRE',       'Autres prestations',      99);

create table biz.services (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid not null references biz.service_categories(id),
  sku             text unique not null,
  label_fr        text not null,
  unit            text not null default 'unité',  -- feuille, page, heure, etc.
  base_price_xaf  bigint not null check (base_price_xaf >= 0),
  is_active       boolean not null default true,
  requires_qc     boolean not null default false,
  sort_order      int not null default 0
);

-- Catalogue initial
insert into biz.services (category_id, sku, label_fr, unit, base_price_xaf, requires_qc) values
  ((select id from biz.service_categories where code='IMPRESSION'), 'IMP-A4-NB',    'Impression A4 Noir & Blanc',   'feuille', 25,   false),
  ((select id from biz.service_categories where code='IMPRESSION'), 'IMP-A4-CLR',   'Impression A4 Couleur',        'feuille', 100,  true),
  ((select id from biz.service_categories where code='IMPRESSION'), 'IMP-A3-CLR',   'Impression A3 Couleur',        'feuille', 200,  true),
  ((select id from biz.service_categories where code='SCAN'),       'SCN-A4',       'Scan / Numérisation A4',       'feuille', 50,   false),
  ((select id from biz.service_categories where code='SECRETARIAT'),'SEC-CV',       'Rédaction CV',                 'doc',     2500, false),
  ((select id from biz.service_categories where code='SECRETARIAT'),'SEC-LM',       'Lettre de motivation',         'doc',     2000, false),
  ((select id from biz.service_categories where code='RELIURE'),    'REL-SPR-A4',   'Reliure spirale A4',           'doc',     500,  false),
  ((select id from biz.service_categories where code='RELIURE'),    'REL-THERM-A4', 'Reliure thermique A4',         'doc',     1000, false),
  ((select id from biz.service_categories where code='COPIE'),      'CPY-A4-NB',    'Photocopie A4 Noir & Blanc',   'feuille', 25,   false);

-- ─── Commandes ─────────────────────────────────────────────────────────────

create table biz.service_orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique not null,          -- CMD-YYYY-NNNNNN
  customer_id      uuid not null references biz.customers(id),
  status           text not null default 'draft'
                   check (status in ('draft','confirmed','in_production','qc','ready','delivered','closed')),
  priority         int not null default 5 check (priority between 1 and 10),
  due_date         date,
  notes            text,
  total_xaf        bigint not null default 0 check (total_xaf >= 0),
  paid_xaf         bigint not null default 0 check (paid_xaf >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id),
  created_by       uuid references auth.users(id),
  version          int not null default 1
);

create trigger biz_orders_touch
  before update on biz.service_orders
  for each row execute function app.touch_row();

create table biz.order_lines (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references biz.service_orders(id) on delete cascade,
  service_id  uuid references biz.services(id),
  label_fr    text not null,                      -- copié au moment de la commande
  qty         int not null check (qty > 0),
  unit_price_xaf bigint not null check (unit_price_xaf >= 0),
  line_total_xaf bigint generated always as (qty * unit_price_xaf) stored,
  sort_order  int not null default 0,
  notes       text
);

-- Recalcul du total à chaque changement de ligne
create function biz.recalc_order_total() returns trigger language plpgsql as $$
begin
  update biz.service_orders
  set total_xaf = (select coalesce(sum(line_total_xaf), 0) from biz.order_lines where order_id = coalesce(new.order_id, old.order_id))
  where id = coalesce(new.order_id, old.order_id);
  return coalesce(new, old);
end;
$$;

create trigger order_lines_recalc
  after insert or update or delete on biz.order_lines
  for each row execute function biz.recalc_order_total();

-- Index
create index ix_orders_customer on biz.service_orders(customer_id);
create index ix_orders_status   on biz.service_orders(status);
create index ix_orders_created  on biz.service_orders(created_at desc);
create index ix_order_lines_order on biz.order_lines(order_id);

-- RLS
alter table biz.service_orders enable row level security;
alter table biz.order_lines    enable row level security;

create policy "employees read orders"
  on biz.service_orders for select
  using (app.has_permission('biz.orders.read'));

create policy "employees write orders"
  on biz.service_orders for insert
  with check (app.has_permission('biz.orders.write'));

create policy "employees update orders"
  on biz.service_orders for update
  using (app.has_permission('biz.orders.write'));

create policy "employees read order_lines"
  on biz.order_lines for select
  using (app.has_permission('biz.orders.read'));

create policy "employees write order_lines"
  on biz.order_lines for all
  using (app.has_permission('biz.orders.write'));

-- Vues API
create view api.v_orders with (security_invoker = true) as
  select
    o.id, o.order_number, o.status, o.priority,
    o.due_date, o.total_xaf, o.paid_xaf,
    o.created_at, o.updated_at,
    c.display_name as customer_name,
    c.customer_number
  from biz.service_orders o
  join biz.customers c on c.id = o.customer_id;

create view api.v_services with (security_invoker = true) as
  select s.id, s.sku, s.label_fr, s.unit, s.base_price_xaf, s.is_active, sc.label_fr as category
  from biz.services s
  join biz.service_categories sc on sc.id = s.category_id
  where s.is_active;

-- RPC : Transition de statut de commande
create function api.order_transition(
  p_order_id  uuid,
  p_new_status text,
  p_reason     text default null
) returns void
language plpgsql
security definer
set search_path = api, biz, app, public
as $$
declare v_current text;
begin
  perform app.require_permission('biz.orders.write');

  select status into v_current from biz.service_orders where id = p_order_id;
  if not found then
    perform app.raise_error('ORDER_NOT_FOUND', 'Commande introuvable', jsonb_build_object('id', p_order_id));
  end if;

  perform app.assert_transition('biz_order_status', v_current, p_new_status);

  update biz.service_orders set status = p_new_status where id = p_order_id;

  perform app.audit('order.status_changed', 'biz.order', p_order_id,
    jsonb_build_object('from', v_current, 'to', p_new_status),
    p_reason, 'success');
end;
$$;

grant execute on function api.order_transition to authenticated;
