-- Finance F5 — Rapprochements de trésorerie multi-comptes
-- Prérequis : biz.financial_periods (20261126000100)

create table biz.treasury_reconciliations (
  id                   uuid primary key default gen_random_uuid(),
  account_type         text not null
                       check (account_type in ('cash','momo_mtn','momo_orange','bank','reserve')),
  account_id           uuid,                          -- FK souple (cash_session, momo.accounts, etc.)
  financial_period_id  uuid references biz.financial_periods(id),
  reconciliation_date  date not null default current_date,
  expected_balance_xaf bigint not null,
  actual_balance_xaf   bigint not null,
  difference_xaf       bigint generated always as
                       (actual_balance_xaf - expected_balance_xaf) stored,
  status               text not null default 'pending'
                       check (status in ('pending','matched','discrepancy','resolved')),
  notes                text,
  resolved_by          uuid references auth.users(id),
  resolved_at          timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id)
);

create index ix_treasury_recon_period on biz.treasury_reconciliations(financial_period_id);
create index ix_treasury_recon_status on biz.treasury_reconciliations(status);
create index ix_treasury_recon_date   on biz.treasury_reconciliations(reconciliation_date desc);

alter table biz.treasury_reconciliations enable row level security;

create policy "treasury recon read"  on biz.treasury_reconciliations
  for select using (app.has_permission('biz.finance.treasury.read'));
create policy "treasury recon write" on biz.treasury_reconciliations
  for all using (app.has_permission('biz.finance.treasury.write'));
