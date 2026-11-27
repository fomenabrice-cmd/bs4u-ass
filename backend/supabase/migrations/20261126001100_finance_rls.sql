-- Finance F7 — Grants granulaires et vues API pour toutes les tables Finance
-- Prérequis : toutes les migrations Finance précédentes

-- ─── Vues API exposées aux clients ──────────────────────────────────────────

create view api.v_journal_entries with (security_invoker = true) as
  select
    je.id, je.entry_number, je.entry_date, je.status, je.description,
    je.source_type, je.source_id, je.total_xaf, je.created_at,
    fp.label as period_label
  from biz.journal_entries je
  left join biz.financial_periods fp on fp.id = je.financial_period_id;

create view api.v_reserves with (security_invoker = true) as
  select id, name, reserve_type, balance_xaf, target_xaf, is_active
  from biz.reserves;

create view api.v_assets with (security_invoker = true) as
  select
    a.id, a.asset_number, a.name, a.asset_category, a.acquisition_cost_xaf,
    a.acquisition_date, a.useful_life_months, a.residual_value_xaf, a.status,
    coalesce(sum(de.amount_xaf), 0) as accumulated_depreciation_xaf,
    a.acquisition_cost_xaf - coalesce(sum(de.amount_xaf), 0) as book_value_xaf
  from biz.assets a
  left join biz.depreciation_entries de on de.asset_id = a.id
  group by a.id;

create view api.v_loans with (security_invoker = true) as
  select
    l.id, l.loan_number, l.lender, l.loan_type, l.principal_xaf,
    l.rate_pct, l.disbursed_at, l.due_date, l.status,
    coalesce(sum(r.principal_xaf), 0)                     as repaid_principal_xaf,
    l.principal_xaf - coalesce(sum(r.principal_xaf), 0)   as outstanding_xaf,
    coalesce(sum(r.interest_xaf), 0)                      as total_interest_paid_xaf
  from biz.loans l
  left join biz.loan_repayments r on r.loan_id = l.id
  group by l.id;

create view api.v_treasury_reconciliations with (security_invoker = true) as
  select
    tr.id, tr.account_type, tr.reconciliation_date, tr.expected_balance_xaf,
    tr.actual_balance_xaf, tr.difference_xaf, tr.status, tr.notes,
    fp.label as period_label
  from biz.treasury_reconciliations tr
  left join biz.financial_periods fp on fp.id = tr.financial_period_id;

create view api.v_momo_daily_closings with (security_invoker = true) as
  select
    dc.id, dc.closing_date, dc.opening_balance_xaf, dc.total_deposits_xaf,
    dc.total_withdrawals_xaf, dc.total_commissions_xaf, dc.closing_balance_xaf,
    dc.discrepancy_xaf, dc.status,
    a.operator, a.phone_number, a.display_name as account_name
  from momo.daily_closings dc
  join momo.accounts a on a.id = dc.account_id;

-- ─── Grants sur les vues API ─────────────────────────────────────────────────

grant select on api.v_journal_entries            to authenticated;
grant select on api.v_reserves                   to authenticated;
grant select on api.v_assets                     to authenticated;
grant select on api.v_loans                      to authenticated;
grant select on api.v_treasury_reconciliations   to authenticated;
grant select on api.v_momo_daily_closings        to authenticated;

-- ─── Grants sur les tables biz (pour les RPCs security definer) ─────────────

grant select, insert on biz.journal_entries                 to authenticated;
grant select, insert on biz.journal_lines                   to authenticated;
grant select, insert, update on biz.journal_entries         to authenticated;
grant select on biz.chart_of_accounts                       to authenticated;
grant select, insert, update on biz.financial_periods       to authenticated;
grant select, insert on biz.reserve_movements               to authenticated;
grant select, insert, update on biz.reserves                to authenticated;
grant select, insert, update on biz.allocation_rules        to authenticated;
grant select, insert on biz.capital_contributions           to authenticated;
grant select, insert, update on biz.loans                   to authenticated;
grant select, insert on biz.loan_repayments                 to authenticated;
grant select, insert, update on biz.assets                  to authenticated;
grant select, insert on biz.asset_depreciation_schedules    to authenticated;
grant select, insert on biz.depreciation_entries            to authenticated;
grant select, insert, update on biz.treasury_reconciliations to authenticated;
grant select, insert, update on momo.daily_closings         to authenticated;
grant select, insert on momo.provider_events                to authenticated;
grant select, insert, update on momo.commission_rules       to authenticated;

-- ─── Série de numérotation pour les numéros de séries manquants ─────────────

insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values
  ('DEPR',     'AMO', 'AMO-{YYYY}-{NNNNNN}', 'yearly', 'Écritures d''amortissement'),
  ('RECON',    'RAP', 'RAP-{YYYY}-{NNNNNN}', 'yearly', 'Rapprochements de trésorerie')
on conflict (series_code) do nothing;
