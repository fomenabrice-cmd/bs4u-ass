# FINANCE_PHASE3C_JOURNAL_VALIDATION
_Règles de validation des écritures comptables — Phase 3C — Généré le 2026-11-27_

---

## Corrections Phase 3C vs Phase 3B

### 1. Équilibre : ROUND supprimé

**Phase 3B (incorrect) :**
```sql
IF ROUND(v_total_debit, 0) <> ROUND(v_total_credit, 0) THEN
  RAISE EXCEPTION ...
END IF;
```

**Problème :** `ROUND(1000.4, 0) = ROUND(1000.6, 0) = 1000` — une écriture déséquilibrée de 0.2 XAF passe la validation. Dans le contexte FCFA (entiers), la différence est moins fréquente mais le principe est invalide : le ROUND masque une erreur.

**Phase 3C (correct) :**
```sql
IF v_total_debit <> v_total_credit THEN
  RAISE EXCEPTION 'Unbalanced entry: debit=% credit=%', v_total_debit, v_total_credit;
END IF;
```

**Justification :** `debit` et `credit` sont `numeric` (précision arbitraire) en PostgreSQL. La comparaison `=` sur `numeric` est exacte. Pas de perte de précision en virgule flottante.

### 2. Minimum 2 lignes

**Phase 3B :** Pas de validation sur le nombre de lignes.

**Phase 3C :**
```sql
IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
  RAISE EXCEPTION 'Journal entry requires at least 2 lines, got %',
    COALESCE(jsonb_array_length(p_lines), 0);
END IF;
```

**Justification :** La comptabilité en partie double exige au minimum un débit et un crédit sur des comptes différents. Une écriture à une ligne ne peut pas être équilibrée (sauf si debit=credit=0, ce qui est sans sens).

### 3. Validation de account_id

**Phase 3B :** `account_id` inséré sans vérification — peut référencer un compte inexistant ou appartenant à une autre organisation.

**Phase 3C :**
```sql
-- Dans la boucle sur p_lines
v_account_id := (v_line->>'account_id')::uuid;

IF NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts
  WHERE id = v_account_id
    AND organization_id = get_my_org_id()
    AND is_active = true
) THEN
  RAISE EXCEPTION 'Invalid or inactive account_id: %', v_account_id;
END IF;
```

**Colonnes confirmées en DB :**
- `chart_of_accounts.id` : uuid NOT NULL
- `chart_of_accounts.organization_id` : uuid NOT NULL
- `chart_of_accounts.is_active` : boolean NOT NULL

### 4. Période ouverte — organization_id nullable

**Constat DB :** `financial_periods.organization_id` est NULLABLE.

**Phase 3B :**
```sql
WHERE organization_id = get_my_org_id()
  AND ...
```
Problème : ne trouve pas les périodes globales (organization_id IS NULL).

**Phase 3C :**
```sql
WHERE (organization_id IS NULL OR organization_id = get_my_org_id())
  AND p_entry_date BETWEEN starts_at AND ends_at
  AND status != 'closed'
ORDER BY organization_id NULLS LAST  -- préférer les périodes spécifiques à l'org
LIMIT 1;
```

---

## RPC `create_journal_entry` — Phase 3C final

```sql
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
  -- 1. Minimum 2 lignes
  IF p_lines IS NULL OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least 2 lines, got %',
      COALESCE(jsonb_array_length(p_lines), 0);
  END IF;

  -- 2. Vérification période ouverte (organization_id nullable en DB)
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

  -- 3. Validation de chaque ligne + accumulation totaux
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_account_id := (v_line->>'account_id')::uuid;

    -- Vérification compte actif dans l'org
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

  -- 4. Équilibre EXACT (sans ROUND)
  IF v_total_debit <> v_total_credit THEN
    RAISE EXCEPTION 'Unbalanced entry: debit=% credit=%',
      v_total_debit, v_total_credit;
  END IF;

  -- 5. Génération référence unique
  v_reference := 'JE-' || to_char(now(), 'YYYYMMDD') || '-'
              || upper(substr(gen_random_uuid()::text, 1, 8));

  -- 6. Création de l'écriture
  INSERT INTO public.journal_entries(
    organization_id, reference, description, entry_date, status, created_by
  ) VALUES (
    get_my_org_id(), v_reference, p_description, p_entry_date, 'draft', auth.uid()
  ) RETURNING id INTO v_id;

  -- 7. Création des lignes
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
```

---

## Matrice de validation

| Validation | Condition | Exception |
|-----------|-----------|-----------|
| Lignes minimum | `jsonb_array_length(p_lines) >= 2` | "requires at least 2 lines" |
| Période ouverte | `financial_periods WHERE ... AND status != 'closed'` | "No open financial period" |
| account_id valide | `chart_of_accounts WHERE id = ? AND org = ? AND is_active` | "Invalid or inactive account_id" |
| Équilibre exact | `v_total_debit = v_total_credit` (numeric exact) | "Unbalanced entry: debit=X credit=Y" |

---

## Colonnes DB confirmées utilisées

| Table | Colonne | Type | Phase 3C |
|-------|---------|------|---------|
| `chart_of_accounts` | `id` | uuid NOT NULL | ✅ Validé |
| `chart_of_accounts` | `organization_id` | uuid NOT NULL | ✅ Validé |
| `chart_of_accounts` | `is_active` | boolean NOT NULL | ✅ Validé |
| `financial_periods` | `organization_id` | uuid **NULLABLE** | ✅ Corrigé |
| `financial_periods` | `status` | text (pas enum) | ✅ Validé |
| `financial_periods` | `starts_at` / `ends_at` | date | ✅ Validé |
| `journal_entries` | `reference` | text NOT NULL | ✅ Auto-généré |
| `journal_lines` | `account_id` | uuid NOT NULL | ✅ Validé |
| `journal_lines` | `debit` / `credit` | numeric | ✅ Exact |
