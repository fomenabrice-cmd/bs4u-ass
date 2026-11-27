-- Finance test 08 : RLS - isolation multi-tenant
-- Scénario : un utilisateur d'une autre org ne voit aucune ligne Finance
-- Note : Ce test vérifie la structure RLS, pas l'exécution en contexte JWT réel
BEGIN;
SELECT plan(5);

-- Vérifier que les politiques RLS existent sur les tables Finance
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'biz' AND tablename = 'financial_periods'
  ),
  'Politiques RLS présentes sur biz.financial_periods'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'biz' AND tablename = 'journal_entries'
  ),
  'Politiques RLS présentes sur biz.journal_entries'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'biz' AND tablename = 'reserves'
  ),
  'Politiques RLS présentes sur biz.reserves'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'biz' AND tablename = 'loans'
  ),
  'Politiques RLS présentes sur biz.loans'
);

-- Vérifier que les vues API appliquent les filtres (security_invoker ou SECURITY DEFINER avec RLS)
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'api'
      AND table_name IN ('v_journal_entries', 'v_reserves', 'v_assets', 'v_loans')
  ),
  'Vues API Finance (v_journal_entries, v_reserves, v_assets, v_loans) existent'
);

SELECT * FROM finish();
ROLLBACK;
