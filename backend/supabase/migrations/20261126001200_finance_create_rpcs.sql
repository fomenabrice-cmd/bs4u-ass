-- Finance — Correctifs et RPCs de création
-- 1. Fix api.v_journal_entries (ajoute financial_period_id)
-- 2. api.create_loan  — génère loan_number via app.next_number
-- 3. api.create_asset — génère asset_number + planning d'amortissement
-- 4. api.create_journal_entry — crée écriture + lignes en brouillon
-- Prérequis : toutes les migrations Finance 000100→001100

-- ─── 1. Vue journal corrigée (financial_period_id ajouté en fin de liste) ────

create or replace view api.v_journal_entries with (security_invoker = true) as
  select
    je.id,
    je.entry_number,
    je.entry_date,
    je.status,
    je.description,
    je.source_type,
    je.source_id,
    je.total_xaf,
    je.created_at,
    fp.label            as period_label,
    je.financial_period_id                        -- ajouté pour le filtre côté service
  from biz.journal_entries je
  left join biz.financial_periods fp on fp.id = je.financial_period_id;

-- grant conservé (view replace ne touche pas les grants existants mais on le réaffirme)
grant select on api.v_journal_entries to authenticated;

-- ─── 2. RPC : créer un emprunt avec numérotation automatique ─────────────────

create or replace function api.create_loan(
  p_lender            text,
  p_loan_type         text,
  p_principal_xaf     bigint,
  p_rate_pct          numeric   default 0,
  p_disbursed_at      date      default current_date,
  p_due_date          date      default null,
  p_notes             text      default null
) returns uuid
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_id     uuid;
  v_number text;
  v_period uuid;
begin
  perform app.require_permission('biz.finance.capital.write');

  v_number := app.next_number('LOAN');

  select id into v_period
  from biz.financial_periods
  where status = 'open'
  order by starts_at desc
  limit 1;

  insert into biz.loans (
    loan_number, lender, loan_type, principal_xaf, rate_pct,
    disbursed_at, due_date, notes, financial_period_id, status,
    created_by
  ) values (
    v_number, p_lender, p_loan_type, p_principal_xaf, p_rate_pct,
    p_disbursed_at, p_due_date, p_notes, v_period, 'active',
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function api.create_loan(text, text, bigint, numeric, date, date, text) to authenticated;

-- ─── 3. RPC : créer une immobilisation + plan d'amortissement ────────────────

create or replace function api.create_asset(
  p_name                  text,
  p_asset_category        text,
  p_acquisition_cost_xaf  bigint,
  p_acquisition_date      date      default current_date,
  p_useful_life_months    int       default 36,
  p_residual_value_xaf    bigint    default 0,
  p_notes                 text      default null
) returns uuid
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_id         uuid;
  v_number     text;
  v_period     uuid;
  v_depreciable bigint;
  v_monthly    bigint;
  v_remainder  bigint;
  v_pstart     date;
  v_pend       date;
  v_amount     bigint;
  v_cumul      bigint;
begin
  perform app.require_permission('biz.finance.assets.write');

  if p_acquisition_cost_xaf <= p_residual_value_xaf then
    raise exception 'ASSET_NO_DEPRECIABLE_AMOUNT'
      using detail = 'Coût d''acquisition doit dépasser la valeur résiduelle';
  end if;

  v_number      := app.next_number('ASSET');
  v_depreciable := p_acquisition_cost_xaf - p_residual_value_xaf;
  v_monthly     := v_depreciable / p_useful_life_months;
  v_remainder   := v_depreciable - v_monthly * p_useful_life_months;

  select id into v_period
  from biz.financial_periods
  where status = 'open'
  order by starts_at desc
  limit 1;

  insert into biz.assets (
    asset_number, name, asset_category, acquisition_cost_xaf, acquisition_date,
    useful_life_months, residual_value_xaf, notes, financial_period_id, status,
    created_by
  ) values (
    v_number, p_name, p_asset_category, p_acquisition_cost_xaf, p_acquisition_date,
    p_useful_life_months, p_residual_value_xaf, p_notes, v_period, 'active',
    auth.uid()
  ) returning id into v_id;

  for i in 1..p_useful_life_months loop
    v_pstart := (p_acquisition_date + make_interval(months => i - 1))::date;
    v_pend   := (p_acquisition_date + make_interval(months => i) - '1 day'::interval)::date;
    v_amount := v_monthly + (case when i = p_useful_life_months then v_remainder else 0 end);
    v_cumul  := v_monthly * i + (case when i = p_useful_life_months then v_remainder else 0 end);

    insert into biz.asset_depreciation_schedules
      (asset_id, period_number, period_start, period_end, amount_xaf, cumulative_xaf)
    values
      (v_id, i, v_pstart, v_pend, v_amount, v_cumul);
  end loop;

  return v_id;
end;
$$;

grant execute on function api.create_asset(text, text, bigint, date, int, bigint, text) to authenticated;

-- ─── 4. RPC : créer une écriture comptable (brouillon) avec ses lignes ───────

create or replace function api.create_journal_entry(
  p_description text,
  p_entry_date  date,
  p_period_id   uuid,
  p_lines       jsonb     -- [{"account_code","debit_xaf","credit_xaf"}]
) returns uuid
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_id     uuid;
  v_number text;
  v_line   jsonb;
  v_lnum   smallint := 1;
  v_debit  bigint   := 0;
  v_credit bigint   := 0;
begin
  perform app.require_permission('biz.finance.journal.write');

  if jsonb_array_length(p_lines) < 2 then
    raise exception 'JOURNAL_MIN_LINES' using detail = 'Une écriture requiert au moins 2 lignes';
  end if;

  v_number := app.next_number('JOURNAL');

  insert into biz.journal_entries (
    entry_number, financial_period_id, entry_date, status, description, created_by
  ) values (
    v_number, p_period_id, p_entry_date, 'draft', p_description, auth.uid()
  ) returning id into v_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into biz.journal_lines (
      entry_id, line_number, account_code, debit_xaf, credit_xaf, description
    ) values (
      v_id,
      v_lnum,
      v_line->>'account_code',
      coalesce((v_line->>'debit_xaf')::bigint,  0),
      coalesce((v_line->>'credit_xaf')::bigint, 0),
      v_line->>'description'
    );

    v_debit  := v_debit  + coalesce((v_line->>'debit_xaf')::bigint,  0);
    v_credit := v_credit + coalesce((v_line->>'credit_xaf')::bigint, 0);
    v_lnum   := v_lnum + 1;
  end loop;

  -- Pré-valide la balance (optionnel en brouillon — le trigger le revérifie à posting)
  if v_debit != v_credit then
    raise exception 'JOURNAL_UNBALANCED'
      using detail = format('Débit=%s XAF ≠ Crédit=%s XAF', v_debit, v_credit);
  end if;

  -- Met à jour total_xaf sur l'écriture brouillon
  update biz.journal_entries set total_xaf = v_debit where id = v_id;

  return v_id;
end;
$$;

grant execute on function api.create_journal_entry(text, date, uuid, jsonb) to authenticated;

-- ─── 5. Vue : apports en capital ─────────────────────────────────────────────

create or replace view api.v_capital_contributions with (security_invoker = true) as
  select
    id,
    contrib_number,
    contributor,
    contribution_type,
    amount_xaf,
    method,
    contributed_at,
    notes,
    created_at
  from biz.capital_contributions;

grant select on api.v_capital_contributions to authenticated;
