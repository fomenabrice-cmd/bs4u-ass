-- Finance F4 — Immobilisations et amortissements
-- Prérequis : biz.chart_of_accounts (20261126000200), biz.financial_periods (20261126000100)

-- ─── Registre des actifs ─────────────────────────────────────────────────────

create table biz.assets (
  id                    uuid primary key default gen_random_uuid(),
  asset_number          text unique not null,         -- IMM-YYYY-NNNNNN
  name                  text not null,
  asset_category        text not null
                        check (asset_category in ('it_equipment','office_equipment','furniture','vehicle','other')),
  account_code          text references biz.chart_of_accounts(account_code),
  acquisition_cost_xaf  bigint not null check (acquisition_cost_xaf > 0),
  acquisition_date      date not null,
  useful_life_months    int not null check (useful_life_months > 0),
  depreciation_method   text not null default 'linear'
                        check (depreciation_method in ('linear')),
  residual_value_xaf    bigint not null default 0 check (residual_value_xaf >= 0),
  status                text not null default 'active'
                        check (status in ('active','disposed','fully_depreciated')),
  financial_period_id   uuid references biz.financial_periods(id),
  journal_entry_id      uuid references biz.journal_entries(id),
  notes                 text,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);

insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('ASSET', 'IMM', 'IMM-{YYYY}-{NNNNNN}', 'never', 'Immobilisations')
on conflict (series_code) do nothing;

-- ─── Échéancier d'amortissement ─────────────────────────────────────────────

create table biz.asset_depreciation_schedules (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references biz.assets(id) on delete cascade,
  period_number   smallint not null check (period_number > 0),
  period_start    date not null,
  period_end      date not null,
  amount_xaf      bigint not null check (amount_xaf > 0),
  cumulative_xaf  bigint not null check (cumulative_xaf > 0),
  unique (asset_id, period_number)
);

-- ─── Écritures d'amortissement (append-only, idempotentes) ──────────────────

create table biz.depreciation_entries (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references biz.assets(id),
  financial_period_id uuid not null references biz.financial_periods(id),
  amount_xaf          bigint not null check (amount_xaf > 0),
  journal_entry_id    uuid references biz.journal_entries(id),
  idempotency_key     text unique,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  unique (asset_id, financial_period_id)              -- max une écriture par actif par période
);

create trigger biz_depreciation_entries_forbid
  before update or delete on biz.depreciation_entries
  for each row execute function app.forbid_update_delete();

-- Indexes
create index ix_assets_status         on biz.assets(status);
create index ix_assets_category       on biz.assets(asset_category);
create index ix_depr_entries_period   on biz.depreciation_entries(financial_period_id);
create index ix_depr_schedule_asset   on biz.asset_depreciation_schedules(asset_id);

-- RLS
alter table biz.assets                          enable row level security;
alter table biz.asset_depreciation_schedules    enable row level security;
alter table biz.depreciation_entries            enable row level security;

create policy "assets read"       on biz.assets
  for select using (app.has_permission('biz.finance.assets.read'));
create policy "assets write"      on biz.assets
  for all using (app.has_permission('biz.finance.assets.write'));
create policy "depr sched read"   on biz.asset_depreciation_schedules
  for select using (app.has_permission('biz.finance.assets.read'));
create policy "depr sched write"  on biz.asset_depreciation_schedules
  for all using (app.has_permission('biz.finance.assets.write'));
create policy "depr entry read"   on biz.depreciation_entries
  for select using (app.has_permission('biz.finance.assets.read'));
create policy "depr entry insert" on biz.depreciation_entries
  for insert with check (app.has_permission('biz.finance.assets.write'));
