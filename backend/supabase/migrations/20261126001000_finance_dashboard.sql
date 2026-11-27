-- Finance F5 — Vue Dashboard Finance (12 KPI)
-- Prérequis : toutes les tables Finance (20261126000100 à 000900)

-- Vue principale exposant les 12 KPI financiers par période
create view api.v_dashboard_finance with (security_invoker = true) as
with
  current_period as (
    select id, label, starts_at, ends_at, status
    from biz.financial_periods
    where status = 'open'
    order by starts_at desc
    limit 1
  ),
  -- KPI 1 & 2 : CA ventes et prestations
  revenue_data as (
    select
      coalesce(sum(case when jl.account_code like '70%' then jl.credit_xaf else 0 end), 0) as revenue_sales_xaf,
      coalesce(sum(case when jl.account_code like '71%' then jl.credit_xaf else 0 end), 0) as revenue_services_xaf
    from biz.journal_entries je
    join biz.journal_lines jl on jl.entry_id = je.id
    join current_period cp on je.financial_period_id = cp.id
    where je.status = 'posted'
  ),
  -- KPI 3 : Commissions MoMo
  momo_commissions as (
    select coalesce(sum(jl.credit_xaf), 0) as commissions_xaf
    from biz.journal_entries je
    join biz.journal_lines jl on jl.entry_id = je.id
    join current_period cp on je.financial_period_id = cp.id
    where je.status = 'posted' and jl.account_code like '73%'
  ),
  -- KPI 4 : Charges totales
  expenses_data as (
    select coalesce(sum(jl.debit_xaf), 0) as expenses_xaf
    from biz.journal_entries je
    join biz.journal_lines jl on jl.entry_id = je.id
    join current_period cp on je.financial_period_id = cp.id
    where je.status = 'posted' and jl.account_code like '6%'
  ),
  -- KPI 5 : Trésorerie caisse (solde actif classe 51)
  cash_data as (
    select coalesce(sum(
      case when jl.account_code like '51%' then jl.debit_xaf - jl.credit_xaf else 0 end
    ), 0) as cash_balance_xaf
    from biz.journal_entries je
    join biz.journal_lines jl on jl.entry_id = je.id
    where je.status = 'posted'
  ),
  -- KPI 6 : Solde MoMo agrégé
  momo_data as (
    select coalesce(sum(balance_xaf), 0) as momo_balance_xaf
    from momo.accounts where is_active = true
  ),
  -- KPI 7 : Valeur du stock
  stock_data as (
    select coalesce(sum(qty * coalesce(unit_cost_xaf, 0)), 0) as stock_value_xaf
    from biz.stock_movements
    where movement_type != 'adjustment'
  ),
  -- KPI 8 : Réserves totales
  reserves_data as (
    select coalesce(sum(balance_xaf), 0) as reserves_xaf
    from biz.reserves where is_active = true
  ),
  -- KPI 9 : Dettes financières (emprunts actifs)
  loans_data as (
    select
      coalesce(sum(principal_xaf), 0) as total_loans_xaf,
      coalesce(sum(principal_xaf) - coalesce((
        select sum(principal_xaf) from biz.loan_repayments
      ), 0), 0) as outstanding_loans_xaf
    from biz.loans where status = 'active'
  ),
  -- KPI 10 : Capital total apporté
  capital_data as (
    select coalesce(sum(amount_xaf), 0) as total_capital_xaf
    from biz.capital_contributions
  ),
  -- KPI 11 : Amortissements de la période
  depr_data as (
    select coalesce(sum(de.amount_xaf), 0) as depreciation_xaf
    from biz.depreciation_entries de
    join current_period cp on de.financial_period_id = cp.id
  )
select
  cp.id                 as period_id,
  cp.label              as period_label,
  cp.starts_at,
  cp.ends_at,
  cp.status             as period_status,
  -- Revenus
  rd.revenue_sales_xaf                                          as kpi_revenue_sales_xaf,
  rd.revenue_services_xaf                                       as kpi_revenue_services_xaf,
  mc.commissions_xaf                                            as kpi_commissions_xaf,
  rd.revenue_sales_xaf + rd.revenue_services_xaf + mc.commissions_xaf as kpi_total_revenue_xaf,
  -- Charges
  ed.expenses_xaf                                               as kpi_expenses_xaf,
  dd.depreciation_xaf                                           as kpi_depreciation_xaf,
  -- Marge et résultat net (approximation période)
  (rd.revenue_sales_xaf + rd.revenue_services_xaf + mc.commissions_xaf) - ed.expenses_xaf
                                                                as kpi_net_result_xaf,
  -- Trésorerie
  cash.cash_balance_xaf                                         as kpi_cash_xaf,
  mm.momo_balance_xaf                                           as kpi_momo_xaf,
  cash.cash_balance_xaf + mm.momo_balance_xaf                   as kpi_total_treasury_xaf,
  -- Patrimoine
  stk.stock_value_xaf                                           as kpi_stock_value_xaf,
  res.reserves_xaf                                              as kpi_reserves_xaf,
  cap.total_capital_xaf                                         as kpi_capital_xaf,
  ld.outstanding_loans_xaf                                      as kpi_outstanding_loans_xaf,
  -- Fonds libres = trésorerie - réserves - dettes
  (cash.cash_balance_xaf + mm.momo_balance_xaf)
    - res.reserves_xaf
    - ld.outstanding_loans_xaf                                  as kpi_free_funds_xaf
from current_period cp
cross join revenue_data rd
cross join momo_commissions mc
cross join expenses_data ed
cross join cash_data cash
cross join momo_data mm
cross join stock_data stk
cross join reserves_data res
cross join loans_data ld
cross join capital_data cap
cross join depr_data dd;

-- Vue historique par période (toutes les périodes)
create view api.v_finance_periods_summary with (security_invoker = true) as
select
  fp.id, fp.label, fp.period_type, fp.starts_at, fp.ends_at, fp.status,
  fp.closed_at,
  (select count(*) from biz.journal_entries where financial_period_id = fp.id and status = 'posted')
    as posted_entries,
  (select count(*) from biz.depreciation_entries where financial_period_id = fp.id)
    as depreciation_entries,
  (select coalesce(sum(total_xaf),0) from biz.loan_repayments where financial_period_id = fp.id)
    as repayments_xaf
from biz.financial_periods fp
order by fp.starts_at desc;

grant select on api.v_dashboard_finance      to authenticated;
grant select on api.v_finance_periods_summary to authenticated;
