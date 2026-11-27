# FINANCE_RPC_SECURITY_MATRIX
_Matrice de sécurité des RPCs Finance — Généré le 2026-11-27_

## Règles générales pour toutes les RPCs Finance

Chaque RPC SECURITY DEFINER doit respecter :

| Règle | Mécanisme |
|-------|-----------|
| `search_path` fixé | `SET search_path TO 'public'` |
| Objets qualifiés | `public.table_name` dans tout le corps |
| Vérification organisation | `organization_id = get_my_org_id()` |
| Montants positifs | `CHECK > 0` ou validation en début de fonction |
| Pas d'accès inter-org | Vérifié avant tout INSERT/UPDATE |
| GRANT EXECUTE minimal | Uniquement `authenticated`, jamais `anon` |

---

## Matrice par RPC

### `create_journal_entry`

| Dimension | Valeur |
|-----------|--------|
| SECURITY DEFINER | Oui |
| Organisation | `get_my_org_id()` injecté sur `journal_entries.organization_id` |
| Paramètres | `p_entry_date date`, `p_description text`, `p_lines jsonb` |
| Structure p_lines | `[{"account_id":"uuid","debit":0,"credit":1000,"description":"..."}]` |
| Validation équilibre | `SUM(debit) = SUM(credit)` — rejeté si ≠ |
| Validation compte | `account_id` doit exister dans `chart_of_accounts` OU être un uuid valide (selon impl.) |
| Période ouverte | `financial_periods WHERE status != 'closed'` contient `entry_date` |
| Immutabilité | Ne peut pas modifier une écriture `posted` ou `reversed` — création uniquement |
| Traçabilité | `created_by = auth.uid()` |
| Idempotence | Non naturelle — l'UI désactive le bouton après envoi |
| GRANT | `authenticated` uniquement |
| ⚠️ Correction spec | `account_id` (uuid) et non `account_code` (text) — `journal_lines.account_id` est uuid |

**Validation des colonnes confirmées** :
- `journal_lines` : `entry_id`, `account_id` (uuid, NOT NULL), `description`, `debit` (numeric), `credit` (numeric), `sort_order`
- `journal_entries` : `organization_id`, `reference` (NOT NULL), `description`, `entry_date` (date), `status` (entry_status enum : draft/posted/reversed)

```sql
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date,
  p_description text,
  p_reference text,
  p_lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_line jsonb;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_period_id uuid;
BEGIN
  -- 1. Vérifier période ouverte
  SELECT id INTO v_period_id
  FROM public.financial_periods
  WHERE organization_id = get_my_org_id()
    AND p_entry_date BETWEEN starts_at AND ends_at
    AND status != 'closed'
  LIMIT 1;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'No open financial period for date %', p_entry_date;
  END IF;

  -- 2. Vérifier l'équilibre
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_total_debit  := v_total_debit  + COALESCE((v_line->>'debit')::numeric, 0);
    v_total_credit := v_total_credit + COALESCE((v_line->>'credit')::numeric, 0);
  END LOOP;

  IF ROUND(v_total_debit, 0) <> ROUND(v_total_credit, 0) THEN
    RAISE EXCEPTION 'Unbalanced entry: debit=% credit=%', v_total_debit, v_total_credit;
  END IF;

  -- 3. Créer l'écriture
  INSERT INTO public.journal_entries(organization_id, reference, description, entry_date, status, created_by)
  VALUES (get_my_org_id(), p_reference, p_description, p_entry_date, 'draft', auth.uid())
  RETURNING id INTO v_id;

  -- 4. Créer les lignes
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_lines(entry_id, account_id, description, debit, credit)
    VALUES (
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
GRANT EXECUTE ON FUNCTION public.create_journal_entry TO authenticated;
```

---

### `create_loan`

| Dimension | Valeur |
|-----------|--------|
| Organisation | Injectée depuis `get_my_org_id()` |
| Validation | `principal_xaf > 0`, `interest_rate >= 0` |
| `outstanding_principal_xaf` | Initialisé = `principal_xaf` |
| Idempotence | Non — l'UI gère |
| GRANT | `authenticated` uniquement |

---

### `record_loan_repayment`

| Dimension | Valeur |
|-----------|--------|
| Vérification org | `loan.organization_id = get_my_org_id()` |
| Vérification statut | `loan.status = 'active'` |
| Équilibre | `p_principal + p_interest + p_fees = p_total` |
| Capacité | `p_principal <= outstanding_principal_xaf` |
| Montants | Tous >= 0, total > 0 |
| Mise à jour | `outstanding -= principal`, status → 'paid_off' si outstanding = 0 |
| GRANT | `authenticated` uniquement |

---

### `create_asset`

| Dimension | Valeur |
|-----------|--------|
| Organisation | Injectée depuis `get_my_org_id()` |
| Validation | `purchase_price_xaf > 0`, `useful_life_months > 0` |
| `residual_value_xaf` | Défaut 0, doit être < `purchase_price_xaf` |
| `depreciation_method` | Défaut 'straight_line', seule méthode Phase 3B |
| `current_value_xaf` | Non stocké — calculé à la demande dans la vue |
| GRANT | `authenticated` uniquement |

---

### `compute_depreciation`

| Dimension | Valeur |
|-----------|--------|
| Vérification org | `asset.organization_id = get_my_org_id()` |
| Colonnes INSERT | `asset_id`, `organization_id`, `period_number`, `period_date`, `amount_xaf` |
| ⚠️ Correction spec | Utilise `period_number`/`period_date`/`amount_xaf` (colonnes réelles), pas `year`/`depreciation_xaf`/`cumulative_xaf` |
| Suppression partielle | Supprime uniquement les lignes sans status `posted` (ajouter colonne `status` sur `asset_depreciation_schedules`) |
| Arrondi | FLOOR sur toutes les périodes, dernière période absorbe le reste |
| GRANT | `authenticated` uniquement |

```sql
-- Signature correcte avec colonnes réelles
INSERT INTO public.asset_depreciation_schedules(
  asset_id, organization_id, period_number, period_date, amount_xaf
) VALUES (
  v_asset.id, v_asset.organization_id, n, v_period_date, v_amount
);
```

---

### `create_capital_contribution`

| Dimension | Valeur |
|-----------|--------|
| Organisation | Injectée |
| Validation | `amount_xaf > 0`, `type` dans liste valide |
| Annulation | Soft-cancel via `cancelled_at` — pas de DELETE |
| Traçabilité | `created_by = auth.uid()` |
| GRANT | `authenticated` uniquement |

---

## Droits refusés

| Rôle | Raison |
|------|--------|
| `anon` | Aucun accès aux RPCs Finance |
| `service_role` | Via console uniquement, jamais via code applicatif |
| `public` | Interdit — uniquement `authenticated` |

## Résumé des grants

```sql
GRANT EXECUTE ON FUNCTION public.create_journal_entry TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loan TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_loan_repayment TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_asset TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_depreciation TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_capital_contribution TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_reserve_movement TO authenticated;
```
