-- Finance F0.01+F0.05 — Journal comptable central
-- chart_of_accounts + journal_entries (avec idempotency_key) + journal_lines (bigint)
-- Prérequis : biz.financial_periods (20261126000100)

-- ─── Plan de comptes ────────────────────────────────────────────────────────

create table biz.chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  account_code  text not null unique,
  account_name  text not null,
  account_class int  not null check (account_class between 1 and 9),
  account_type  text not null
                check (account_type in ('asset','liability','equity','revenue','expense','other')),
  is_active     boolean not null default true,
  parent_code   text references biz.chart_of_accounts(account_code),
  created_at    timestamptz not null default now()
);

create index ix_coa_class on biz.chart_of_accounts(account_class);

alter table biz.chart_of_accounts enable row level security;
create policy "coa read"  on biz.chart_of_accounts for select using (app.has_permission('biz.finance.journal.read'));
create policy "coa write" on biz.chart_of_accounts for all    using (app.has_permission('biz.finance.journal.write'));

-- ─── Écritures comptables ───────────────────────────────────────────────────

create table biz.journal_entries (
  id                  uuid primary key default gen_random_uuid(),
  entry_number        text unique not null,           -- JNL-YYYY-NNNNNN
  financial_period_id uuid references biz.financial_periods(id),
  entry_date          date not null default current_date,
  status              text not null default 'draft'
                      check (status in ('draft','posted','reversed')),
  description         text not null,
  source_type         text,                           -- 'payment','momo_commission','expense','depreciation'
  source_id           uuid,                           -- FK souple vers la table source
  idempotency_key     text unique,                    -- protection anti-doublon d'écriture
  reverses_entry_id   uuid references biz.journal_entries(id),
  total_xaf           bigint not null default 0 check (total_xaf >= 0),
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create index ix_journal_entries_period on biz.journal_entries(financial_period_id);
create index ix_journal_entries_date   on biz.journal_entries(entry_date desc);
create index ix_journal_entries_source on biz.journal_entries(source_type, source_id);
create index ix_journal_entries_idem   on biz.journal_entries(idempotency_key)
  where idempotency_key is not null;

-- Bloque toute modification d'une écriture déjà postée (sauf reversement)
create function biz.prevent_posted_entry_mutation() returns trigger language plpgsql as $$
begin
  if old.status = 'posted' and new.status not in ('reversed') then
    raise exception 'JOURNAL_IMMUTABLE'
      using detail = 'Écriture postée — corriger par contre-passation uniquement';
  end if;
  return new;
end;
$$;

create trigger biz_journal_entries_guard
  before update on biz.journal_entries
  for each row execute function biz.prevent_posted_entry_mutation();

-- Balance débit=crédit vérifiée au passage en 'posted'
create function biz.check_journal_balance() returns trigger language plpgsql as $$
declare
  v_debit  bigint;
  v_credit bigint;
begin
  select coalesce(sum(debit_xaf), 0), coalesce(sum(credit_xaf), 0)
  into v_debit, v_credit
  from biz.journal_lines where entry_id = new.id;

  if v_debit != v_credit then
    raise exception 'JOURNAL_UNBALANCED'
      using detail = format('Débit=%s XAF ≠ Crédit=%s XAF', v_debit, v_credit);
  end if;

  -- Met à jour total_xaf = débit total
  new.total_xaf := v_debit;
  return new;
end;
$$;

create trigger biz_journal_entries_check_balance
  before update on biz.journal_entries
  for each row
  when (old.status = 'draft' and new.status = 'posted')
  execute function biz.check_journal_balance();

-- ─── Lignes d'écriture ──────────────────────────────────────────────────────

create table biz.journal_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references biz.journal_entries(id) on delete cascade,
  line_number  smallint not null,
  account_code text not null references biz.chart_of_accounts(account_code),
  debit_xaf    bigint not null default 0 check (debit_xaf >= 0),
  credit_xaf   bigint not null default 0 check (credit_xaf >= 0),
  description  text,
  constraint chk_line_nonzero    check (debit_xaf > 0 or credit_xaf > 0),
  constraint chk_line_exclusive  check (not (debit_xaf > 0 and credit_xaf > 0))
);

create trigger biz_journal_lines_forbid_update_delete
  before update or delete on biz.journal_lines
  for each row execute function app.forbid_update_delete();

create index ix_journal_lines_entry   on biz.journal_lines(entry_id);
create index ix_journal_lines_account on biz.journal_lines(account_code);

alter table biz.journal_entries enable row level security;
alter table biz.journal_lines   enable row level security;

create policy "journal entries read"  on biz.journal_entries
  for select using (app.has_permission('biz.finance.journal.read'));
create policy "journal entries write" on biz.journal_entries
  for all using (app.has_permission('biz.finance.journal.write'));
create policy "journal lines read"    on biz.journal_lines
  for select using (app.has_permission('biz.finance.journal.read'));
create policy "journal lines insert"  on biz.journal_lines
  for insert with check (app.has_permission('biz.finance.journal.write'));
