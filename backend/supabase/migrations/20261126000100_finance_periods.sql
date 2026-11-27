-- Finance F0.03 — Exercices comptables biz.financial_periods
-- Prérequis : biz schema (20261121000000), ops.number_series (20261121000400)

create table biz.financial_periods (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,                     -- ex. "2026-11", "2026-S2"
  period_type text not null default 'monthly'
              check (period_type in ('monthly','quarterly','annual')),
  starts_at   date not null,
  ends_at     date not null,
  status      text not null default 'open'
              check (status in ('open','closing','closed')),
  closed_at   timestamptz,
  closed_by   uuid references auth.users(id),
  notes       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  constraint chk_period_dates check (ends_at >= starts_at),
  constraint uq_financial_periods_label unique (label)
);

create index ix_financial_periods_status on biz.financial_periods(status);
create index ix_financial_periods_dates  on biz.financial_periods(starts_at, ends_at);

alter table biz.financial_periods enable row level security;

create policy "finance periods read"  on biz.financial_periods
  for select using (app.has_permission('biz.finance.journal.read'));
create policy "finance periods write" on biz.financial_periods
  for all using (app.has_permission('biz.finance.closing.write'));

-- Période courante ouverte
insert into biz.financial_periods (label, period_type, starts_at, ends_at, status)
values ('2026-11', 'monthly', '2026-11-01', '2026-11-30', 'open')
on conflict (label) do nothing;

-- Série de numérotation pour les écritures comptables
insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('JOURNAL', 'JNL', 'JNL-{YYYY}-{NNNNNN}', 'yearly', 'Écritures comptables')
on conflict (series_code) do nothing;
