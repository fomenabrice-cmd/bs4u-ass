-- ============================================================
-- FINANCE_MIGRATION_054_FINAL
-- Module Finance : tables, RPCs, vues
-- Phase 3B spec + Phase 3C durcissement
-- Généré le 2026-11-27
--
-- RÈGLE ABSOLUE : NE PAS EXÉCUTER SANS AUTORISATION ÉCRITE
-- NE PAS exécuter supabase db push
-- NE PAS modifier la production directement
--
-- Prérequis : FINANCE_MIGRATION_053B_FINAL.sql appliqué
-- ============================================================

BEGIN;

-- ============================================================
-- SECTION 1 : TABLE loans
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loans (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  lender_name text NOT NULL,
  loan_reference text,
  principal_xaf bigint NOT NULL CHECK (principal_xaf > 0),
  outstanding_principal_xaf bigint NOT NULL CHECK (outstanding_principal_xaf >= 0),
  interest_rate numeric(6, 4) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid_off', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_select ON public.loans
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY loans_insert ON public.loans
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY loans_update ON public.loans
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
-- Pas de DELETE sur loans

-- ============================================================
-- SECTION 2 : TABLE loan_repayments
-- Phase 3C : idempotency_key UNIQUE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
  idempotency_key text,  -- nullable : certains clients ne fournissent pas de clé
  total_amount_xaf bigint NOT NULL CHECK (total_amount_xaf > 0),
  principal_xaf bigint NOT NULL DEFAULT 0 CHECK (principal_xaf >= 0),
  interest_xaf bigint NOT NULL DEFAULT 0 CHECK (interest_xaf >= 0),
  fees_xaf bigint NOT NULL DEFAULT 0 CHECK (fees_xaf >= 0),
  repayment_date date NOT NULL,
  notes text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lr_amounts_check CHECK (
    principal_xaf + interest_xaf + fees_xaf = total_amount_xaf
  )
);

-- Phase 3C : contrainte d'idempotence (NULL autorisé = pas de déduplication)
CREATE UNIQUE INDEX IF NOT EXISTS lr_idempotency_key_unique
  ON public.loan_repayments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

CREATE POLICY lr_select ON public.loan_repayments
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY lr_insert ON public.loan_repayments
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());
-- Pas d'UPDATE ni DELETE : remboursements immutables

-- ============================================================
-- SECTION 3 : TABLE capital_contributions
-- Phase 3C : soft-cancel uniquement, pas de DELETE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.capital_contributions (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  contributor_name text NOT NULL,
  amount_xaf bigint NOT NULL CHECK (amount_xaf > 0),
  contribution_type text NOT NULL
    CHECK (contribution_type IN ('cash', 'asset', 'service', 'other')),
  contribution_date date NOT NULL,
  journal_reference text,
  notes text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_select ON public.capital_contributions
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY cc_insert ON public.capital_contributions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY cc_update ON public.capital_contributions
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND cancelled_at IS NULL
  )
  WITH CHECK (organization_id = get_my_org_id());
-- Pas de DELETE : soft-cancel via cancelled_at uniquement

-- ============================================================
-- SECTION 4 : TABLE assets
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  asset_code text,
  category text NOT NULL,
  purchase_price_xaf bigint NOT NULL CHECK (purchase_price_xaf > 0),
  residual_value_xaf bigint NOT NULL DEFAULT 0 CHECK (residual_value_xaf >= 0),
  useful_life_months integer NOT NULL CHECK (useful_life_months > 0),
  depreciation_method text NOT NULL DEFAULT 'straight_line'
    CHECK (depreciation_method = 'straight_line'),
  depreciation_rate numeric GENERATED ALWAYS AS (
    1.0 / useful_life_months
  ) STORED,
  service_start_date date NOT NULL,
  disposal_date date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disposed', 'fully_depreciated')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT residual_lt_purchase CHECK (residual_value_xaf < purchase_price_xaf)
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_select ON public.assets
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY assets_insert ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY assets_update ON public.assets
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND status != 'disposed'
  )
  WITH CHECK (organization_id = get_my_org_id());
-- Pas de DELETE

-- ============================================================
-- SECTION 5 : TABLE reserves
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reserves (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  reserve_type text NOT NULL
    CHECK (reserve_type IN ('legal', 'statutory', 'voluntary', 'contingency')),
  current_balance_xaf bigint NOT NULL DEFAULT 0 CHECK (current_balance_xaf >= 0),
  target_xaf bigint CHECK (target_xaf > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserves_select ON public.reserves
  FOR SELECT TO authenticated
  USING (organization_id = get_my_org_id());

CREATE POLICY reserves_insert ON public.reserves
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

CREATE POLICY reserves_update ON public.reserves
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
-- Pas de DELETE (FK constraint avec reserve_movements)

-- ============================================================
-- SECTION 6 : TABLE reserve_movements
-- Phase 3C : INSERT uniquement via RPC, pas de policy INSERT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reserve_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  reserve_id uuid NOT NULL REFERENCES public.reserves(id) ON DELETE RESTRICT,
  movement_type text NOT NULL
    CHECK (movement_type IN ('allocation', 'usage', 'reconstitution', 'cancellation')),
  amount_xaf bigint NOT NULL CHECK (amount_xaf > 0),
  movement_date date NOT NULL,
  reason text NOT NULL,
  source_type text,
  source_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason text
);

ALTER TABLE public.reserve_movements ENABLE ROW LEVEL SECURITY;

-- Phase 3C : SELECT uniquement pour authenticated
-- Pas de policy INSERT/UPDATE/DELETE — INSERT via RPC SECURITY DEFINER uniquement
CREATE POLICY rm_select ON public.reserve_movements
  FOR SELECT TO authenticated
  USING (
    reserve_id IN (
      SELECT id FROM public.reserves
      WHERE organization_id = get_my_org_id()
    )
  );

-- ============================================================
-- SECTION 7 : Modifications asset_depreciation_schedules
-- Phase 3C : UNIQUE (asset_id, period_number) + colonne status
-- ============================================================

-- Colonne status (draft/posted) pour préserver les écritures postées
ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'posted'));

-- Contrainte UNIQUE requise pour ON CONFLICT DO NOTHING dans compute_depreciation
ALTER TABLE public.asset_depreciation_schedules
  ADD CONSTRAINT ads_asset_period_unique UNIQUE (asset_id, period_number);

-- Backfill organization_id depuis la table assets (après création de la table)
-- (organization_id ajouté par 053b, mais les lignes existantes ont NULL)
UPDATE public.asset_depreciation_schedules ads
SET organization_id = a.organization_id
FROM public.assets a
WHERE ads.asset_id = a.id
  AND ads.organization_id IS NULL;

-- ============================================================
-- SECTION 8 : RPC create_loan
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_loan(
  p_lender_name text,
  p_principal_xaf bigint,
  p_interest_rate numeric DEFAULT 0,
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT NULL,
  p_loan_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_principal_xaf <= 0 THEN
    RAISE EXCEPTION 'principal_xaf must be positive';
  END IF;
  IF p_interest_rate < 0 THEN
    RAISE EXCEPTION 'interest_rate cannot be negative';
  END IF;
  IF trim(p_lender_name) = '' THEN
    RAISE EXCEPTION 'lender_name is required';
  END IF;

  INSERT INTO public.loans(
    organization_id, lender_name, loan_reference,
    principal_xaf, outstanding_principal_xaf,
    interest_rate, start_date, end_date, notes, created_by
  ) VALUES (
    get_my_org_id(), p_lender_name, p_loan_reference,
    p_principal_xaf, p_principal_xaf,
    p_interest_rate, p_start_date, p_end_date, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_loan(text, bigint, numeric, date, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_loan(text, bigint, numeric, date, date, text, text) TO authenticated;

-- ============================================================
-- SECTION 9 : RPC record_loan_repayment
-- Phase 3C : idempotency_key + SELECT FOR UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION public.record_loan_repayment(
  p_loan_id uuid,
  p_total_amount_xaf bigint,
  p_principal_xaf bigint,
  p_interest_xaf bigint,
  p_fees_xaf bigint,
  p_repayment_date date,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- Phase 3C : vérification idempotence avant tout verrouillage
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.loan_repayments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      RETURN v_existing_id;  -- idempotent : retour sans effet
    END IF;
  END IF;

  -- Phase 3C : verrouillage pour sérialiser les accès concurrents
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan % not found or access denied', p_loan_id;
  END IF;

  IF v_loan.status != 'active' THEN
    RAISE EXCEPTION 'Loan % is not active (status: %)', p_loan_id, v_loan.status;
  END IF;

  -- Validations montants
  IF p_total_amount_xaf <= 0 THEN
    RAISE EXCEPTION 'total_amount_xaf must be positive';
  END IF;

  IF p_principal_xaf + p_interest_xaf + p_fees_xaf != p_total_amount_xaf THEN
    RAISE EXCEPTION 'Total % != principal % + interest % + fees %',
      p_total_amount_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf;
  END IF;

  IF p_principal_xaf > v_loan.outstanding_principal_xaf THEN
    RAISE EXCEPTION 'Principal % exceeds outstanding %',
      p_principal_xaf, v_loan.outstanding_principal_xaf;
  END IF;

  -- Insertion
  INSERT INTO public.loan_repayments(
    organization_id, loan_id, idempotency_key,
    total_amount_xaf, principal_xaf, interest_xaf, fees_xaf,
    repayment_date, notes, created_by
  ) VALUES (
    get_my_org_id(), p_loan_id, p_idempotency_key,
    p_total_amount_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf,
    p_repayment_date, p_notes, auth.uid()
  ) RETURNING id INTO v_new_id;

  -- Mise à jour solde
  UPDATE public.loans
  SET
    outstanding_principal_xaf = outstanding_principal_xaf - p_principal_xaf,
    status = CASE
      WHEN outstanding_principal_xaf - p_principal_xaf <= 0 THEN 'paid_off'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE id = p_loan_id;

  RETURN v_new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_loan_repayment(uuid, bigint, bigint, bigint, bigint, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment(uuid, bigint, bigint, bigint, bigint, date, text, text) TO authenticated;

-- ============================================================
-- SECTION 10 : RPC create_asset
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_asset(
  p_name text,
  p_category text,
  p_purchase_price_xaf bigint,
  p_useful_life_months integer,
  p_service_start_date date,
  p_residual_value_xaf bigint DEFAULT 0,
  p_asset_code text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_purchase_price_xaf <= 0 THEN
    RAISE EXCEPTION 'purchase_price_xaf must be positive';
  END IF;
  IF p_useful_life_months <= 0 THEN
    RAISE EXCEPTION 'useful_life_months must be positive';
  END IF;
  IF p_residual_value_xaf < 0 THEN
    RAISE EXCEPTION 'residual_value_xaf cannot be negative';
  END IF;
  IF p_residual_value_xaf >= p_purchase_price_xaf THEN
    RAISE EXCEPTION 'residual_value_xaf must be less than purchase_price_xaf';
  END IF;

  INSERT INTO public.assets(
    organization_id, name, asset_code, category,
    purchase_price_xaf, residual_value_xaf, useful_life_months,
    service_start_date, notes, created_by
  ) VALUES (
    get_my_org_id(), p_name, p_asset_code, p_category,
    p_purchase_price_xaf, p_residual_value_xaf, p_useful_life_months,
    p_service_start_date, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_asset(text, text, bigint, integer, date, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_asset(text, text, bigint, integer, date, bigint, text, text) TO authenticated;

-- ============================================================
-- SECTION 11 : RPC compute_depreciation
-- Phase 3C : SELECT FOR UPDATE + ON CONFLICT DO NOTHING
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_depreciation(
  p_asset_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_asset public.assets%ROWTYPE;
  v_depreciable bigint;
  v_monthly_amount bigint;
  v_remainder bigint;
  v_period_date date;
  v_count integer := 0;
  n integer;
BEGIN
  -- Phase 3C : verrouillage pour éviter les recalculs concurrents
  SELECT * INTO v_asset
  FROM public.assets
  WHERE id = p_asset_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset % not found or access denied', p_asset_id;
  END IF;

  IF v_asset.status = 'disposed' THEN
    RAISE EXCEPTION 'Asset % is disposed', p_asset_id;
  END IF;

  v_depreciable := v_asset.purchase_price_xaf - v_asset.residual_value_xaf;
  IF v_depreciable <= 0 THEN
    RAISE EXCEPTION 'Depreciable amount is 0 or negative for asset %', p_asset_id;
  END IF;

  -- Division entière = FLOOR implicite
  v_monthly_amount := v_depreciable / v_asset.useful_life_months;
  -- Dernière période absorbe le reste pour que SUM = depreciable exactement
  v_remainder := v_depreciable - (v_monthly_amount * (v_asset.useful_life_months - 1));

  -- Supprimer uniquement les lignes draft (préserver les posted)
  DELETE FROM public.asset_depreciation_schedules
  WHERE asset_id = p_asset_id AND status = 'draft';

  -- Générer les nouvelles lignes
  FOR n IN 1..v_asset.useful_life_months LOOP
    v_period_date := (v_asset.service_start_date + ((n - 1) * INTERVAL '1 month'))::date;

    INSERT INTO public.asset_depreciation_schedules(
      asset_id, organization_id, period_number, period_date, amount_xaf, status
    ) VALUES (
      v_asset.id,
      v_asset.organization_id,
      n,
      v_period_date,
      CASE WHEN n = v_asset.useful_life_months THEN v_remainder ELSE v_monthly_amount END,
      'draft'
    )
    ON CONFLICT (asset_id, period_number) DO NOTHING;  -- skip posted periods

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_depreciation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_depreciation(uuid) TO authenticated;

-- ============================================================
-- SECTION 12 : RPC create_capital_contribution
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_capital_contribution(
  p_contributor_name text,
  p_amount_xaf bigint,
  p_contribution_type text,
  p_contribution_date date,
  p_journal_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_amount_xaf <= 0 THEN
    RAISE EXCEPTION 'amount_xaf must be positive';
  END IF;
  IF p_contribution_type NOT IN ('cash', 'asset', 'service', 'other') THEN
    RAISE EXCEPTION 'Invalid contribution_type: %', p_contribution_type;
  END IF;
  IF trim(p_contributor_name) = '' THEN
    RAISE EXCEPTION 'contributor_name is required';
  END IF;

  INSERT INTO public.capital_contributions(
    organization_id, contributor_name, amount_xaf, contribution_type,
    contribution_date, journal_reference, notes, created_by
  ) VALUES (
    get_my_org_id(), p_contributor_name, p_amount_xaf, p_contribution_type,
    p_contribution_date, p_journal_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_capital_contribution(text, bigint, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_capital_contribution(text, bigint, text, date, text, text) TO authenticated;

-- ============================================================
-- SECTION 13 : RPC create_reserve_movement
-- Phase 3C : SECURITY DEFINER bypasse RLS (aucune policy INSERT)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_reserve_movement(
  p_reserve_id uuid,
  p_movement_type text,
  p_amount_xaf bigint,
  p_movement_date date,
  p_reason text,
  p_source_type text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reserve public.reserves%ROWTYPE;
  v_id uuid;
  v_delta bigint;
BEGIN
  IF p_movement_type NOT IN ('allocation', 'usage', 'reconstitution', 'cancellation') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;
  IF p_amount_xaf <= 0 THEN
    RAISE EXCEPTION 'amount_xaf must be positive';
  END IF;
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  -- Verrouillage pour éviter les races sur le solde
  SELECT * INTO v_reserve
  FROM public.reserves
  WHERE id = p_reserve_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserve % not found or access denied', p_reserve_id;
  END IF;

  IF p_movement_type IN ('usage', 'cancellation') THEN
    IF p_amount_xaf > v_reserve.current_balance_xaf THEN
      RAISE EXCEPTION 'Insufficient reserve balance: requested % > available %',
        p_amount_xaf, v_reserve.current_balance_xaf;
    END IF;
  END IF;

  INSERT INTO public.reserve_movements(
    reserve_id, movement_type, amount_xaf, movement_date, reason,
    source_type, source_id, created_by
  ) VALUES (
    p_reserve_id, p_movement_type, p_amount_xaf, p_movement_date, p_reason,
    p_source_type, p_source_id, auth.uid()
  ) RETURNING id INTO v_id;

  v_delta := CASE p_movement_type
    WHEN 'allocation'     THEN  p_amount_xaf
    WHEN 'reconstitution' THEN  p_amount_xaf
    WHEN 'usage'          THEN -p_amount_xaf
    WHEN 'cancellation'   THEN -p_amount_xaf
  END;

  UPDATE public.reserves
  SET current_balance_xaf = current_balance_xaf + v_delta,
      updated_at = now()
  WHERE id = p_reserve_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_reserve_movement(uuid, text, bigint, date, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reserve_movement(uuid, text, bigint, date, text, text, uuid) TO authenticated;

-- ============================================================
-- SECTION 14 : RPC create_journal_entry
-- Phase 3C : >= 2 lignes, account_id validé, équilibre exact
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_line jsonb;
  v_account_id uuid;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_period_id uuid;
  v_reference text;
BEGIN
  -- Phase 3C : minimum 2 lignes
  IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least 2 lines, got %',
      COALESCE(jsonb_array_length(p_lines), 0);
  END IF;

  -- Phase 3C : période ouverte (organization_id NULLABLE en DB)
  SELECT id INTO v_period_id
  FROM public.financial_periods
  WHERE (organization_id IS NULL OR organization_id = get_my_org_id())
    AND p_entry_date BETWEEN starts_at AND ends_at
    AND status != 'closed'
  ORDER BY organization_id NULLS LAST
  LIMIT 1;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open financial period for date %', p_entry_date;
  END IF;

  -- Phase 3C : validation account_id + accumulation totaux
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_account_id := (v_line->>'account_id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts
      WHERE id = v_account_id
        AND organization_id = get_my_org_id()
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid or inactive account_id: %', v_account_id;
    END IF;

    v_total_debit  := v_total_debit  + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;

  -- Phase 3C : équilibre EXACT (sans ROUND)
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Unbalanced entry: debit=% credit=%',
      v_total_debit, v_total_credit;
  END IF;

  -- Référence unique auto-générée
  v_reference := 'JE-' || to_char(now(), 'YYYYMMDD') || '-'
              || upper(substr(gen_random_uuid()::text, 1, 8));

  INSERT INTO public.journal_entries(
    organization_id, reference, description, entry_date, status, created_by
  ) VALUES (
    get_my_org_id(), v_reference, p_description, p_entry_date, 'draft', auth.uid()
  ) RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_lines(
      entry_id, account_id, description, debit, credit
    ) VALUES (
      v_id,
      (v_line->>'account_id')::uuid,
      v_line->>'description',
      COALESCE((v_line->>'debit')::numeric, 0),
      COALESCE((v_line->>'credit')::numeric, 0)
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_journal_entry(date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(date, text, jsonb) TO authenticated;

-- ============================================================
-- SECTION 15 : VUES (security_invoker = true)
-- ============================================================

CREATE OR REPLACE VIEW public.v_loans WITH (security_invoker = true) AS
SELECT
  l.id,
  l.organization_id,
  l.lender_name,
  l.loan_reference,
  l.principal_xaf,
  l.outstanding_principal_xaf,
  l.interest_rate,
  l.start_date,
  l.end_date,
  l.status,
  COALESCE(
    (SELECT SUM(r.total_amount_xaf) FROM public.loan_repayments r WHERE r.loan_id = l.id),
    0
  )::bigint AS total_repaid_xaf,
  l.created_at
FROM public.loans l;

REVOKE ALL ON public.v_loans FROM anon;
GRANT SELECT ON public.v_loans TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_assets WITH (security_invoker = true) AS
SELECT
  a.id,
  a.organization_id,
  a.name,
  a.asset_code,
  a.category,
  a.purchase_price_xaf,
  a.residual_value_xaf,
  a.useful_life_months,
  a.depreciation_rate,
  a.service_start_date,
  a.disposal_date,
  a.status,
  COALESCE(
    (SELECT SUM(d.amount_xaf) FROM public.asset_depreciation_schedules d
     WHERE d.asset_id = a.id AND d.status = 'posted'),
    0
  )::bigint AS total_depreciated_xaf,
  (a.purchase_price_xaf - a.residual_value_xaf -
    COALESCE(
      (SELECT SUM(d.amount_xaf) FROM public.asset_depreciation_schedules d
       WHERE d.asset_id = a.id AND d.status = 'posted'),
      0
    )
  )::bigint AS current_book_value_xaf,
  a.created_at
FROM public.assets a;

REVOKE ALL ON public.v_assets FROM anon;
GRANT SELECT ON public.v_assets TO authenticated, service_role;

CREATE OR REPLACE VIEW public.v_reserves WITH (security_invoker = true) AS
SELECT
  r.id,
  r.organization_id,
  r.name,
  r.reserve_type,
  r.current_balance_xaf,
  r.target_xaf,
  r.description,
  (SELECT MAX(m.movement_date)
   FROM public.reserve_movements m
   WHERE m.reserve_id = r.id
     AND m.movement_type IN ('allocation', 'reconstitution')
     AND m.cancelled_at IS NULL
  ) AS last_allocation_date,
  r.created_at
FROM public.reserves r;

REVOKE ALL ON public.v_reserves FROM anon;
GRANT SELECT ON public.v_reserves TO authenticated, service_role;

-- ============================================================
-- FIN MIGRATION 054_FINAL
-- ============================================================

COMMIT;
