# FINANCE_PHASE3C_RPC_SECURITY
_Matrice de sécurité des RPCs Finance — Phase 3C — Généré le 2026-11-27_

---

## Corrections Phase 3C vs Phase 3B

| Élément | Phase 3B | Phase 3C | Raison |
|---------|----------|---------|--------|
| Helpers PUBLIC | GRANT PUBLIC (hérité) | REVOKE + GRANT anon + authenticated | Scope trop large |
| `set_momo_capital` | PUBLIC + authenticated | authenticated seulement | Pas d'accès anon |
| `create_journal_entry` : équilibre | `ROUND(debit, 0) = ROUND(credit, 0)` | `debit = credit` exact | ROUND masque déséquilibre |
| `create_journal_entry` : lignes | Pas de min | `>= 2 lignes` | Partie double exige ≥ 2 |
| `create_journal_entry` : account_id | Non validé | Vérifié dans chart_of_accounts | Injection compte tiers |
| `create_journal_entry` : période | `organization_id = get_my_org_id()` | `OR organization_id IS NULL` | organization_id nullable en DB |
| `record_loan_repayment` | Pas d'idempotence | `idempotency_key` UNIQUE | Double soumission = double débit |
| `record_loan_repayment` | Pas de SELECT FOR UPDATE | `SELECT ... FOR UPDATE` sur loans | Race condition concurrente |
| `compute_depreciation` | Pas de SELECT FOR UPDATE | `SELECT ... FOR UPDATE` sur assets | Race condition concurrente |
| `reserve_movements` | Policy INSERT authenticated | Aucune policy INSERT authenticated | INSERT uniquement via RPC SECURITY DEFINER |
| Toutes RPCs Finance | GRANT TO authenticated seulement (spec) | `REVOKE FROM PUBLIC` explicite avant GRANT | REVOKE non présent en 3B |

---

## Règle universelle Phase 3C

Chaque nouvelle RPC Finance doit respecter :

```sql
-- Template obligatoire
REVOKE EXECUTE ON FUNCTION public.<nom_rpc>(<params>) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.<nom_rpc>(<params>) TO authenticated;
```

Le `REVOKE FROM PUBLIC` est nécessaire même si la fonction vient d'être créée (PostgreSQL 14+ accorde `EXECUTE TO PUBLIC` par défaut sur les nouvelles fonctions).

---

## `create_journal_entry` — Phase 3C

### Paramètres

```sql
CREATE OR REPLACE FUNCTION public.create_journal_entry(
  p_entry_date date,
  p_description text,
  p_lines jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

**Note :** Le paramètre `p_reference` est supprimé — la référence est générée automatiquement avec `'JE-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 8)` pour garantir l'unicité.

### Validations Phase 3C (dans l'ordre)

1. **Tableau minimum 2 lignes**
   ```sql
   IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
     RAISE EXCEPTION 'Journal entry requires at least 2 lines, got %',
       COALESCE(jsonb_array_length(p_lines), 0);
   END IF;
   ```

2. **Période ouverte** (avec organization_id nullable)
   ```sql
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
   ```

3. **Validation account_id dans chart_of_accounts**
   ```sql
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
   ```

4. **Équilibre exact (SANS ROUND)**
   ```sql
   IF v_total_debit <> v_total_credit THEN
     RAISE EXCEPTION 'Unbalanced entry: debit=% credit=%',
       v_total_debit, v_total_credit;
   END IF;
   ```

   **Justification :** `debit` et `credit` sont de type `numeric` (précision arbitraire). La comparaison `v_total_debit = v_total_credit` est exacte. ROUND(x, 0) permettrait à une écriture déséquilibrée de passer si la différence est < 0.5 XAF.

---

## `record_loan_repayment` — Phase 3C

### Paramètres

```sql
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
```

### Mécanisme idempotence

```sql
-- 1. Vérifier idempotency_key avant tout
IF p_idempotency_key IS NOT NULL THEN
  SELECT id INTO v_existing_id
  FROM public.loan_repayments
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing_id;
  END IF;
END IF;

-- 2. Verrouiller le prêt (empêche race condition)
SELECT * INTO v_loan
FROM public.loans
WHERE id = p_loan_id
  AND organization_id = get_my_org_id()
FOR UPDATE;
```

**Propriété :** Deux appels simultanés avec le même `idempotency_key` retournent le même ID sans créer de doublon. Sans `idempotency_key`, le SELECT FOR UPDATE sérialise les accès.

---

## `compute_depreciation` — Phase 3C

```sql
-- Verrouillage de l'actif avant calcul
SELECT * INTO v_asset
FROM public.assets
WHERE id = p_asset_id
  AND organization_id = get_my_org_id()
FOR UPDATE;

-- Suppression des draft seulement (posted conservés)
DELETE FROM public.asset_depreciation_schedules
WHERE asset_id = p_asset_id AND status = 'draft';

-- Insertion avec ON CONFLICT (requiert UNIQUE sur (asset_id, period_number))
INSERT INTO public.asset_depreciation_schedules(
  asset_id, organization_id, period_number, period_date, amount_xaf, status
)
VALUES (v_asset.id, v_asset.organization_id, n, v_period_date, v_amount, 'draft')
ON CONFLICT (asset_id, period_number) DO NOTHING;
```

**Note :** `ON CONFLICT DO NOTHING` ne fonctionne que si la contrainte `UNIQUE (asset_id, period_number)` existe. Sans elle, PostgreSQL lève une erreur. Cette contrainte est créée dans 054_FINAL.

---

## `create_reserve_movement` — Phase 3C

**Mécanisme d'intégrité :** Le RPC est SECURITY DEFINER. Aucune policy INSERT n'est accordée à `authenticated` sur `reserve_movements`. Toute tentative d'INSERT direct échoue avec RLS violation.

```sql
-- Réserve appartient bien à l'org
SELECT * INTO v_reserve
FROM public.reserves
WHERE id = p_reserve_id
  AND organization_id = get_my_org_id()
FOR UPDATE;

-- Validation solde pour usage
IF p_movement_type IN ('usage', 'cancellation') THEN
  IF p_amount_xaf > v_reserve.current_balance_xaf THEN
    RAISE EXCEPTION 'Insufficient reserve balance: requested % > available %',
      p_amount_xaf, v_reserve.current_balance_xaf;
  END IF;
END IF;
```

---

## Matrice des grants Phase 3C

| Fonction | PUBLIC avant | PUBLIC après | anon | authenticated |
|----------|-------------|-------------|------|--------------|
| `get_my_org_id` | ✅ GRANT | REVOKE | ✅ GRANT | ✅ GRANT |
| `get_my_establishment_id` | ✅ GRANT | REVOKE | ✅ GRANT | ✅ GRANT |
| `is_admin` | ✅ GRANT | REVOKE | ✅ GRANT | ✅ GRANT |
| `can_access_establishment` | ✅ GRANT | REVOKE | ✅ GRANT | ✅ GRANT |
| `set_momo_capital` | ✅ GRANT | REVOKE | — | ✅ GRANT |
| `create_journal_entry` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `create_loan` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `record_loan_repayment` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `create_asset` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `compute_depreciation` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `create_capital_contribution` | REVOKE (nouveau) | — | — | ✅ GRANT |
| `create_reserve_movement` | REVOKE (nouveau) | — | — | ✅ GRANT |
