-- =============================================================
-- FINANCE_MIGRATION_053_FINAL.sql
-- Version finale corrigée — Phase 3B — 2026-11-27
-- LOCAL UNIQUEMENT. Ne pas appliquer sans autorisation écrite.
-- =============================================================

-- ---- 1. v_treasury_reconciliations -------------------------
-- Source : treasury_reconciliations
-- Colonnes vérifiées : id, account_type, account_id, financial_period_id,
--   expected_balance_xaf, actual_balance_xaf, status, notes, created_at

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

-- ---- 2. v_momo_daily_closings ------------------------------
-- Corrections Phase 3B :
--   - status : 'validated' → 'calculated' (aucun rapprochement réel n'est effectué ici)
--   - discrepancy_xaf : 0 → NULL (inconnu avant rapprochement)
--   - Transactions exclues : failed, pending, reversed (commission_xaf non comptabilisée)
--   - Transactions reversed : exclues volontairement (commission annulée)

CREATE OR REPLACE VIEW public.v_momo_daily_closings
  WITH (security_invoker = true) AS
SELECT
  md5(mmt.account_id::text || mmt.created_at::date::text)::uuid  AS id,
  mmt.account_id,
  mmt.created_at::date::text                                       AS closing_date,
  COALESCE(mma.account_name, 'Compte MoMo')                       AS account_name,
  COALESCE(mma.provider::text, 'inconnu')                         AS operator,
  COALESCE(
    SUM(mmt.commission_xaf) FILTER (WHERE mmt.status::text = 'completed'),
    0
  )::bigint                                                        AS total_commissions_xaf,
  NULL::bigint                                                     AS discrepancy_xaf,
  'calculated'::text                                               AS status
FROM public.mobile_money_transactions mmt
LEFT JOIN public.mobile_money_accounts mma ON mma.id = mmt.account_id
GROUP BY mmt.account_id, mmt.created_at::date, mma.account_name, mma.provider;

-- ---- 3. v_journal_entries ----------------------------------
-- Corrections Phase 3B :
--   - Suppression du COALESCE mort (reference est NOT NULL)
--   - Cast date corrigé : to_char(entry_date, 'YYYY') sans cast ::timestamptz inutile
--   - debit est numeric : SUM retourne numeric, cast ::bigint via ROUND pour éviter perte

CREATE OR REPLACE VIEW public.v_journal_entries
  WITH (security_invoker = true) AS
SELECT
  je.id,
  je.reference                                   AS entry_number,
  fp.id                                          AS financial_period_id,
  je.entry_date::text                            AS entry_date,
  je.status::text                                AS status,
  je.description,
  je.related_type                                AS source_type,
  je.related_id                                  AS source_id,
  COALESCE((
    SELECT ROUND(SUM(jl.debit))::bigint
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

-- ---- Grants ------------------------------------------------
GRANT SELECT ON public.v_treasury_reconciliations TO authenticated, anon, service_role;
GRANT SELECT ON public.v_momo_daily_closings       TO authenticated, anon, service_role;
GRANT SELECT ON public.v_journal_entries           TO authenticated, anon, service_role;
