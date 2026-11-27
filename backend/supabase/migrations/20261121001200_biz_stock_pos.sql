-- LOT 06 — Produits, Stock & Caisse (POS)

-- ─── Produits physiques ─────────────────────────────────────────────────────

create table biz.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,
  name            text not null,
  category        text not null,
  unit            text not null default 'unité',
  price_xaf       bigint not null check (price_xaf >= 0),
  cost_price_xaf  bigint check (cost_price_xaf >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_products_touch before update on biz.products for each row execute function app.touch_row();

-- ─── Mouvements de stock (append-only) ─────────────────────────────────────

create table biz.stock_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references biz.products(id),
  movement_type   text not null check (movement_type in ('in','out','adjustment','initial')),
  qty             int not null,                   -- positif pour entrée, négatif pour sortie
  unit_cost_xaf   bigint,
  reference       text,                           -- numéro de commande, BL, etc.
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create trigger biz_stock_movements_forbid_update_delete
  before update or delete on biz.stock_movements
  for each row execute function app.forbid_update_delete();

-- Vue stock calculé
create view biz.v_stock_levels as
  select
    p.id as product_id, p.sku, p.name, p.category, p.unit,
    p.price_xaf, p.is_active,
    coalesce(sum(sm.qty), 0) as qty_on_hand
  from biz.products p
  left join biz.stock_movements sm on sm.product_id = p.id
  group by p.id;

-- ─── Sessions de caisse ─────────────────────────────────────────────────────

create table biz.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_date    date not null default current_date,
  opened_by       uuid not null references auth.users(id),
  closed_by       uuid references auth.users(id),
  opening_balance_xaf bigint not null check (opening_balance_xaf >= 0),
  closing_balance_xaf bigint,
  expected_balance_xaf bigint generated always as (
    opening_balance_xaf  -- recalculé via trigger
  ) stored,
  status          text not null default 'open' check (status in ('open','closed')),
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  notes           text,
  unique (opened_by, session_date)   -- une seule caisse ouverte par utilisateur par jour
);

-- ─── Entrées/Sorties de caisse (append-only) ────────────────────────────────

create table biz.cash_entries (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references biz.cash_sessions(id),
  entry_type      text not null check (entry_type in ('open','close','sale','refund','expense','deposit','withdrawal')),
  amount_xaf      bigint not null,              -- positif = entrée, négatif = sortie
  reference       text,
  label           text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create trigger biz_cash_entries_forbid_update_delete
  before update or delete on biz.cash_entries
  for each row execute function app.forbid_update_delete();

-- ─── Lignes POS (ventes directes à la caisse) ───────────────────────────────

create table biz.pos_sales (
  id              uuid primary key default gen_random_uuid(),
  sale_number     text unique not null,          -- créé via séquence
  session_id      uuid not null references biz.cash_sessions(id),
  customer_id     uuid references biz.customers(id),
  total_xaf       bigint not null check (total_xaf >= 0),
  paid_xaf        bigint not null check (paid_xaf >= 0),
  change_xaf      bigint generated always as (paid_xaf - total_xaf) stored,
  payment_method  text not null default 'cash' check (payment_method in ('cash','mtn_momo','orange_money')),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create table biz.pos_sale_lines (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references biz.pos_sales(id) on delete cascade,
  product_id      uuid references biz.products(id),
  service_id      uuid references biz.services(id),
  label           text not null,
  qty             int not null check (qty > 0),
  unit_price_xaf  bigint not null check (unit_price_xaf >= 0),
  line_total_xaf  bigint generated always as (qty * unit_price_xaf) stored
);

-- Index
create index ix_stock_movements_product on biz.stock_movements(product_id);
create index ix_cash_sessions_date      on biz.cash_sessions(session_date desc);
create index ix_cash_entries_session    on biz.cash_entries(session_id);
create index ix_pos_sales_session       on biz.pos_sales(session_id);

-- RLS
alter table biz.products        enable row level security;
alter table biz.stock_movements enable row level security;
alter table biz.cash_sessions   enable row level security;
alter table biz.cash_entries    enable row level security;
alter table biz.pos_sales       enable row level security;
alter table biz.pos_sale_lines  enable row level security;

create policy "stock read"   on biz.products for select using (app.has_permission('biz.inventory.read'));
create policy "stock write"  on biz.products for all   using (app.has_permission('biz.inventory.write'));
create policy "stock_mv read"  on biz.stock_movements for select using (app.has_permission('biz.inventory.read'));
create policy "stock_mv write" on biz.stock_movements for insert with check (app.has_permission('biz.inventory.write'));
create policy "cash read"    on biz.cash_sessions for select using (app.has_permission('biz.cash.view'));
create policy "cash write"   on biz.cash_sessions for all   using (app.has_permission('biz.cash.manage'));
create policy "cash_e read"  on biz.cash_entries  for select using (app.has_permission('biz.cash.view'));
create policy "cash_e write" on biz.cash_entries  for insert with check (app.has_permission('biz.cash.manage'));
create policy "pos read"     on biz.pos_sales     for select using (app.has_permission('biz.cash.view'));
create policy "pos write"    on biz.pos_sales     for insert with check (app.has_permission('biz.cash.manage'));
create policy "pos_l read"   on biz.pos_sale_lines for select using (app.has_permission('biz.cash.view'));
create policy "pos_l write"  on biz.pos_sale_lines for insert with check (app.has_permission('biz.cash.manage'));

-- Vues API
create view api.v_stock_levels with (security_invoker = true) as
  select * from biz.v_stock_levels;

create view api.v_cash_sessions with (security_invoker = true) as
  select
    cs.id, cs.session_date, cs.status,
    cs.opening_balance_xaf, cs.closing_balance_xaf,
    cs.opened_at, cs.closed_at,
    coalesce(sum(ce.amount_xaf), cs.opening_balance_xaf) as current_balance_xaf
  from biz.cash_sessions cs
  left join biz.cash_entries ce on ce.session_id = cs.id
  group by cs.id;
