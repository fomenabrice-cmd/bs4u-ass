# FINANCE_PHASE3C_RLS_FINAL
_Audit RLS final — Toutes les tables Finance — Phase 3C — Généré le 2026-11-27_

---

## Principes appliqués

1. **Isolation org stricte** : toutes les tables Finance ont une colonne `organization_id` NOT NULL (sauf exceptions documentées).
2. **Policies AND-based** : `organization_id = get_my_org_id() AND (condition établissement)` — les policies OR permettent des contournements.
3. **Opérations séparées** : une policy par opération (SELECT, INSERT, UPDATE, DELETE) pour un contrôle précis.
4. **soft-delete via UPDATE** : `deleted_at` / `cancelled_at` — pas de DELETE pour les tables avec historique.
5. **INSERT-only via RPC** : `reserve_movements` — aucune policy INSERT pour authenticated.

---

## Tables existantes corrigées (migration 053b)

### `asset_depreciation_schedules`

| Opération | Policy | Condition |
|-----------|--------|-----------|
| SELECT | `ads_select` | `organization_id = get_my_org_id()` |
| INSERT | `ads_insert` | `organization_id = get_my_org_id()` |
| UPDATE | `ads_update` | `organization_id = get_my_org_id()` |
| DELETE | `ads_delete` | `organization_id = get_my_org_id()` |

**Note :** `organization_id` est ajouté par 053b (initialement absent). Le backfill des lignes existantes nécessite une requête manuelle après migration (voir section backfill).

### `expenses`

| Opération | Policy | Condition |
|-----------|--------|-----------|
| SELECT | `expenses_access` | `org_id = get_my_org_id() AND (is_admin() OR établissement match)` |

Pattern établissement :
```sql
is_admin()
OR (get_my_establishment_id() IS NOT NULL AND establishment_id = get_my_establishment_id())
OR (get_my_establishment_id() IS NULL AND NOT is_admin() AND establishment_id IS NULL)
```

### `mobile_money_transactions`

Même pattern que `expenses` via `mmt_access`.

### `invoices`

| Opération | Policy | Condition |
|-----------|--------|-----------|
| INSERT | `invoices_insert` | `organization_id = get_my_org_id()` |
| UPDATE | `invoices_update` | `organization_id = get_my_org_id() AND deleted_at IS NULL` |
| DELETE | `invoices_delete` | `organization_id = get_my_org_id()` |

---

## Nouvelles tables (migration 054)

### `loans`

| Opération | Policy | Condition | Remarque |
|-----------|--------|-----------|----------|
| SELECT | `loans_select` | `organization_id = get_my_org_id()` | |
| INSERT | `loans_insert` | `organization_id = get_my_org_id()` | Via RPC uniquement (design) |
| UPDATE | `loans_update` | `organization_id = get_my_org_id()` | Statut et outstanding |
| DELETE | ❌ Absent | — | Pas de suppression de prêt |

**Justification suppression bloquée :** Un prêt a un historique de remboursements. La suppression d'un prêt avec remboursements actifs crée une incohérence comptable.

### `loan_repayments`

| Opération | Policy | Condition | Remarque |
|-----------|--------|-----------|----------|
| SELECT | `lr_select` | `organization_id = get_my_org_id()` | |
| INSERT | `lr_insert` | `organization_id = get_my_org_id()` | Via RPC uniquement |
| UPDATE | ❌ Absent | — | Immutable après création |
| DELETE | ❌ Absent | — | Immutable après création |

**Idempotency_key :** Contrainte UNIQUE sur `idempotency_key` (nullable — uniquement si fourni).

### `capital_contributions`

| Opération | Policy | Condition | Remarque |
|-----------|--------|-----------|----------|
| SELECT | `cc_select` | `organization_id = get_my_org_id()` | |
| INSERT | `cc_insert` | `organization_id = get_my_org_id()` | Via RPC uniquement |
| UPDATE | `cc_update` | `organization_id = get_my_org_id() AND cancelled_at IS NULL` | Soft-cancel uniquement |
| DELETE | ❌ Absent | — | Soft-cancel via cancelled_at |

**Justification :** Une contribution en capital peut déjà avoir une écriture comptable associée. La supprimer sans annuler l'écriture crée un déséquilibre.

### `assets`

| Opération | Policy | Condition |
|-----------|--------|-----------|
| SELECT | `assets_select` | `organization_id = get_my_org_id()` |
| INSERT | `assets_insert` | `organization_id = get_my_org_id()` |
| UPDATE | `assets_update` | `organization_id = get_my_org_id() AND status != 'disposed'` |
| DELETE | ❌ Absent | — |

**Justification suppression bloquée :** Un actif peut avoir un échéancier d'amortissement partiel. La suppression sans traçabilité est interdite.

### `reserves`

| Opération | Policy | Condition |
|-----------|--------|-----------|
| SELECT | `reserves_select` | `organization_id = get_my_org_id()` |
| INSERT | `reserves_insert` | `organization_id = get_my_org_id()` |
| UPDATE | `reserves_update` | `organization_id = get_my_org_id()` |
| DELETE | ❌ Absent | — |

**Justification :** Une réserve avec mouvements ne peut pas être supprimée (FK constraint).

### `reserve_movements` ⚠️

| Opération | Policy | Condition | Remarque |
|-----------|--------|-----------|----------|
| SELECT | `rm_select` | `reserve_id IN (SELECT id FROM reserves WHERE org = get_my_org_id())` | |
| INSERT | ❌ Absent pour authenticated | — | **INSERT uniquement via RPC SECURITY DEFINER** |
| UPDATE | ❌ Absent | — | Immutable |
| DELETE | ❌ Absent | — | Immutable |

**Mécanisme :** `create_reserve_movement` est `SECURITY DEFINER` → bypasse les policies RLS → peut INSERT même sans policy INSERT pour `authenticated`. Toute tentative d'INSERT direct de `authenticated` échoue avec `ERROR: new row violates row-level security policy`.

---

## Tables Finance préexistantes (journal_entries, journal_lines)

Ces tables existent depuis avant Phase 3B. Vérification de cohérence :

| Table | RLS activé | Org isolation | SELECT policy |
|-------|-----------|--------------|---------------|
| `journal_entries` | À vérifier | Via `organization_id` | Probablement existante |
| `journal_lines` | À vérifier | Via `entry_id` → `journal_entries` | Via JOIN ou trigger |

**Recommandation :** Vérifier l'état RLS de `journal_entries` et `journal_lines` avant application de 054. Si absentes, ajouter dans 054.

---

## Backfill `asset_depreciation_schedules.organization_id`

Après application de 053b, les lignes existantes ont `organization_id = NULL`. Le backfill doit être fait manuellement :

```sql
-- À exécuter APRÈS migration 053b, AVANT migration 054
-- Requiert l'existence de la table assets (migration 054)
-- Donc : effectuer dans 054 après création de la table assets
UPDATE public.asset_depreciation_schedules ads
SET organization_id = a.organization_id
FROM public.assets a
WHERE ads.asset_id = a.id
  AND ads.organization_id IS NULL;
```

**Note :** Ce backfill est inclus dans 054_FINAL.sql après la création de la table `assets`.

---

## Résumé des gaps comblés

| Gap Phase 3B | Comblé dans |
|-------------|------------|
| `asset_depreciation_schedules` sans org_id | 053B_FINAL |
| `can_access_establishment` bypass NULL | 053B_FINAL |
| `expenses` / `mmt` policies OR combinées | 053B_FINAL |
| `invoices` soft-delete visible | 053B_FINAL |
| `loan_repayments` sans idempotency | 054_FINAL |
| `capital_contributions` DELETE absent | 054_FINAL (pas de policy DELETE) |
| `reserve_movements` INSERT direct possible | 054_FINAL (pas de policy INSERT) |
| `assets` sans org_id | 054_FINAL (new table) |
| Helpers PUBLIC trop large | 053B_FINAL |
