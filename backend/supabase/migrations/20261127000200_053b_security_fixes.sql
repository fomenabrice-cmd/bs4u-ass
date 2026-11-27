-- Migration 053b : Corrections de sécurité P0
-- LOCAL UNIQUEMENT — Ne pas appliquer sans autorisation écrite
-- Prérequis : migration 053 appliquée

-- ============================================================
-- P0-1 : asset_depreciation_schedules — Isolation organisation
-- ============================================================

ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS authenticated_read ON public.asset_depreciation_schedules;

CREATE POLICY ads_select ON public.asset_depreciation_schedules
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_my_org_id());

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

-- Backfill à exécuter APRÈS migration 054 (table assets existante) :
-- UPDATE public.asset_depreciation_schedules ads
-- SET organization_id = a.organization_id
-- FROM public.assets a
-- WHERE ads.asset_id = a.id AND ads.organization_id IS NULL;

-- ============================================================
-- P0-2 : can_access_establishment() — Correction bypass NULL
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_establishment(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- Restructuration policies expenses (supprimer les OR-combinées)
DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_agency ON public.expenses;

CREATE POLICY expenses_access ON public.expenses
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (get_my_establishment_id() IS NOT NULL AND establishment_id = get_my_establishment_id())
      OR (get_my_establishment_id() IS NULL AND NOT is_admin() AND establishment_id IS NULL)
    )
  );

-- Restructuration policies mobile_money_transactions
DROP POLICY IF EXISTS mm_transactions_select ON public.mobile_money_transactions;
DROP POLICY IF EXISTS momo_tx_agency ON public.mobile_money_transactions;

CREATE POLICY mmt_access ON public.mobile_money_transactions
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (get_my_establishment_id() IS NOT NULL AND establishment_id = get_my_establishment_id())
      OR (get_my_establishment_id() IS NULL AND NOT is_admin() AND establishment_id IS NULL)
    )
  );

-- ============================================================
-- P0-3 : invoices — Correction soft-delete bypass
-- ============================================================

DROP POLICY IF EXISTS invoices_manage ON public.invoices;

CREATE POLICY invoices_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY invoices_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY invoices_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id());

-- invoices_select reste inchangée :
-- (organization_id = get_my_org_id() AND deleted_at IS NULL)
