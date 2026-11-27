# FINANCE_PHASE3C_RESERVE_INTEGRITY
_Intégrité du grand livre des réserves — Phase 3C — Généré le 2026-11-27_

---

## Principe fondamental

Les `reserve_movements` sont un **grand livre immutable**. Chaque mouvement est définitif. Une annulation crée un mouvement contraire, jamais une suppression ou une modification.

---

## Vecteurs d'attaque bloqués

### Vecteur 1 : INSERT direct contournant le RPC

```sql
-- Utilisateur authentifié tente d'insérer directement
INSERT INTO public.reserve_movements(reserve_id, movement_type, amount_xaf, ...)
VALUES ('uuid', 'allocation', 1000000, ...);
```

**Sans protection :** réussit si une policy INSERT existe pour `authenticated`.

**Avec protection Phase 3C :** Aucune policy INSERT pour `authenticated`. PostgreSQL retourne :
```
ERROR: new row violates row-level security policy for table "reserve_movements"
```

Le RPC `create_reserve_movement` est `SECURITY DEFINER` et bypasse RLS — il peut insérer même sans policy.

### Vecteur 2 : UPDATE direct sur un mouvement

```sql
UPDATE public.reserve_movements
SET amount_xaf = 1
WHERE id = 'uuid_mouvement_couteux';
```

**Protection :** Aucune policy UPDATE pour `authenticated`.

### Vecteur 3 : DELETE direct

```sql
DELETE FROM public.reserve_movements WHERE id = 'uuid';
```

**Protection :** Aucune policy DELETE pour `authenticated`.

### Vecteur 4 : Solde négatif via usage excessif

```sql
SELECT create_reserve_movement(
  'uuid_reserve', 'usage', 999999999, CURRENT_DATE, 'Pillage'
);
```

**Protection dans le RPC :**
```sql
IF p_movement_type IN ('usage', 'cancellation') THEN
  IF p_amount_xaf > v_reserve.current_balance_xaf THEN
    RAISE EXCEPTION 'Insufficient reserve balance: requested % > available %',
      p_amount_xaf, v_reserve.current_balance_xaf;
  END IF;
END IF;
```

---

## RLS complet pour `reserve_movements`

```sql
ALTER TABLE public.reserve_movements ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement les mouvements des réserves de l'org
CREATE POLICY rm_select ON public.reserve_movements
  FOR SELECT TO authenticated
  USING (
    reserve_id IN (
      SELECT id FROM public.reserves
      WHERE organization_id = get_my_org_id()
    )
  );

-- PAS de policy INSERT, UPDATE, DELETE pour authenticated
-- INSERT uniquement via create_reserve_movement (SECURITY DEFINER)
```

---

## RPC `create_reserve_movement` — logique complète

```sql
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
  -- 1. Validation du type
  IF p_movement_type NOT IN ('allocation', 'usage', 'reconstitution', 'cancellation') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;

  -- 2. Validation du montant
  IF p_amount_xaf <= 0 THEN
    RAISE EXCEPTION 'amount_xaf must be positive, got %', p_amount_xaf;
  END IF;

  -- 3. Validation du motif
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason is required';
  END IF;

  -- 4. Verrouillage de la réserve
  SELECT * INTO v_reserve
  FROM public.reserves
  WHERE id = p_reserve_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserve % not found or access denied', p_reserve_id;
  END IF;

  -- 5. Validation du solde pour usage/cancellation
  IF p_movement_type IN ('usage', 'cancellation') THEN
    IF p_amount_xaf > v_reserve.current_balance_xaf THEN
      RAISE EXCEPTION 'Insufficient reserve balance: requested % > available %',
        p_amount_xaf, v_reserve.current_balance_xaf;
    END IF;
  END IF;

  -- 6. Insertion du mouvement
  INSERT INTO public.reserve_movements(
    reserve_id, movement_type, amount_xaf, movement_date, reason,
    source_type, source_id, created_by
  ) VALUES (
    p_reserve_id, p_movement_type, p_amount_xaf, p_movement_date, p_reason,
    p_source_type, p_source_id, auth.uid()
  ) RETURNING id INTO v_id;

  -- 7. Mise à jour du solde
  v_delta := CASE p_movement_type
    WHEN 'allocation'    THEN  p_amount_xaf
    WHEN 'reconstitution' THEN p_amount_xaf
    WHEN 'usage'         THEN -p_amount_xaf
    WHEN 'cancellation'  THEN -p_amount_xaf
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
```

---

## Invariants garantis

| Invariant | Mécanisme de garantie |
|-----------|----------------------|
| `current_balance_xaf >= 0` | Validation avant usage/cancellation |
| Mouvements immutables | Aucune policy UPDATE/DELETE |
| `amount_xaf > 0` | CHECK dans table + validation RPC |
| `reason` non vide | Validation RPC |
| `organization_id` cohérent | SELECT FOR UPDATE sur reserves (get_my_org_id()) |
| INSERT uniquement via RPC | Pas de policy INSERT authenticated |

---

## Annulation d'un mouvement

La table `reserve_movements` a les colonnes `cancelled_at`, `cancelled_by`, `cancel_reason`. Une annulation n'efface pas le mouvement — elle le marque annulé et crée un mouvement de type `cancellation`.

```sql
-- L'annulation est implémentée comme update de cancelled_at + nouveau mouvement
-- La column cancelled_at sur reserve_movements est mise à jour par le RPC
-- Le nouveau mouvement de type 'cancellation' inverse l'effet comptable
```

Cette logique est à implémenter dans `create_reserve_movement` via un paramètre `p_original_movement_id uuid DEFAULT NULL` si l'annulation est requise dans Phase 4.
