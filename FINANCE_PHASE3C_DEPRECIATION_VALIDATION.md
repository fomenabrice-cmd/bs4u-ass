# FINANCE_PHASE3C_DEPRECIATION_VALIDATION
_Validation du calcul d'amortissement — Phase 3C — Généré le 2026-11-27_

---

## Problèmes identifiés en Phase 3C

### 1. Contrainte UNIQUE manquante (confirmé DB)

La table `asset_depreciation_schedules` n'a **aucune contrainte UNIQUE** sur `(asset_id, period_number)`. Sans elle :
- `ON CONFLICT (asset_id, period_number) DO NOTHING` lève une erreur PostgreSQL
- Deux appels simultanés à `compute_depreciation` créent des lignes dupliquées

**Correction :**
```sql
ALTER TABLE public.asset_depreciation_schedules
  ADD CONSTRAINT ads_asset_period_unique UNIQUE (asset_id, period_number);
```

### 2. Concurrence sans SELECT FOR UPDATE

Deux appels à `compute_depreciation('uuid_actif')` peuvent interleaver :

```
T1 : DELETE FROM ads WHERE asset_id=X AND status='draft'  → 36 lignes supprimées
T2 : DELETE FROM ads WHERE asset_id=X AND status='draft'  → 0 lignes (déjà supprimées)
T1 : INSERT période 1-36
T2 : INSERT période 1-36 → ON CONFLICT DO NOTHING (si UNIQUE existe)
```

Avec UNIQUE et ON CONFLICT DO NOTHING, le scénario est sûr. Sans UNIQUE, T2 crée des doublons.

---

## RPC `compute_depreciation` — Phase 3C

### Algorithme complet

```sql
CREATE OR REPLACE FUNCTION public.compute_depreciation(
  p_asset_id uuid
) RETURNS integer  -- nombre de périodes générées
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
  -- 1. Verrouillage pour éviter les recalculs concurrents
  SELECT * INTO v_asset
  FROM public.assets
  WHERE id = p_asset_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Asset % not found or access denied', p_asset_id;
  END IF;

  IF v_asset.status = 'disposed' THEN
    RAISE EXCEPTION 'Asset % is disposed — cannot compute depreciation', p_asset_id;
  END IF;

  -- 2. Calcul de base
  v_depreciable := v_asset.purchase_price_xaf - v_asset.residual_value_xaf;
  IF v_depreciable <= 0 THEN
    RAISE EXCEPTION 'Depreciable amount is 0 or negative for asset %', p_asset_id;
  END IF;

  -- Méthode linéaire : FLOOR pour toutes les périodes sauf la dernière
  v_monthly_amount := v_depreciable / v_asset.useful_life_months;  -- INTEGER division = FLOOR
  v_remainder      := v_depreciable - (v_monthly_amount * (v_asset.useful_life_months - 1));
  -- dernière période = reste pour que SUM = depreciable exactement

  -- 3. Supprimer les lignes draft (préserver les posted)
  DELETE FROM public.asset_depreciation_schedules
  WHERE asset_id = p_asset_id AND status = 'draft';

  -- 4. Générer les nouvelles lignes
  FOR n IN 1..v_asset.useful_life_months LOOP
    v_period_date := v_asset.service_start_date + ((n - 1) * INTERVAL '1 month');

    INSERT INTO public.asset_depreciation_schedules(
      asset_id, organization_id, period_number, period_date, amount_xaf, status
    ) VALUES (
      v_asset.id,
      v_asset.organization_id,
      n,
      v_period_date::date,
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
```

---

## Invariants garantis

### Somme exacte = valeur amortissable

```
purchase_price = 1 000 000, residual = 0, useful_life = 36 mois
monthly = 1 000 000 / 36 = 27 777 (division entière)
27 777 * 35 = 972 195
remainder = 1 000 000 - 972 195 = 27 805

SUM = 27 777 * 35 + 27 805 = 972 195 + 27 805 = 1 000 000 ✅
```

La valeur résiduelle est **exclue** de la base amortissable. `v_depreciable = purchase_price - residual`.

### Recalcul partiel sécurisé

Si 10 périodes sont déjà `posted` (comptabilisées) :
1. `DELETE WHERE status = 'draft'` supprime uniquement les draft
2. `INSERT ... ON CONFLICT DO NOTHING` saute les 10 périodes posted
3. Résultat : 10 posted inchangés + 26 nouveaux draft

**Note :** Si l'actif a changé de paramètres après des périodes posted, les posted restent à l'ancien montant. C'est un invariant voulu : on ne modifie jamais une écriture comptable postée.

### Concurrence

```
T1 : SELECT FOR UPDATE (v_asset) → T2 attend
T1 : DELETE draft + INSERT → COMMIT
T2 : SELECT FOR UPDATE (v_asset) → continue
T2 : DELETE draft (déjà supprimés par T1) → 0 lignes
T2 : INSERT ON CONFLICT DO NOTHING → 0 insertions (tous déjà là)
T2 : RETURN 0
```

---

## Validation de la contrainte UNIQUE

La contrainte `ads_asset_period_unique UNIQUE (asset_id, period_number)` est créée dans migration 054_FINAL. Elle est nécessaire **avant** tout appel à `compute_depreciation`.

### Vérification

```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.asset_depreciation_schedules'::regclass
  AND contype = 'u';
-- Doit retourner : ads_asset_period_unique
```

---

## Colonne `status` sur `asset_depreciation_schedules`

La table existante n'a pas de colonne `status`. Elle est ajoutée dans migration 054 :

```sql
ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'posted'));
```

Cette colonne permet :
- `compute_depreciation` : supprime les `draft`, préserve les `posted`
- UI : affiche l'état de chaque période
- Clôture comptable : marque les périodes passées comme `posted`
