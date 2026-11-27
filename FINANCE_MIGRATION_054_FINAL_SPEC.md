# FINANCE_MIGRATION_054_FINAL_SPEC
_Spécification finale corrigée — Phase 3B — 2026-11-27_

## Corrections vs spec initiale

| Point | Spec initiale (erronée) | Spec finale (corrigée) |
|-------|------------------------|------------------------|
| `asset_depreciation_schedules` colonnes INSERT | `year`, `depreciation_xaf`, `cumulative_xaf` | `period_number`, `period_date`, `amount_xaf` |
| `journal_lines` clé de compte | `account_code text` | `account_id uuid` |
| `create_journal_entry` p_lines | `{"account_code":"...", "debit":..}` | `{"account_id":"uuid","debit":..}` |
| `compute_depreciation` logique suppression | DELETE toutes les lignes existantes | DELETE uniquement les lignes non-posted |
| Modèle `loans` | `outstanding_xaf` unique | `outstanding_principal_xaf` + `loan_repayments` détaillé |
| Modèle `reserves` | Table seule | Table + `reserve_movements` pour l'audit trail |
| `asset_depreciation_schedules` RLS | Add org_id column | Déjà dans migration 053b (prérequis) |

---

## Prérequis

- Migration 053 FINAL appliquée
- Migration 053b (sécurité) appliquée (ajoute `organization_id` sur `asset_depreciation_schedules`)

---

## Schéma complet de la migration 054

### 1. Table `loans`

```sql
CREATE TABLE public.loans (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             uuid NOT NULL REFERENCES public.organizations(id),
  creditor_name               text NOT NULL,
  principal_xaf               bigint NOT NULL CHECK (principal_xaf > 0),
  outstanding_principal_xaf   bigint NOT NULL CHECK (outstanding_principal_xaf >= 0),
  interest_rate               numeric(5,4) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  start_date                  date NOT NULL,
  end_date                    date,
  term_months                 integer CHECK (term_months > 0),
  status                      text NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','paid_off','defaulted')),
  notes                       text,
  created_at                  timestamptz DEFAULT now(),
  CONSTRAINT outstanding_lte_principal
    CHECK (outstanding_principal_xaf <= principal_xaf)
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY loans_access ON public.loans FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 2. Table `loan_repayments`

```sql
CREATE TABLE public.loan_repayments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           uuid NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
  total_amount_xaf  bigint NOT NULL CHECK (total_amount_xaf > 0),
  principal_xaf     bigint NOT NULL CHECK (principal_xaf >= 0),
  interest_xaf      bigint NOT NULL CHECK (interest_xaf >= 0),
  fees_xaf          bigint NOT NULL DEFAULT 0 CHECK (fees_xaf >= 0),
  payment_date      date NOT NULL,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  CONSTRAINT parts_sum CHECK (principal_xaf + interest_xaf + fees_xaf = total_amount_xaf)
);

ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_repayments_access ON public.loan_repayments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l
    WHERE l.id = loan_id AND l.organization_id = get_my_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans l
    WHERE l.id = loan_id AND l.organization_id = get_my_org_id()
  ));
```

### 3. Table `capital_contributions`

```sql
CREATE TABLE public.capital_contributions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id),
  contributor_name    text NOT NULL,
  amount_xaf          bigint NOT NULL CHECK (amount_xaf > 0),
  contribution_date   date NOT NULL,
  type                text NOT NULL
                        CHECK (type IN ('cash','equipment','property','other')),
  reference           text,
  justification_url   text,
  notes               text,
  cancelled_at        timestamptz,
  cancelled_by        uuid REFERENCES auth.users(id),
  cancel_reason       text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY capital_contributions_access ON public.capital_contributions FOR ALL TO authenticated
  USING (organization_id = get_my_org_id() AND cancelled_at IS NULL)
  WITH CHECK (organization_id = get_my_org_id());
```

### 4. Table `assets`

```sql
CREATE TABLE public.assets (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  name                  text NOT NULL,
  category              text NOT NULL
                          CHECK (category IN ('equipment','vehicle','building','software','other')),
  purchase_date         date NOT NULL,
  service_start_date    date,
  purchase_price_xaf    bigint NOT NULL CHECK (purchase_price_xaf > 0),
  residual_value_xaf    bigint NOT NULL DEFAULT 0 CHECK (residual_value_xaf >= 0),
  useful_life_months    integer NOT NULL CHECK (useful_life_months > 0),
  depreciation_method   text NOT NULL DEFAULT 'straight_line'
                          CHECK (depreciation_method = 'straight_line'),
  depreciation_rate     numeric GENERATED ALWAYS AS
                          (ROUND(100.0 * 12 / useful_life_months, 2)) STORED,
  disposal_date         date,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','disposed','fully_depreciated')),
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT residual_lt_purchase CHECK (residual_value_xaf < purchase_price_xaf)
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_access ON public.assets FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 5. Table `reserves`

```sql
CREATE TABLE public.reserves (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  name                  text NOT NULL,
  current_balance_xaf   bigint NOT NULL DEFAULT 0 CHECK (current_balance_xaf >= 0),
  target_xaf            bigint CHECK (target_xaf > 0),
  reserve_type          text NOT NULL
                          CHECK (reserve_type IN ('legal','statutory','voluntary','contingency')),
  description           text,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserves_access ON public.reserves FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 6. Table `reserve_movements`

```sql
CREATE TABLE public.reserve_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserve_id      uuid NOT NULL REFERENCES public.reserves(id) ON DELETE RESTRICT,
  movement_type   text NOT NULL
                    CHECK (movement_type IN ('allocation','usage','reconstitution','cancellation')),
  amount_xaf      bigint NOT NULL CHECK (amount_xaf > 0),
  movement_date   date NOT NULL,
  reason          text NOT NULL,
  source_type     text,
  source_id       uuid,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  cancelled_at    timestamptz,
  cancelled_by    uuid REFERENCES auth.users(id),
  cancel_reason   text
);

ALTER TABLE public.reserve_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserve_movements_access ON public.reserve_movements FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reserves r
    WHERE r.id = reserve_id AND r.organization_id = get_my_org_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.reserves r
    WHERE r.id = reserve_id AND r.organization_id = get_my_org_id()
  ));
```

### 7. Colonne `status` sur `asset_depreciation_schedules`

```sql
ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','posted'));
-- Les lignes existantes reçoivent 'draft' par défaut
```

---

## Vues corrigées

### `v_loans`

```sql
CREATE OR REPLACE VIEW public.v_loans WITH (security_invoker = true) AS
SELECT
  l.id, l.creditor_name, l.principal_xaf,
  l.outstanding_principal_xaf   AS outstanding_xaf,
  l.interest_rate,
  l.start_date::text            AS start_date,
  l.end_date::text              AS end_date,
  l.status, l.notes,
  COALESCE(r.total_repaid, 0)   AS total_repaid_xaf,
  COALESCE(r.total_interest, 0) AS total_interest_paid_xaf
FROM public.loans l
LEFT JOIN (
  SELECT loan_id,
    SUM(principal_xaf) AS total_repaid,
    SUM(interest_xaf)  AS total_interest
  FROM public.loan_repayments
  GROUP BY loan_id
) r ON r.loan_id = l.id;

GRANT SELECT ON public.v_loans TO authenticated, anon, service_role;
```

### `v_capital_contributions`

```sql
CREATE OR REPLACE VIEW public.v_capital_contributions WITH (security_invoker = true) AS
SELECT id, contributor_name, amount_xaf,
  contribution_date::text AS contribution_date,
  type, reference, notes
FROM public.capital_contributions
WHERE cancelled_at IS NULL;

GRANT SELECT ON public.v_capital_contributions TO authenticated, anon, service_role;
```

### `v_assets`

```sql
CREATE OR REPLACE VIEW public.v_assets WITH (security_invoker = true) AS
SELECT
  a.id, a.name, a.category,
  a.purchase_date::text          AS purchase_date,
  a.purchase_price_xaf,
  GREATEST(
    a.purchase_price_xaf - COALESCE(d.cumul, 0),
    a.residual_value_xaf
  )                              AS current_value_xaf,
  a.depreciation_rate,
  a.status
FROM public.assets a
LEFT JOIN (
  SELECT asset_id, SUM(amount_xaf) AS cumul
  FROM public.asset_depreciation_schedules
  WHERE status = 'posted'
  GROUP BY asset_id
) d ON d.asset_id = a.id;

GRANT SELECT ON public.v_assets TO authenticated, anon, service_role;
```

### `v_reserves`

```sql
CREATE OR REPLACE VIEW public.v_reserves WITH (security_invoker = true) AS
SELECT
  r.id, r.name, r.current_balance_xaf, r.target_xaf,
  r.reserve_type, r.description,
  m.last_alloc_date AS last_allocation_date
FROM public.reserves r
LEFT JOIN (
  SELECT reserve_id, MAX(movement_date)::text AS last_alloc_date
  FROM public.reserve_movements
  WHERE movement_type IN ('allocation','reconstitution') AND cancelled_at IS NULL
  GROUP BY reserve_id
) m ON m.reserve_id = r.id;

GRANT SELECT ON public.v_reserves TO authenticated, anon, service_role;
```

---

## RPCs corrigées

### `create_loan`

```sql
CREATE OR REPLACE FUNCTION public.create_loan(
  p_creditor_name text,
  p_principal_xaf bigint,
  p_interest_rate numeric,
  p_start_date date,
  p_end_date date DEFAULT NULL,
  p_term_months integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_principal_xaf <= 0 THEN
    RAISE EXCEPTION 'principal_xaf must be positive';
  END IF;
  IF p_interest_rate < 0 THEN
    RAISE EXCEPTION 'interest_rate must be >= 0';
  END IF;
  INSERT INTO public.loans(
    organization_id, creditor_name, principal_xaf, outstanding_principal_xaf,
    interest_rate, start_date, end_date, term_months
  )
  VALUES (
    get_my_org_id(), p_creditor_name, p_principal_xaf, p_principal_xaf,
    p_interest_rate, p_start_date, p_end_date, p_term_months
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_loan TO authenticated;
```

### `record_loan_repayment`

```sql
CREATE OR REPLACE FUNCTION public.record_loan_repayment(
  p_loan_id uuid,
  p_total_amount_xaf bigint,
  p_principal_xaf bigint,
  p_interest_xaf bigint,
  p_fees_xaf bigint DEFAULT 0,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_loan public.loans%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_loan FROM public.loans
  WHERE id = p_loan_id AND organization_id = get_my_org_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found or access denied'; END IF;
  IF v_loan.status != 'active' THEN RAISE EXCEPTION 'Loan is not active (status: %)', v_loan.status; END IF;
  IF p_principal_xaf + p_interest_xaf + p_fees_xaf != p_total_amount_xaf THEN
    RAISE EXCEPTION 'Parts sum (% + % + %) != total (%)',
      p_principal_xaf, p_interest_xaf, p_fees_xaf, p_total_amount_xaf;
  END IF;
  IF p_principal_xaf > v_loan.outstanding_principal_xaf THEN
    RAISE EXCEPTION 'Principal % exceeds outstanding %',
      p_principal_xaf, v_loan.outstanding_principal_xaf;
  END IF;

  INSERT INTO public.loan_repayments(
    loan_id, total_amount_xaf, principal_xaf, interest_xaf, fees_xaf, payment_date, notes
  ) VALUES (
    p_loan_id, p_total_amount_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf,
    p_payment_date, p_notes
  ) RETURNING id INTO v_id;

  UPDATE public.loans SET
    outstanding_principal_xaf = outstanding_principal_xaf - p_principal_xaf,
    status = CASE WHEN outstanding_principal_xaf - p_principal_xaf = 0 THEN 'paid_off' ELSE status END
  WHERE id = p_loan_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment TO authenticated;
```

### `create_asset`

```sql
CREATE OR REPLACE FUNCTION public.create_asset(
  p_name text,
  p_category text,
  p_purchase_date date,
  p_purchase_price_xaf bigint,
  p_useful_life_months integer,
  p_residual_value_xaf bigint DEFAULT 0,
  p_service_start_date date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_purchase_price_xaf <= 0 THEN RAISE EXCEPTION 'purchase_price must be positive'; END IF;
  IF p_useful_life_months <= 0 THEN RAISE EXCEPTION 'useful_life_months must be positive'; END IF;
  IF p_residual_value_xaf >= p_purchase_price_xaf THEN
    RAISE EXCEPTION 'residual_value must be < purchase_price';
  END IF;
  INSERT INTO public.assets(
    organization_id, name, category, purchase_date, service_start_date,
    purchase_price_xaf, residual_value_xaf, useful_life_months
  )
  VALUES (
    get_my_org_id(), p_name, p_category, p_purchase_date,
    COALESCE(p_service_start_date, p_purchase_date),
    p_purchase_price_xaf, p_residual_value_xaf, p_useful_life_months
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_asset TO authenticated;
```

### `compute_depreciation` (colonnes réelles)

```sql
CREATE OR REPLACE FUNCTION public.compute_depreciation(p_asset_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_asset public.assets%ROWTYPE;
  n integer;
  v_period_date date;
  v_base bigint;
  v_monthly bigint;
  v_remainder bigint;
BEGIN
  SELECT * INTO v_asset FROM public.assets
  WHERE id = p_asset_id AND organization_id = get_my_org_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found or access denied'; END IF;

  v_base    := v_asset.purchase_price_xaf - v_asset.residual_value_xaf;
  v_monthly := v_base / v_asset.useful_life_months;  -- FLOOR implicite (bigint)
  v_remainder := v_base - (v_monthly * v_asset.useful_life_months);

  -- Supprimer uniquement les lignes draft (préserver les posted)
  DELETE FROM public.asset_depreciation_schedules
  WHERE asset_id = p_asset_id
    AND COALESCE(status, 'draft') = 'draft';

  FOR n IN 1..v_asset.useful_life_months LOOP
    v_period_date := DATE_TRUNC('month',
      COALESCE(v_asset.service_start_date, v_asset.purchase_date)
    )::date + ((n - 1) * INTERVAL '1 month');

    INSERT INTO public.asset_depreciation_schedules(
      asset_id, organization_id, period_number, period_date, amount_xaf, status
    ) VALUES (
      p_asset_id,
      v_asset.organization_id,
      n,
      v_period_date,
      -- Dernière période absorbe le reste pour éviter VNC négative
      CASE WHEN n = v_asset.useful_life_months THEN v_monthly + v_remainder ELSE v_monthly END,
      'draft'
    )
    ON CONFLICT DO NOTHING;  -- protection si la ligne posted existe déjà
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_depreciation TO authenticated;
```

### `create_journal_entry`

Voir `FINANCE_RPC_SECURITY_MATRIX.md` section create_journal_entry.  
Point clé : `account_id` est **uuid** (pas `account_code` text).
