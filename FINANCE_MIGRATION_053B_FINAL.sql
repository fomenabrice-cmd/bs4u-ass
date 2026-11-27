-- ============================================================
-- FINANCE_MIGRATION_053B_FINAL
-- Phase 3B corrections de sécurité + Phase 3C durcissement
-- Généré le 2026-11-27
--
-- RÈGLE ABSOLUE : NE PAS EXÉCUTER SANS AUTORISATION ÉCRITE
-- NE PAS exécuter supabase db push
-- NE PAS modifier la production directement
-- ============================================================

BEGIN;

-- ============================================================
-- P0-1 : Isolement org sur asset_depreciation_schedules
-- (table existante sans colonne organization_id)
-- ============================================================

ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.asset_depreciation_schedules ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS authenticated_read ON public.asset_depreciation_schedules;
DROP POLICY IF EXISTS ads_select ON public.asset_depreciation_schedules;
DROP POLICY IF EXISTS ads_insert ON public.asset_depreciation_schedules;
DROP POLICY IF EXISTS ads_update ON public.asset_depreciation_schedules;
DROP POLICY IF EXISTS ads_delete ON public.asset_depreciation_schedules;

CREATE POLICY ads_select ON public.asset_depreciation_schedules
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id = get_my_org_id()
  );

CREATE POLICY ads_insert ON public.asset_depreciation_schedules
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY ads_update ON public.asset_depreciation_schedules
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY ads_delete ON public.asset_depreciation_schedules
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id());

-- ============================================================
-- P0-2 : Correction can_access_establishment() bypass NULL
-- Avant : un user sans establishment_id pouvait accéder à tout
-- Après : un user sans establishment voit uniquement les lignes
--         avec establishment_id IS NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_establishment(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    is_admin()
    OR (
      get_my_establishment_id() IS NOT NULL
      AND get_my_establishment_id() = p_establishment_id
    )
    OR (
      get_my_establishment_id() IS NULL
      AND NOT is_admin()
      AND p_establishment_id IS NULL
    );
$$;

-- ============================================================
-- P0-3 : Policy unifiée expenses (AND org + établissement)
-- Avant : deux policies PERMISSIVE combinées en OR = bypass
-- Après : une seule policy avec condition AND
-- ============================================================

DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_agency ON public.expenses;
DROP POLICY IF EXISTS expenses_access ON public.expenses;

CREATE POLICY expenses_access ON public.expenses
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (
        get_my_establishment_id() IS NOT NULL
        AND establishment_id = get_my_establishment_id()
      )
      OR (
        get_my_establishment_id() IS NULL
        AND NOT is_admin()
        AND establishment_id IS NULL
      )
    )
  );

-- ============================================================
-- P0-4 : Policy unifiée mobile_money_transactions
-- ============================================================

DROP POLICY IF EXISTS mm_transactions_select ON public.mobile_money_transactions;
DROP POLICY IF EXISTS momo_tx_agency ON public.mobile_money_transactions;
DROP POLICY IF EXISTS mmt_access ON public.mobile_money_transactions;

CREATE POLICY mmt_access ON public.mobile_money_transactions
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (
        get_my_establishment_id() IS NOT NULL
        AND establishment_id = get_my_establishment_id()
      )
      OR (
        get_my_establishment_id() IS NULL
        AND NOT is_admin()
        AND establishment_id IS NULL
      )
    )
  );

-- ============================================================
-- P0-5 : invoices soft-delete fix
-- Avant : policy invoices_manage pour ALL sans restriction
--         deleted_at → les lignes soft-deleted visibles en SELECT
-- Après : UPDATE bloqué si deleted_at IS NOT NULL
-- ============================================================

DROP POLICY IF EXISTS invoices_manage ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND deleted_at IS NULL
  )
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id());

-- ============================================================
-- PHASE 3C : REVOKE EXECUTE FROM PUBLIC sur fonctions helper
--
-- Constat DB : toutes les fonctions helper sont granted à PUBLIC.
-- PUBLIC inclut tous les rôles, y compris des rôles de scripts
-- créés en dehors du système de profils BS4U.
--
-- Correction : REVOKE FROM PUBLIC, GRANT TO anon + authenticated.
-- - anon : nécessaire pour l'évaluation des policies RLS Supabase
-- - authenticated : nécessaire pour les appels directs
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.get_my_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_establishment_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_establishment_id() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_establishment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_establishment(uuid) TO anon, authenticated;

-- ============================================================
-- PHASE 3C : Correction set_momo_capital
-- Constat DB : set_momo_capital granted à PUBLIC + authenticated
-- Correction : REVOKE PUBLIC, garder authenticated seulement
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.set_momo_capital FROM PUBLIC;
-- GRANT TO authenticated déjà présent — pas besoin de re-granter

-- ============================================================
-- FIN MIGRATION 053B_FINAL
-- ============================================================

COMMIT;
