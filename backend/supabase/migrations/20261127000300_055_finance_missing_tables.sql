-- Migration 055 : Tables manquantes Finance + vues + fonctions RPC
-- Débloque : FinanceAssets, FinanceLoans, FinanceCapital, FinanceReserves, FinanceDepreciation

-- ─── 1. TABLES ───────────────────────────────────────────────────────────────

-- 1a. assets (Immobilisations)
CREATE TABLE IF NOT EXISTS public.assets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_number         text NOT NULL,
  name                 text NOT NULL,
  asset_category       text NOT NULL DEFAULT 'other',
  acquisition_cost_xaf bigint NOT NULL DEFAULT 0,
  residual_value_xaf   bigint NOT NULL DEFAULT 0,
  acquisition_date     date NOT NULL,
  useful_life_months   integer NOT NULL DEFAULT 36,
  status               text NOT NULL DEFAULT 'active',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assets_status_check CHECK (status IN ('active','disposed','fully_depreciated')),
  CONSTRAINT assets_category_check CHECK (asset_category IN ('it_equipment','office_equipment','furniture','vehicle','other'))
);

-- 1b. asset_depreciation_entries (journal amortissements)
CREATE TABLE IF NOT EXISTS public.asset_depreciation_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id            uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  financial_period_id uuid REFERENCES public.financial_periods(id),
  depreciation_xaf    bigint NOT NULL DEFAULT 0,
  idempotency_key     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, idempotency_key)
);

-- 1c. loans (Emprunts)
CREATE TABLE IF NOT EXISTS public.loans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_number     text NOT NULL,
  lender          text NOT NULL,
  loan_type       text NOT NULL DEFAULT 'other',
  principal_xaf   bigint NOT NULL,
  rate_pct        numeric(5,2) NOT NULL DEFAULT 0,
  disbursed_at    date NOT NULL,
  due_date        date,
  status          text NOT NULL DEFAULT 'active',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loans_type_check CHECK (loan_type IN ('bank','personal','supplier','other')),
  CONSTRAINT loans_status_check CHECK (status IN ('active','closed','defaulted'))
);

-- 1d. loan_repayments (Remboursements)
CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  loan_id         uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  total_xaf       bigint NOT NULL,
  principal_xaf   bigint NOT NULL DEFAULT 0,
  interest_xaf    bigint NOT NULL DEFAULT 0,
  fees_xaf        bigint NOT NULL DEFAULT 0,
  method          text NOT NULL DEFAULT 'cash',
  paid_at         date NOT NULL DEFAULT CURRENT_DATE,
  idempotency_key text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 1e. capital_contributions (Apports en capital)
CREATE TABLE IF NOT EXISTS public.capital_contributions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contributor_name text NOT NULL,
  contribution_type text NOT NULL DEFAULT 'cash',
  amount_xaf       bigint NOT NULL,
  contributed_at   date NOT NULL DEFAULT CURRENT_DATE,
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 1f. reserves (Réserves)
CREATE TABLE IF NOT EXISTS public.reserves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  reserve_type    text NOT NULL DEFAULT 'other',
  balance_xaf     bigint NOT NULL DEFAULT 0,
  target_xaf      bigint,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserves_type_check CHECK (reserve_type IN ('stock','equipment','security','development','other'))
);

-- 1g. allocation_rules (Règles d'affectation aux réserves)
CREATE TABLE IF NOT EXISTS public.allocation_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  reserve_id      uuid NOT NULL REFERENCES public.reserves(id) ON DELETE CASCADE,
  percentage      numeric(5,2) NOT NULL,
  source_type     text NOT NULL DEFAULT 'manual',
  is_active       boolean NOT NULL DEFAULT true,
  effective_from  date NOT NULL DEFAULT CURRENT_DATE,
  effective_to    date,
  CONSTRAINT alloc_pct_check CHECK (percentage > 0 AND percentage <= 100),
  CONSTRAINT alloc_source_check CHECK (source_type IN ('sale_margin','momo_commission','manual'))
);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.assets                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_depreciation_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_contributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserves                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocation_rules            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.assets                     USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.asset_depreciation_entries USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.loans                      USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.loan_repayments            USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.capital_contributions      USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.reserves                   USING (organization_id = get_my_org_id());
CREATE POLICY "org_isolation" ON public.allocation_rules           USING (organization_id = get_my_org_id());

-- ─── 3. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_assets_org         ON public.assets(organization_id);
CREATE INDEX IF NOT EXISTS idx_adep_asset         ON public.asset_depreciation_entries(asset_id);
CREATE INDEX IF NOT EXISTS idx_loans_org          ON public.loans(organization_id);
CREATE INDEX IF NOT EXISTS idx_repay_loan         ON public.loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_capital_org        ON public.capital_contributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_reserves_org       ON public.reserves(organization_id);
CREATE INDEX IF NOT EXISTS idx_alloc_reserve      ON public.allocation_rules(reserve_id);

-- ─── 4. VUES ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_assets WITH (security_invoker = true) AS
SELECT
  a.id,
  a.asset_number,
  a.name,
  a.asset_category,
  a.acquisition_cost_xaf,
  a.residual_value_xaf,
  a.acquisition_date::text AS acquisition_date,
  a.useful_life_months,
  a.status,
  a.notes,
  COALESCE((
    SELECT SUM(d.depreciation_xaf)
    FROM public.asset_depreciation_entries d
    WHERE d.asset_id = a.id
  ), 0)::bigint AS accumulated_depreciation_xaf,
  GREATEST(
    a.acquisition_cost_xaf - COALESCE((
      SELECT SUM(d.depreciation_xaf) FROM public.asset_depreciation_entries d WHERE d.asset_id = a.id
    ), 0),
    a.residual_value_xaf
  )::bigint AS book_value_xaf
FROM public.assets a;

CREATE OR REPLACE VIEW public.v_loans WITH (security_invoker = true) AS
SELECT
  l.id,
  l.loan_number,
  l.lender,
  l.loan_type,
  l.principal_xaf,
  l.rate_pct,
  l.disbursed_at::text AS disbursed_at,
  l.due_date::text     AS due_date,
  l.status,
  COALESCE((
    SELECT SUM(r.principal_xaf) FROM public.loan_repayments r WHERE r.loan_id = l.id
  ), 0)::bigint AS repaid_principal_xaf,
  GREATEST(l.principal_xaf - COALESCE((
    SELECT SUM(r.principal_xaf) FROM public.loan_repayments r WHERE r.loan_id = l.id
  ), 0), 0)::bigint AS outstanding_xaf,
  COALESCE((
    SELECT SUM(r.interest_xaf) FROM public.loan_repayments r WHERE r.loan_id = l.id
  ), 0)::bigint AS total_interest_paid_xaf
FROM public.loans l;

CREATE OR REPLACE VIEW public.v_capital_contributions WITH (security_invoker = true) AS
SELECT id, contributor_name, contribution_type, amount_xaf, contributed_at::text, description, created_at::text
FROM public.capital_contributions;

CREATE OR REPLACE VIEW public.v_reserves WITH (security_invoker = true) AS
SELECT id, name, reserve_type, balance_xaf, target_xaf, is_active
FROM public.reserves;

-- ─── 5. FONCTIONS RPC ────────────────────────────────────────────────────────

-- create_asset
CREATE OR REPLACE FUNCTION public.create_asset(
  p_name text, p_asset_category text, p_acquisition_cost_xaf bigint,
  p_acquisition_date date, p_useful_life_months integer,
  p_residual_value_xaf bigint DEFAULT 0, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org  uuid := get_my_org_id();
  v_id   uuid := gen_random_uuid();
  v_num  text;
BEGIN
  v_num := 'IM-' || to_char(now(), 'YY') || '-' || lpad(
    (SELECT COUNT(*)+1 FROM public.assets WHERE organization_id = v_org)::text, 4, '0');
  INSERT INTO public.assets(id, organization_id, asset_number, name, asset_category,
    acquisition_cost_xaf, residual_value_xaf, acquisition_date, useful_life_months, notes)
  VALUES (v_id, v_org, v_num, p_name, p_asset_category,
    p_acquisition_cost_xaf, p_residual_value_xaf, p_acquisition_date, p_useful_life_months, p_notes);
  RETURN v_id;
END;$$;

-- compute_depreciation (linéaire mensuelle)
CREATE OR REPLACE FUNCTION public.compute_depreciation(
  p_period_id uuid, p_idempotency_key_prefix text DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org  uuid := get_my_org_id();
  v_cnt  int  := 0;
  r      record;
  v_dep  bigint;
  v_key  text;
BEGIN
  FOR r IN SELECT * FROM public.assets WHERE organization_id = v_org AND status = 'active' LOOP
    v_dep := GREATEST(0, (r.acquisition_cost_xaf - r.residual_value_xaf) / NULLIF(r.useful_life_months, 0));
    v_key := COALESCE(p_idempotency_key_prefix, '') || r.id::text || p_period_id::text;
    INSERT INTO public.asset_depreciation_entries(organization_id, asset_id, financial_period_id, depreciation_xaf, idempotency_key)
    VALUES (v_org, r.id, p_period_id, v_dep, v_key)
    ON CONFLICT (asset_id, idempotency_key) DO NOTHING;
    GET DIAGNOSTICS v_cnt = v_cnt + ROW_COUNT;
  END LOOP;
  RETURN v_cnt;
END;$$;

-- create_loan
CREATE OR REPLACE FUNCTION public.create_loan(
  p_lender text, p_loan_type text, p_principal_xaf bigint,
  p_rate_pct numeric DEFAULT 0, p_disbursed_at date DEFAULT CURRENT_DATE,
  p_due_date date DEFAULT NULL, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := get_my_org_id();
  v_id  uuid := gen_random_uuid();
  v_num text;
BEGIN
  v_num := 'LN-' || to_char(now(), 'YY') || '-' || lpad(
    (SELECT COUNT(*)+1 FROM public.loans WHERE organization_id = v_org)::text, 3, '0');
  INSERT INTO public.loans(id, organization_id, loan_number, lender, loan_type, principal_xaf,
    rate_pct, disbursed_at, due_date, notes)
  VALUES (v_id, v_org, v_num, p_lender, p_loan_type, p_principal_xaf,
    p_rate_pct, p_disbursed_at, p_due_date, p_notes);
  RETURN v_id;
END;$$;

-- record_loan_repayment
CREATE OR REPLACE FUNCTION public.record_loan_repayment(
  p_loan_id uuid, p_total_xaf bigint, p_principal_xaf bigint DEFAULT 0,
  p_interest_xaf bigint DEFAULT 0, p_fees_xaf bigint DEFAULT 0,
  p_method text DEFAULT 'cash', p_paid_at date DEFAULT CURRENT_DATE,
  p_idempotency_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := get_my_org_id();
  v_id  uuid := gen_random_uuid();
  v_outstanding bigint;
BEGIN
  INSERT INTO public.loan_repayments(id, organization_id, loan_id, total_xaf, principal_xaf,
    interest_xaf, fees_xaf, method, paid_at, idempotency_key)
  VALUES (v_id, v_org, p_loan_id, p_total_xaf, p_principal_xaf,
    p_interest_xaf, p_fees_xaf, p_method, p_paid_at, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT outstanding_xaf INTO v_outstanding FROM public.v_loans WHERE id = p_loan_id;
  IF v_outstanding <= 0 THEN
    UPDATE public.loans SET status = 'closed' WHERE id = p_loan_id;
  END IF;
  RETURN v_id;
END;$$;

-- allocate_margin
CREATE OR REPLACE FUNCTION public.allocate_margin(
  p_source_type text, p_source_id uuid, p_margin_xaf bigint,
  p_financial_period_id uuid DEFAULT NULL, p_idempotency_key text DEFAULT NULL
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := get_my_org_id();
  v_cnt int  := 0;
  r     record;
  v_alloc bigint;
BEGIN
  FOR r IN
    SELECT ar.reserve_id, ar.percentage
    FROM public.allocation_rules ar
    WHERE ar.organization_id = v_org
      AND ar.is_active = true
      AND ar.source_type = p_source_type
      AND ar.effective_from <= CURRENT_DATE
      AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
  LOOP
    v_alloc := (p_margin_xaf * r.percentage / 100)::bigint;
    UPDATE public.reserves SET balance_xaf = balance_xaf + v_alloc WHERE id = r.reserve_id;
    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;$$;

-- ─── 6. GRANTS ───────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.assets                     TO authenticated;
GRANT SELECT, INSERT         ON public.asset_depreciation_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.loans                      TO authenticated;
GRANT SELECT, INSERT         ON public.loan_repayments            TO authenticated;
GRANT SELECT, INSERT         ON public.capital_contributions      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reserves                   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.allocation_rules           TO authenticated;

GRANT SELECT ON public.v_assets                 TO authenticated, anon, service_role;
GRANT SELECT ON public.v_loans                  TO authenticated, anon, service_role;
GRANT SELECT ON public.v_capital_contributions  TO authenticated, anon, service_role;
GRANT SELECT ON public.v_reserves               TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.create_asset               TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_depreciation       TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan                TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment      TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_margin            TO authenticated;
