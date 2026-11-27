# FINANCE_PHASE3B_SECURITY_FIXES
_Corrections de sécurité P0 — Généré le 2026-11-27_

## Périmètre

Trois anomalies critiques identifiées en Phase 3A. Ce document détaille les corrections, leur justification, et le SQL préparé.  
**Aucune correction n'est appliquée en production dans cette phase.**

---

## P0-1 : `asset_depreciation_schedules` — Fuite inter-organisations

### Diagnostic confirmé

```
policyname: authenticated_read
qual: (auth.role() = 'authenticated')
roles: {public}
```

Aucune colonne `organization_id` sur la table. Tout utilisateur authentifié lit tous les plans d'amortissement de toutes les organisations.

La colonne `asset_id` est nullable et sans contrainte FK — des lignes orphelines existent potentiellement.

### Correction préparée

Fichier : `20261127000200_053b_security_fixes.sql` (section P0-1)

```sql
-- Étape 1 : Ajouter organization_id (nullable pour préserver données existantes)
ALTER TABLE public.asset_depreciation_schedules
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Étape 2 : Supprimer la policy permissive
DROP POLICY IF EXISTS authenticated_read ON public.asset_depreciation_schedules;

-- Étape 3 : Créer policies correctes
-- SELECT : uniquement les lignes de sa propre organisation
CREATE POLICY ads_select ON public.asset_depreciation_schedules
  FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_my_org_id());

-- INSERT : uniquement dans sa propre organisation
CREATE POLICY ads_insert ON public.asset_depreciation_schedules
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_my_org_id());

-- UPDATE : uniquement ses données
CREATE POLICY ads_update ON public.asset_depreciation_schedules
  FOR UPDATE TO authenticated
  USING (organization_id = get_my_org_id())
  WITH CHECK (organization_id = get_my_org_id());

-- DELETE : uniquement ses données
CREATE POLICY ads_delete ON public.asset_depreciation_schedules
  FOR DELETE TO authenticated
  USING (organization_id = get_my_org_id());
```

### Traitement des lignes orphelines

Les lignes existantes avec `asset_id IS NULL` ou sans `organization_id` après migration :
- Restent en base (aucun DROP, aucun DELETE)
- Sont invisibles pour tous les utilisateurs org-scoped (policy `ads_select` requiert `organization_id IS NOT NULL`)
- Un super_admin peut les traiter via service_role
- **Règle : ne jamais attribuer arbitrairement une organisation à une ligne orpheline**

Le backfill sera effectué uniquement après création de la table `assets` (migration 054), via :
```sql
-- À exécuter APRÈS migration 054 seulement (table assets existante)
UPDATE public.asset_depreciation_schedules ads
SET organization_id = a.organization_id
FROM public.assets a
WHERE ads.asset_id = a.id
  AND ads.organization_id IS NULL;
```

---

## P0-2 : `can_access_establishment()` — Bypass multi-agence

### Diagnostic confirmé

```sql
-- Code actuel (BUGUÉ)
SELECT
  is_admin()
  OR get_my_establishment_id() IS NULL   -- BUG : user sans agence = voit tout
  OR get_my_establishment_id() = p_establishment_id
  OR p_establishment_id IS NULL;         -- BUG : données sans agence = visibles à tous
```

`get_my_establishment_id()` retourne `profiles.establishment_id` via `auth.uid()`. Si NULL (utilisateur siège), la clause `OR ... IS NULL` retourne TRUE pour TOUT paramètre.

### Comportement actuel des policies affectées

**`expenses`** :
- `expenses_select` (SELECT) : `organization_id = get_my_org_id()` — donne accès à TOUTES les dépenses org
- `expenses_agency` (SELECT) : `can_access_establishment(establishment_id)` — OR-combiné avec expenses_select
- Résultat : expenses_select gagne toujours → expenses_agency n'est jamais restrictive

**`mobile_money_transactions`** :
- `mm_transactions_select` (SELECT) : `organization_id = get_my_org_id()`
- `momo_tx_agency` (SELECT) : `can_access_establishment(establishment_id)`
- Même problème : mm_transactions_select donne accès org-wide

### Règles requises (spec Phase 3B)

| Profil utilisateur | Doit voir |
|-------------------|-----------|
| `is_admin()` | Toutes les données de son organisation |
| Avec `establishment_id` | Uniquement les données de son établissement |
| Sans `establishment_id` (siège) | Uniquement les données sans établissement (org-wide) |
| Données sans `establishment_id` | Visibles uniquement aux admins et utilisateurs siège |

### Correction préparée

#### 1. Nouvelle fonction `can_access_establishment()`

```sql
CREATE OR REPLACE FUNCTION public.can_access_establishment(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Administrateur : accès complet à l'organisation
    is_admin()
    OR (
      -- Utilisateur avec établissement : voit uniquement le sien
      get_my_establishment_id() IS NOT NULL
      AND get_my_establishment_id() = p_establishment_id
    )
    OR (
      -- Utilisateur siège (sans établissement) : voit uniquement les données org-wide
      get_my_establishment_id() IS NULL
      AND NOT is_admin()
      AND p_establishment_id IS NULL
    );
$$;
```

#### 2. Restructuration des policies `expenses` (unified policy)

```sql
-- Supprimer les deux policies SELECT actuelles (OR-combinées, inefficaces)
DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_agency ON public.expenses;

-- Policy unifiée SELECT (AND logique : org ET établissement)
CREATE POLICY expenses_access ON public.expenses
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (
        -- Utilisateur avec établissement : voit son établissement
        get_my_establishment_id() IS NOT NULL
        AND establishment_id = get_my_establishment_id()
      )
      OR (
        -- Utilisateur siège : voit les dépenses sans établissement
        get_my_establishment_id() IS NULL
        AND establishment_id IS NULL
      )
    )
  );
```

#### 3. Restructuration des policies `mobile_money_transactions`

```sql
DROP POLICY IF EXISTS mm_transactions_select ON public.mobile_money_transactions;
DROP POLICY IF EXISTS momo_tx_agency ON public.mobile_money_transactions;

CREATE POLICY mmt_access ON public.mobile_money_transactions
  FOR SELECT TO authenticated
  USING (
    organization_id = get_my_org_id()
    AND (
      is_admin()
      OR (get_my_establishment_id() IS NOT NULL AND establishment_id = get_my_establishment_id())
      OR (get_my_establishment_id() IS NULL AND establishment_id IS NULL)
    )
  );
```

### Impact sur la page Dépenses

**Avant correction** : tous les utilisateurs de l'organisation voient toutes les dépenses (via `expenses_select`).  
**Après correction** : un utilisateur d'agence A ne voit que les dépenses de l'agence A. Un utilisateur siège ne voit que les dépenses sans agence.

> ⚠️ Changement de comportement observable. À valider avec le métier avant application.

---

## P0-3 : `invoices` — Soft-delete bypass

### Diagnostic confirmé

```
invoices_manage (ALL) : organization_id = get_my_org_id()           -- pas de deleted_at
invoices_select (SELECT) : organization_id = get_my_org_id()
                           AND deleted_at IS NULL
```

PostgreSQL combine les deux SELECT-policies avec OR. `invoices_manage` satisfait un SELECT sans vérifier `deleted_at IS NULL`, neutralisant `invoices_select`.

### Correction préparée

```sql
-- Supprimer la policy ALL (trop permissive pour SELECT)
DROP POLICY IF EXISTS invoices_manage ON public.invoices;

-- Recréer des policies séparées par opération
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

-- invoices_select (SELECT avec deleted_at IS NULL) reste inchangée
```

---

## Fichier SQL consolidé

Voir `20261127000200_053b_security_fixes.sql` pour le SQL complet prêt à appliquer.

## Checklist avant application

- [ ] Tester sur branche/preview Supabase avec 2 organisations et 2 agences
- [ ] Valider que la page Dépenses fonctionne avec la policy unifiée
- [ ] Vérifier que les transactions MoMo sont correctement filtrées par agence
- [ ] Vérifier que le backfill `asset_depreciation_schedules` ne touche pas les lignes orphelines
- [ ] Autorisation écrite obtenue
