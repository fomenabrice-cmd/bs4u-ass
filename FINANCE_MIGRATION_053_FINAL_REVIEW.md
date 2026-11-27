# FINANCE_MIGRATION_053_FINAL_REVIEW
_Revue de la version finale vs v1 — Généré le 2026-11-27_

## Résumé des changements

| Vue | Changement | Raison |
|-----|-----------|--------|
| `v_momo_daily_closings` | `'validated'` → `'calculated'` | Aucun rapprochement réel — le statut 'validated' implique une vérification qui n'a pas eu lieu |
| `v_momo_daily_closings` | `0::bigint` → `NULL::bigint` pour `discrepancy_xaf` | 0 implique un solde équilibré ; NULL = inconnu honnête |
| `v_journal_entries` | `COALESCE(je.reference, 'JE-...')` → `je.reference` | `reference` est NOT NULL en DB : le fallback ne se déclenchait jamais |
| `v_journal_entries` | `to_char(je.entry_date::timestamptz, 'YYYY')` supprimé | `entry_date` est `date`, pas `timestamptz` — cast inutile |
| `v_journal_entries` | `SUM(jl.debit)::bigint` → `ROUND(SUM(jl.debit))::bigint` | `debit` est `numeric` — cast direct tronque les décimales sans arrondi |

## v_treasury_reconciliations — inchangée

Toutes les colonnes vérifiées en Phase 3A :
- `financial_period_id` ✅ colonne existe (uuid, nullable)
- `difference_xaf` = `actual - expected` ✅
- `security_invoker = true` ✅
- RLS policy `org_isolation` sur la table source ✅

## v_momo_daily_closings — changements détaillés

### Status 'validated' → 'calculated'

**Problème** : `'validated'` suggère qu'un rapprochement manuel a confirmé les montants. Ce n'est pas le cas — c'est une agrégation automatique.

**Impact UI** : La page Commissions affiche un badge de statut. `'calculated'` est plus honnête et évite une fausse impression de validation métier.

**Code service** : `treasuryService.ts` utilise `status` comme text, pas enum. Le changement est compatible. ✅

### discrepancy_xaf NULL vs 0

**Problème** : `0` implique que le rapprochement est équilibré. Sans données de rapprochement réelles, on ne sait pas.

**Impact UI** : La colonne `discrepancy_xaf` est nullable dans le type Zod (`z.number().nullable()`). La vue renvoie `NULL` → géré proprement côté service. ✅

### Transactions non 'completed' exclues

Le FILTER `WHERE status = 'completed'` exclut déjà :
- `pending` : transaction non finalisée → commission non acquise ✅
- `failed` : échec → pas de commission ✅
- `reversed` : annulée → commission annulée ✅

Aucun double comptage possible.

## v_journal_entries — changements détaillés

### Suppression COALESCE mort

`journal_entries.reference` est NOT NULL (DEFAULT absent, mais contrainte NOT NULL en DB). Le COALESCE n'était jamais déclenché. Sa suppression réduit la complexité et évite une mauvaise interprétation lors de maintenances futures.

### Cast date corrigé

`je.entry_date` est de type `date` (confirmé par audit). Le cast `::timestamptz` était inutile et pouvait ajouter un offset timezone implicite selon la session. `entry_date::text` retourne `'YYYY-MM-DD'` directement. ✅

### ROUND pour cast numeric→bigint

`journal_lines.debit` et `.credit` sont `numeric`. Un SUM sur `numeric` retourne `numeric`. Le cast direct `::bigint` tronque sans arrondi (ex : 999.99 → 999). `ROUND(SUM(...))::bigint` est l'arrondi comptablement correct.

## Verdict final

**Migration 053 FINAL** est prête à appliquer. 

Les 3 vues sont correctes, sécurisées (`security_invoker = true`), et les grants sont présents.  
Appliquer **avant** la migration 053b (sécurité) et la migration 054 (tables manquantes).
