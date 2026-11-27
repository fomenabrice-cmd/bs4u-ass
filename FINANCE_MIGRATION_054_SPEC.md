# FINANCE_MIGRATION_054_SPEC
_Spécification migration 054 — Capital, Réserves, Immobilisations, Amortissements, Emprunts_  
_Généré le 2026-11-27 — À VALIDER AVANT APPLICATION_

**Règle absolue** : Ce fichier est une spécification. Aucune migration ne doit être appliquée sans autorisation écrite préalable.

---

## Contexte

5 pages Finance sont bloquées en état stub car les tables sous-jacentes n'existent pas en DB. Cette migration crée les tables, vues, RPCs et corrections RLS nécessaires.

---

## État existant utilisable

### Tables existantes (ne pas recréer)

| Table | Statut | Usage dans 054 |
|-------|--------|----------------|
| `asset_depreciation_schedules` | ✅ Existe | Plans d'amortissement — ajouter `organization_id` + RLS |
| `allocation_rules` | ✅ Existe | Règles d'allocation réserves — déjà utilisé par reserveService |
| `financial_periods` | ✅ Existe | Référence pour périodes dans les vues |

### Colonnes attendues par les services (à respecter impérativement)

Les services `capitalService.ts`, `assetService.ts`, `reserveService.ts` définissent les colonnes attendues via les schémas Zod dans `types.ts`. Les vues DOIVENT retourner exactement ces colonnes.

**v_loans** (capitalService.ts attend) :
```typescript
{ id, creditor_name, principal_xaf, outstanding_xaf, interest_rate,
  start_date, end_date, status, notes? }
```

**v_capital_contributions** (capitalService.ts attend) :
```typescript
{ id, contributor_name, amount_xaf, contribution_date, type, notes? }
```

**v_assets** (assetService.ts attend) :
```typescript
{ id, name, category, purchase_date, purchase_price_xaf,
  current_value_xaf, depreciation_rate, status }
```

**v_reserves** (reserveService.ts attend) :
```typescript
{ id, name, current_balance_xaf, target_xaf, reserve_type,
  description?, last_allocation_date? }
```

---

## Tables à créer

### 1. `loans` — Emprunts

```sql
CREATE TABLE public.loans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL REFERENCES public.organizations(id),
  creditor_name      text NOT NULL,
  principal_xaf      bigint NOT NULL CHECK (principal_xaf > 0),
  outstanding_xaf    bigint NOT NULL,
  interest_rate      numeric(5,2) NOT NULL DEFAULT 0,
  start_date         date NOT NULL,
  end_date           date,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','paid_off','defaulted')),
  notes              text,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_org_isolation ON public.loans
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 2. `loan_repayments` — Historique remboursements

```sql
CREATE TABLE public.loan_repayments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount_xaf      bigint NOT NULL CHECK (amount_xaf > 0),
  payment_date    date NOT NULL,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

-- Isolation via loan (pas d'organization_id direct — join requis dans policy)
CREATE POLICY loan_repayments_isolation ON public.loan_repayments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loans l
    WHERE l.id = loan_id AND l.organization_id = get_my_org_id()
  ));
```

### 3. `capital_contributions` — Apports en capital

```sql
CREATE TABLE public.capital_contributions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id),
  contributor_name    text NOT NULL,
  amount_xaf          bigint NOT NULL CHECK (amount_xaf > 0),
  contribution_date   date NOT NULL,
  type                text NOT NULL
                        CHECK (type IN ('cash','equipment','property','other')),
  notes               text,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY capital_contributions_org ON public.capital_contributions
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 4. `assets` — Immobilisations

```sql
CREATE TABLE public.assets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES public.organizations(id),
  name                 text NOT NULL,
  category             text NOT NULL
                         CHECK (category IN ('equipment','vehicle','building','software','other')),
  purchase_date        date NOT NULL,
  purchase_price_xaf   bigint NOT NULL CHECK (purchase_price_xaf > 0),
  current_value_xaf    bigint NOT NULL,
  depreciation_rate    numeric(5,2) NOT NULL DEFAULT 20.0,
  status               text NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','disposed','fully_depreciated')),
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_org_isolation ON public.assets
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

### 5. `reserves` — Réserves financières

```sql
CREATE TABLE public.reserves (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id),
  name                  text NOT NULL,
  current_balance_xaf   bigint NOT NULL DEFAULT 0,
  target_xaf            bigint,
  reserve_type          text NOT NULL
                          CHECK (reserve_type IN ('legal','statutory','voluntary','contingency')),
  description           text,
  last_allocation_date  date,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserves_org_isolation ON public.reserves
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

---

## Correction RLS sur table existante

### `asset_depreciation_schedules` — Ajout isolation organisation

```sql
-- CRITIQUE-1 de FINANCE_PHASE3A_SECURITY_AUDIT.md
ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Backfill depuis assets (si assets vient d'être créé dans cette même migration)
-- UPDATE public.asset_depreciation_schedules ads
-- SET organization_id = a.organization_id
-- FROM public.assets a WHERE a.id = ads.asset_id;

DROP POLICY IF EXISTS authenticated_read ON public.asset_depreciation_schedules;

CREATE POLICY ads_org_isolation ON public.asset_depreciation_schedules
  FOR ALL TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());
```

---

## Vues à créer

### `v_loans`

```sql
CREATE OR REPLACE VIEW public.v_loans WITH (security_invoker = true) AS
SELECT
  l.id, l.creditor_name, l.principal_xaf,
  l.outstanding_xaf, l.interest_rate,
  l.start_date::text AS start_date,
  l.end_date::text AS end_date,
  l.status, l.notes
FROM public.loans l;

GRANT SELECT ON public.v_loans TO authenticated, anon, service_role;
```

### `v_capital_contributions`

```sql
CREATE OR REPLACE VIEW public.v_capital_contributions WITH (security_invoker = true) AS
SELECT
  id, contributor_name, amount_xaf,
  contribution_date::text AS contribution_date,
  type, notes
FROM public.capital_contributions;

GRANT SELECT ON public.v_capital_contributions TO authenticated, anon, service_role;
```

### `v_assets`

```sql
CREATE OR REPLACE VIEW public.v_assets WITH (security_invoker = true) AS
SELECT
  id, name, category,
  purchase_date::text AS purchase_date,
  purchase_price_xaf, current_value_xaf,
  depreciation_rate, status
FROM public.assets;

GRANT SELECT ON public.v_assets TO authenticated, anon, service_role;
```

### `v_reserves`

```sql
CREATE OR REPLACE VIEW public.v_reserves WITH (security_invoker = true) AS
SELECT
  id, name, current_balance_xaf, target_xaf,
  reserve_type, description,
  last_allocation_date::text AS last_allocation_date
FROM public.reserves;

GRANT SELECT ON public.v_reserves TO authenticated, anon, service_role;
```

---

## RPCs à créer

### `create_loan`

```sql
CREATE OR REPLACE FUNCTION public.create_loan(
  p_creditor_name text,
  p_principal_xaf bigint,
  p_interest_rate numeric,
  p_start_date date,
  p_end_date date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.loans(organization_id, creditor_name, principal_xaf, outstanding_xaf, interest_rate, start_date, end_date)
  VALUES (get_my_org_id(), p_creditor_name, p_principal_xaf, p_principal_xaf, p_interest_rate, p_start_date, p_end_date)
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
  p_amount_xaf bigint,
  p_payment_date date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Vérifie que le loan appartient à l'org de l'appelant
  IF NOT EXISTS (SELECT 1 FROM public.loans WHERE id = p_loan_id AND organization_id = get_my_org_id()) THEN
    RAISE EXCEPTION 'Loan not found or access denied';
  END IF;

  INSERT INTO public.loan_repayments(loan_id, amount_xaf, payment_date)
  VALUES (p_loan_id, p_amount_xaf, p_payment_date);

  -- Met à jour le solde restant
  UPDATE public.loans
  SET outstanding_xaf = GREATEST(0, outstanding_xaf - p_amount_xaf),
      status = CASE WHEN outstanding_xaf - p_amount_xaf <= 0 THEN 'paid_off' ELSE status END
  WHERE id = p_loan_id;
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
  p_depreciation_rate numeric DEFAULT 20.0
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.assets(organization_id, name, category, purchase_date, purchase_price_xaf, current_value_xaf, depreciation_rate)
  VALUES (get_my_org_id(), p_name, p_category, p_purchase_date, p_purchase_price_xaf, p_purchase_price_xaf, p_depreciation_rate)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_asset TO authenticated;
```

### `compute_depreciation`

```sql
CREATE OR REPLACE FUNCTION public.compute_depreciation(p_asset_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_asset public.assets%ROWTYPE;
  v_year int;
  v_annual_xaf bigint;
  v_cumulative bigint := 0;
BEGIN
  SELECT * INTO v_asset FROM public.assets
  WHERE id = p_asset_id AND organization_id = get_my_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset not found or access denied';
  END IF;

  -- Amortissement linéaire sur 1/depreciation_rate années
  v_annual_xaf := (v_asset.purchase_price_xaf * v_asset.depreciation_rate / 100)::bigint;

  DELETE FROM public.asset_depreciation_schedules WHERE asset_id = p_asset_id;

  FOR v_year IN 1..CEIL(100.0 / v_asset.depreciation_rate)::int LOOP
    v_cumulative := LEAST(v_cumulative + v_annual_xaf, v_asset.purchase_price_xaf);
    INSERT INTO public.asset_depreciation_schedules(asset_id, organization_id, year, depreciation_xaf, cumulative_xaf)
    VALUES (p_asset_id, v_asset.organization_id,
            EXTRACT(YEAR FROM v_asset.purchase_date)::int + v_year - 1,
            v_annual_xaf, v_cumulative);
    EXIT WHEN v_cumulative >= v_asset.purchase_price_xaf;
  END LOOP;

  -- Met à jour la valeur courante
  UPDATE public.assets SET current_value_xaf = v_asset.purchase_price_xaf - v_cumulative
  WHERE id = p_asset_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_depreciation TO authenticated;
```

### `create_journal_entry`

```sql
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb   -- [{"account_code": "...", "debit": 0, "credit": 1000, "label": "..."}]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_line jsonb;
  v_total_debit bigint := 0;
  v_total_credit bigint := 0;
BEGIN
  -- Vérifie l'équilibre débit/crédit
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_debit  := v_total_debit  + COALESCE((v_line->>'debit')::bigint, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::bigint, 0);
  END LOOP;

  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Journal entry not balanced: debit=% credit=%', v_total_debit, v_total_credit;
  END IF;

  INSERT INTO public.journal_entries(organization_id, entry_date, description, status)
  VALUES (get_my_org_id(), p_entry_date, p_description, 'draft')
  RETURNING id INTO v_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_lines(entry_id, account_code, label, debit, credit)
    VALUES (v_id,
            v_line->>'account_code',
            v_line->>'label',
            COALESCE((v_line->>'debit')::bigint, 0),
            COALESCE((v_line->>'credit')::bigint, 0));
  END LOOP;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_journal_entry TO authenticated;
```

---

## Checklist avant application

- [ ] Vérifier que `journal_lines` a bien les colonnes `account_code`, `label`, `debit`, `credit` (audit avant d'appliquer le RPC `create_journal_entry`)
- [ ] Vérifier que `asset_depreciation_schedules` a les colonnes `asset_id`, `year`, `depreciation_xaf`, `cumulative_xaf` (ajouter `organization_id` dans la migration)
- [ ] Autorisation écrite obtenue pour application en production
- [ ] Migration 053 appliquée préalablement (cette migration dépend des grants existants)
- [ ] Tester sur branche/preview Supabase avant push prod

---

## Impact post-application

| Page | Avant 054 | Après 054 |
|------|-----------|-----------|
| Capital | 🔴 Stub | ✅ Lecture + création contribution |
| Réserves | 🔴 Stub | ✅ Lecture (via reserves table) |
| Immobilisations | 🔴 Stub | ✅ Lecture + création actif |
| Amortissements | 🔴 Stub | ✅ Lecture + calcul amortissement |
| Emprunts | 🔴 Stub | ✅ Lecture + création + remboursement |
| Journal | ⚠️ Lecture OK, mutation bloquée | ✅ Lecture + création écriture |
| asset_depreciation_schedules | 🔴 Fuite inter-org | ✅ Isolation org corrigée |
