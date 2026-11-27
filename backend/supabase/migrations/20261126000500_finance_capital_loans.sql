-- Finance F3 — Apports en capital, emprunts, remboursements
-- Prérequis : biz.financial_periods (20261126000100)

-- ─── Apports en capital (append-only) ───────────────────────────────────────

create table biz.capital_contributions (
  id                  uuid primary key default gen_random_uuid(),
  contrib_number      text unique not null,           -- CAP-YYYY-NNNNNN
  contributor         text not null,
  contribution_type   text not null
                      check (contribution_type in ('initial','additional','supplier_fund','other')),
  amount_xaf          bigint not null check (amount_xaf > 0),
  method              text not null
                      check (method in ('cash','transfer','momo','other')),
  contributed_at      date not null default current_date,
  financial_period_id uuid references biz.financial_periods(id),
  journal_entry_id    uuid references biz.journal_entries(id),
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create trigger biz_capital_contributions_forbid
  before update or delete on biz.capital_contributions
  for each row execute function app.forbid_update_delete();

insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('CAPITAL', 'CAP', 'CAP-{YYYY}-{NNNNNN}', 'yearly', 'Apports en capital')
on conflict (series_code) do nothing;

-- ─── Emprunts ────────────────────────────────────────────────────────────────

create table biz.loans (
  id                  uuid primary key default gen_random_uuid(),
  loan_number         text unique not null,           -- EMR-YYYY-NNNNNN
  lender              text not null,
  loan_type           text not null
                      check (loan_type in ('bank','personal','supplier','other')),
  principal_xaf       bigint not null check (principal_xaf > 0),
  rate_pct            numeric(5,2) not null default 0 check (rate_pct >= 0),
  disbursed_at        date not null,
  due_date            date,
  financial_period_id uuid references biz.financial_periods(id),
  status              text not null default 'active'
                      check (status in ('active','closed','defaulted')),
  journal_entry_id    uuid references biz.journal_entries(id),
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('LOAN', 'EMR', 'EMR-{YYYY}-{NNNNNN}', 'yearly', 'Emprunts')
on conflict (series_code) do nothing;

-- ─── Remboursements (append-only) ────────────────────────────────────────────

create table biz.loan_repayments (
  id                  uuid primary key default gen_random_uuid(),
  repayment_number    text unique not null,           -- RBR-YYYY-NNNNNN
  loan_id             uuid not null references biz.loans(id),
  total_xaf           bigint not null check (total_xaf > 0),
  principal_xaf       bigint not null default 0 check (principal_xaf >= 0),
  interest_xaf        bigint not null default 0 check (interest_xaf >= 0),
  fees_xaf            bigint not null default 0 check (fees_xaf >= 0),
  method              text not null
                      check (method in ('cash','transfer','momo','other')),
  paid_at             date not null default current_date,
  financial_period_id uuid references biz.financial_periods(id),
  journal_entry_id    uuid references biz.journal_entries(id),
  idempotency_key     text unique,
  notes               text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  constraint chk_repayment_sum check (principal_xaf + interest_xaf + fees_xaf = total_xaf)
);

create trigger biz_loan_repayments_forbid
  before update or delete on biz.loan_repayments
  for each row execute function app.forbid_update_delete();

insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('REPAYMENT', 'RBR', 'RBR-{YYYY}-{NNNNNN}', 'yearly', 'Remboursements emprunts')
on conflict (series_code) do nothing;

-- Indexes
create index ix_capital_contribs_at    on biz.capital_contributions(contributed_at desc);
create index ix_loans_status           on biz.loans(status);
create index ix_loan_repayments_loan   on biz.loan_repayments(loan_id);
create index ix_loan_repayments_period on biz.loan_repayments(financial_period_id);

-- RLS
alter table biz.capital_contributions enable row level security;
alter table biz.loans                 enable row level security;
alter table biz.loan_repayments       enable row level security;

create policy "capital read"  on biz.capital_contributions
  for select using (app.has_permission('biz.finance.capital.read'));
create policy "capital insert" on biz.capital_contributions
  for insert with check (app.has_permission('biz.finance.capital.write'));
create policy "loans read"    on biz.loans
  for select using (app.has_permission('biz.finance.capital.read'));
create policy "loans write"   on biz.loans
  for all using (app.has_permission('biz.finance.capital.write'));
create policy "repay read"    on biz.loan_repayments
  for select using (app.has_permission('biz.finance.capital.read'));
create policy "repay insert"  on biz.loan_repayments
  for insert with check (app.has_permission('biz.finance.capital.write'));
