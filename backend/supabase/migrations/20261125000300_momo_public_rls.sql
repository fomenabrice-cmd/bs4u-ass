-- M-03 : RLS sur public.mobile_money_* (Phase 1 — sécurité immédiate)
-- Isolation par organisation, les INSERT directs restent autorisés pour l'org courante
-- (le blocage des INSERT directs viendra avec FE-08 → api.momo_record + M-08 migration données)

ALTER TABLE public.mobile_money_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_money_transactions ENABLE ROW LEVEL SECURITY;

-- ─── mobile_money_accounts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "mmt_accounts_select_org"  ON public.mobile_money_accounts;
CREATE POLICY "mmt_accounts_select_org"  ON public.mobile_money_accounts
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "mmt_accounts_insert_org"  ON public.mobile_money_accounts;
CREATE POLICY "mmt_accounts_insert_org"  ON public.mobile_money_accounts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- ─── mobile_money_transactions ─────────────────────────────────────────────
DROP POLICY IF EXISTS "mmt_transactions_select_org"  ON public.mobile_money_transactions;
CREATE POLICY "mmt_transactions_select_org"  ON public.mobile_money_transactions
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "mmt_transactions_insert_org"  ON public.mobile_money_transactions;
CREATE POLICY "mmt_transactions_insert_org"  ON public.mobile_money_transactions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
