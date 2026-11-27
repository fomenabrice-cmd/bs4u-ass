-- Finance F2 — Réserves, mouvements de réserve, règles d'allocation
-- Prérequis : biz.financial_periods (20261126000100)

-- ─── Réserves internes ───────────────────────────────────────────────────────

create table biz.reserves (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  reserve_type    text not null
                  check (reserve_type in ('stock','equipment','security','development','other')),
  balance_xaf     bigint not null default 0 check (balance_xaf >= 0),
  target_xaf      bigint check (target_xaf > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create trigger biz_reserves_touch
  before update on biz.reserves
  for each row execute function app.touch_row();

-- ─── Mouvements de réserve (append-only) ────────────────────────────────────

create table biz.reserve_movements (
  id                  uuid primary key default gen_random_uuid(),
  reserve_id          uuid not null references biz.reserves(id),
  movement_type       text not null
                      check (movement_type in ('allocation','withdrawal','adjustment')),
  amount_xaf          bigint not null check (amount_xaf > 0),
  source_type         text,            -- 'margin_allocation','manual', etc.
  source_id           uuid,
  financial_period_id uuid references biz.financial_periods(id),
  idempotency_key     text unique,
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create trigger biz_reserve_movements_forbid
  before update or delete on biz.reserve_movements
  for each row execute function app.forbid_update_delete();

-- Mise à jour du solde de réserve après chaque mouvement
create function biz.sync_reserve_balance() returns trigger language plpgsql as $$
begin
  update biz.reserves
  set balance_xaf = (
    select coalesce(sum(
      case when movement_type in ('allocation','adjustment') then amount_xaf
           else -amount_xaf end
    ), 0)
    from biz.reserve_movements
    where reserve_id = new.reserve_id
  )
  where id = new.reserve_id;
  return new;
end;
$$;

create trigger biz_reserve_movements_sync
  after insert on biz.reserve_movements
  for each row execute function biz.sync_reserve_balance();

-- ─── Règles d'allocation ─────────────────────────────────────────────────────

create table biz.allocation_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  reserve_id      uuid not null references biz.reserves(id),
  percentage      numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  source_type     text not null
                  check (source_type in ('sale_margin','momo_commission','manual')),
  is_active       boolean not null default true,
  effective_from  date not null default current_date,
  effective_to    date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- Indexes
create index ix_reserves_type         on biz.reserves(reserve_type);
create index ix_reserve_mvmt_res      on biz.reserve_movements(reserve_id);
create index ix_reserve_mvmt_period   on biz.reserve_movements(financial_period_id);
create index ix_allocation_rules_src  on biz.allocation_rules(source_type) where is_active = true;

-- RLS
alter table biz.reserves          enable row level security;
alter table biz.reserve_movements enable row level security;
alter table biz.allocation_rules  enable row level security;

create policy "reserves read"   on biz.reserves
  for select using (app.has_permission('biz.finance.reserves.read'));
create policy "reserves write"  on biz.reserves
  for all using (app.has_permission('biz.finance.reserves.write'));
create policy "res mov read"    on biz.reserve_movements
  for select using (app.has_permission('biz.finance.reserves.read'));
create policy "res mov insert"  on biz.reserve_movements
  for insert with check (app.has_permission('biz.finance.reserves.write'));
create policy "alloc rules r"   on biz.allocation_rules
  for select using (app.has_permission('biz.finance.reserves.read'));
create policy "alloc rules w"   on biz.allocation_rules
  for all using (app.has_permission('biz.finance.reserves.write'));

-- Seed : quatre réserves par défaut
insert into biz.reserves (name, reserve_type, target_xaf)
values
  ('Réserve de sécurité',  'security',    500000),
  ('Réserve équipements',  'equipment',  1000000),
  ('Réserve stock',        'stock',       500000),
  ('Fonds de développement', 'development', null);
