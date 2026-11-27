-- Migration 053 : Correction des vues Finance avec données réelles
-- À appliquer manuellement : supabase db push OU via dashboard Supabase SQL Editor

-- 1. v_treasury_reconciliations : remplace stub par données réelles
CREATE OR REPLACE VIEW public.v_treasury_reconciliations
  WITH (security_invoker = true) AS
SELECT
  id,
  account_type,
  account_id,
  financial_period_id,
  created_at::date::text            AS reconciliation_date,
  expected_balance_xaf,
  actual_balance_xaf,
  (actual_balance_xaf - expected_balance_xaf)::bigint AS difference_xaf,
  status,
  notes
FROM public.treasury_reconciliations;

-- 2. v_momo_daily_closings : remplace stub par agrégation commissions réelles
CREATE OR REPLACE VIEW public.v_momo_daily_closings
  WITH (security_invoker = true) AS
SELECT
  md5(mmt.account_id::text || mmt.created_at::date::text)::uuid AS id,
  mmt.account_id,
  mmt.created_at::date::text                                      AS closing_date,
  COALESCE(mma.account_name, 'Compte MoMo')                      AS account_name,
  COALESCE(mma.provider::text, 'inconnu')                        AS operator,
  COALESCE(
    SUM(mmt.commission_xaf) FILTER (WHERE mmt.status::text = 'completed'),
    0
  )::bigint                                                       AS total_commissions_xaf,
  0::bigint                                                       AS discrepancy_xaf,
  'validated'::text                                               AS status
FROM public.mobile_money_transactions mmt
LEFT JOIN public.mobile_money_accounts mma ON mma.id = mmt.account_id
GROUP BY mmt.account_id, mmt.created_at::date, mma.account_name, mma.provider;

-- 3. v_journal_entries : corrige financial_period_id (NULL→réel via date range)
CREATE OR REPLACE VIEW public.v_journal_entries
  WITH (security_invoker = true) AS
SELECT
  je.id,
  COALESCE(
    je.reference,
    'JE-' || to_char(je.entry_date::timestamptz, 'YYYY') || '-' || substring(je.id::text, 1, 6)
  )                                              AS entry_number,
  fp.id                                          AS financial_period_id,
  je.entry_date::text                            AS entry_date,
  je.status::text                                AS status,
  je.description,
  je.related_type                                AS source_type,
  je.related_id                                  AS source_id,
  COALESCE((
    SELECT SUM(jl.debit)::bigint
    FROM public.journal_lines jl
    WHERE jl.entry_id = je.id
  ), 0)                                          AS total_xaf,
  je.created_at::text                            AS created_at,
  fp.label                                       AS period_label
FROM public.journal_entries je
LEFT JOIN LATERAL (
  SELECT fp2.id, fp2.label
  FROM public.financial_periods fp2
  WHERE fp2.organization_id = je.organization_id
    AND je.entry_date BETWEEN fp2.starts_at AND fp2.ends_at
  ORDER BY (fp2.period_type = 'monthly') DESC, fp2.starts_at DESC
  LIMIT 1
) fp ON true;

-- Grants (au cas où DEFAULT PRIVILEGES ne les couvre pas)
GRANT SELECT ON public.v_treasury_reconciliations  TO authenticated, anon, service_role;
GRANT SELECT ON public.v_momo_daily_closings        TO authenticated, anon, service_role;
GRANT SELECT ON public.v_journal_entries            TO authenticated, anon, service_role;
