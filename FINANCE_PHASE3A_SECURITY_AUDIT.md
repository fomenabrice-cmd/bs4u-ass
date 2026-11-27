# FINANCE_PHASE3A_SECURITY_AUDIT
_Audit RLS multi-agence — Généré le 2026-11-27_

## Périmètre

Audit complet des politiques RLS sur les 10 tables Finance, des fonctions SECURITY DEFINER et des risques multi-agence/multi-org pour le module Finance de BS4U Manager.

Tables auditées : `expenses`, `invoices`, `journal_entries`, `journal_lines`, `financial_periods`, `treasury_reconciliations`, `mobile_money_accounts`, `mobile_money_transactions`, `asset_depreciation_schedules`, `allocation_rules`.

---

## Anomalies critiques

### CRITIQUE-1 — `asset_depreciation_schedules` : aucune isolation organisation

**Sévérité** : CRITIQUE  
**Table** : `asset_depreciation_schedules`  
**Policy** : `authenticated_read` — `auth.role() = 'authenticated'`  
**Rôle** : `{public}` (s'applique aux users anonymes et authentifiés)

**Risque** : Tout utilisateur authentifié, quelle que soit son organisation, peut lire **toutes** les lignes de plans d'amortissement de toutes les organisations hébergées sur le même projet Supabase. Les données d'amortissement (valeur d'actif, durée, montants annuels) sont exposées entre organisations concurrentes.

**Preuve** :
```sql
-- Résultat de l'audit DB
policyname: authenticated_read
qual: (auth.role() = 'authenticated')
-- Pas de filtre organization_id, pas de get_my_org_id()
```

**Correction requise (migration 054)** :
1. Ajouter colonne `organization_id uuid` sur `asset_depreciation_schedules`
2. Supprimer la policy `authenticated_read`
3. Créer policy `org_isolation` : `organization_id = get_my_org_id()`
4. Backfill `organization_id` depuis la table `assets` (via JOIN)

---

### CRITIQUE-2 — `can_access_establishment()` : bypass multi-agence pour utilisateurs sans établissement

**Sévérité** : CRITIQUE  
**Fonction** : `can_access_establishment(p_establishment_id uuid)` — SECURITY DEFINER  
**Tables affectées** : `mobile_money_transactions`, `expenses` (toute table avec policy `can_access_establishment`)

**Logique de la fonction** :
```sql
SELECT
  is_admin()
  OR get_my_establishment_id() IS NULL   -- <-- faille
  OR get_my_establishment_id() = p_establishment_id
  OR p_establishment_id IS NULL;
```

**Risque** : Si `get_my_establishment_id()` retourne `NULL` pour un utilisateur (par exemple, un employé du siège sans établissement assigné), la fonction retourne `TRUE` pour **n'importe quel** `p_establishment_id`. Cet utilisateur peut lire les données de **toutes** les agences, incluant celles qui lui sont normalement cloisonnées.

**Impact concret** :  
- Sur `mobile_money_transactions` : politique `momo_tx_agency` utilise `can_access_establishment(mmt.establishment_id)`. Un utilisateur sans `establishment_id` assigné voit les transactions MoMo de toutes les agences.  
- Sur `expenses` : même pattern avec `expenses_agency`.

**Correction requise** :
```sql
-- Remplacer la ligne faillible par :
OR (get_my_establishment_id() IS NULL AND is_admin())
-- ou : forcer un rôle explicite "can_see_all" distinct de "null"
```

---

## Anomalies moyennes

### MOYEN-1 — `invoices` : soft-delete bypass via policy ALL

**Table** : `invoices`  
**Policies** :
- `invoices_manage` (ALL) : `organization_id = get_my_org_id()` — pas de filtre `deleted_at`
- `invoices_select` (SELECT) : `organization_id = get_my_org_id() AND deleted_at IS NULL`

**Risque** : PostgreSQL évalue les policies SELECT en OR. `invoices_manage` satisfait un SELECT sans vérifier `deleted_at IS NULL`. Les factures soft-deletées restent visibles en lecture. L'intention de `invoices_select` est neutralisée.

**Correction** : Ajouter `AND deleted_at IS NULL` au `qual` de `invoices_manage`, ou supprimer `invoices_manage` et créer des policies séparées pour INSERT/UPDATE/DELETE.

---

### MOYEN-2 — Policies avec rôle `{public}` au lieu de `{authenticated}`

**Tables** : `treasury_reconciliations`, `allocation_rules`, `asset_depreciation_schedules`  
**Pattern** : `roles: {public}` — s'applique aux requêtes anonymes et authentifiées.

**Risque réel** : Faible. Le `qual` requiert `auth.uid()` (retourne NULL pour anon), donc les lignes sont invisibles pour les utilisateurs non authentifiés. Mais non-conforme aux bonnes pratiques Supabase (Supabase recommande `{authenticated}` pour les policies d'accès aux données).

**Correction** : Recréer les policies avec `TO authenticated`.

---

### MOYEN-3 — `journal_entries` : policies redondantes

**Policies** :
- `journal_entries_manage` (ALL, authenticated) : `organization_id = get_my_org_id()`
- `journal_entries_select` (SELECT, authenticated) : `organization_id = get_my_org_id()`

`journal_entries_manage` couvre déjà les SELECT. La deuxième policy est redondante. Pas de risque de sécurité, mais elle complexifie la maintenance et peut induire en erreur lors d'audits futurs.

**Correction** : Supprimer `journal_entries_select`.

---

### MOYEN-4 — `journal_entries` : pas d'isolation par établissement

**Risque** : Les écritures comptables sont scoped uniquement par organisation (`get_my_org_id()`). Dans une architecture multi-agence, toutes les agences d'une même organisation partagent le journal comptable. Un comptable d'agence A peut lire les écritures d'agence B.

**Évaluation** : Acceptable si le journal comptable est intentionnellement consolidé au niveau organisation (ce qui est courant en comptabilité). À confirmer avec le métier avant d'ajouter un filtre établissement.

---

## Fonctions SECURITY DEFINER — inventaire

| Fonction | SECURITY DEFINER | Usage Finance | Risque |
|----------|-----------------|---------------|--------|
| `get_my_org_id()` | ✅ | Toutes tables Finance | Faible — lit JWT puis user_roles |
| `can_access_establishment()` | ✅ | mobile_money_transactions, expenses | ⚠️ Voir CRITIQUE-2 |
| `is_admin()` | ✅ | Appelée par can_access_establishment | Faible — vérifie user_roles + org |
| `set_momo_capital` | ✅ | Indirectement (MoMo → Finance) | Hors périmètre Finance direct |

**RPCs Finance référencés mais ABSENTS en DB** :
- `create_journal_entry` — introuvable
- `create_loan` — introuvable
- `record_loan_repayment` — introuvable
- `create_asset` — introuvable
- `compute_depreciation` — introuvable

Ces fonctions n'existent pas encore en production. Leur appel depuis les services Finance provoquera une erreur `PGRST202` (function does not exist). Voir `FINANCE_SERVICE_RECONCILIATION.md`.

---

## Matrice de risque par table

| Table | Isolation org | Isolation agence | RLS activé | Risque principal |
|-------|--------------|-----------------|------------|-----------------|
| `expenses` | ✅ | ⚠️ can_access_establishment (voir CRITIQUE-2) | ✅ | Bypass si user sans établissement |
| `invoices` | ✅ | ❌ org-only | ✅ | Soft-delete bypass (MOYEN-1) |
| `journal_entries` | ✅ | ❌ intentionnel ? | ✅ | Pas d'isolation agence |
| `journal_lines` | ✅ (via entry) | ❌ | ✅ | Dépend de journal_entries |
| `financial_periods` | ⚠️ org_id NULLABLE | ❌ | ✅ | Rows NULL org_id orphelins |
| `treasury_reconciliations` | ⚠️ org_id NULLABLE | ❌ | ✅ | Role {public}, org_id nullable |
| `mobile_money_accounts` | ✅ | ⚠️ | ✅ | Dépend de can_access_establishment |
| `mobile_money_transactions` | ✅ | ⚠️ can_access_establishment | ✅ | Bypass si user sans établissement |
| `asset_depreciation_schedules` | 🔴 AUCUNE | ❌ | ✅ | CRITIQUE-1 : fuite inter-org |
| `allocation_rules` | ✅ | ❌ | ✅ | Role {public} |

---

## Corrections prioritaires

| Priorité | Action | Table | Bloque |
|----------|--------|-------|--------|
| P0 | Ajouter org_id + policy sur `asset_depreciation_schedules` | asset_depreciation_schedules | Migration 054 |
| P0 | Corriger `can_access_establishment()` : NULL != can-see-all | Fonction | Hotfix |
| P1 | Ajouter `deleted_at IS NULL` à `invoices_manage` | invoices | Hotfix |
| P2 | Passer policies {public} en {authenticated} | 3 tables | Migration 054 |
| P3 | Supprimer `journal_entries_select` redondante | journal_entries | Maintenance |
