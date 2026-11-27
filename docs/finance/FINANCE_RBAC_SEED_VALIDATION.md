# Validation RBAC, RLS et Seeds — Module Finance

> Date : 2026-11-27  
> Méthode : Analyse statique des migrations + vérification distante READ-ONLY  
> Contrainte : Lecture seule. Aucune modification de la base distante.

---

## 1. Architecture RBAC

### 1.1 Modèle New Arch (biz.*)

Le module Finance utilise un système RBAC basé sur :

```
core.roles → core.role_permissions → core.permissions
                     ↓
         core.user_role_assignments (lie users ↔ roles)
                     ↓
         app.has_permission(p_code) → boolean
         app.require_permission(p_code) → void (exception si absent)
```

**Toutes les RPCs Finance font appel à `app.require_permission()`** avant toute opération.

### 1.2 Modèle Old Arch (public.*)

```
public.profiles.organization_id → multi-tenancy
get_my_org_id() → uuid (retourne l'org de l'utilisateur courant)
RLS : USING (organization_id = get_my_org_id())
```

**Les deux modèles coexistent sans interférence** (schémas distincts).

---

## 2. Permissions Finance Requises

### 2.1 Permissions utilisées par les RPCs Finance

| Permission | RPC(s) concerné(s) | Accès requis |
|------------|-------------------|-------------|
| `biz.finance.journal.read` | vues v_journal_entries | Lecture journal |
| `biz.finance.journal.write` | `create_journal_entry` | Création écritures |
| `biz.finance.capital.read` | vues v_loans, v_capital_contributions | Lecture capital/emprunts |
| `biz.finance.capital.write` | `create_loan`, `record_loan_repayment` | Création/remboursement emprunt |
| `biz.finance.assets.read` | vues v_assets | Lecture immobilisations |
| `biz.finance.assets.write` | `create_asset`, `compute_depreciation` | Création actifs/amortissements |
| `biz.finance.reserves.read` | vues v_reserves | Lecture réserves |
| `biz.finance.reserves.write` | `allocate_margin` | Allocation marges |
| `biz.finance.closing.write` | `close_financial_period` | Clôture de période |
| `biz.dashboard.read` | `ops.number_series` (RLS) | Accès numérotation |
| `platform.roles.manage` | `core.roles`, `core.permissions` | Administration RBAC |

**Total : 11 permissions Finance à créer et assigner**

### 2.2 Rôles Finance recommandés

| Rôle | Code | Permissions incluses |
|------|------|---------------------|
| `finance_admin` | Finance — Admin complet | Toutes les 9 permissions biz.finance.* |
| `finance_writer` | Finance — Comptable | journal.read + journal.write + assets.read + assets.write + capital.read + capital.write + reserves.read |
| `finance_reader` | Finance — Lecteur | journal.read + assets.read + capital.read + reserves.read |

---

## 3. Seeds RBAC Obligatoires

### 3.1 Seed des permissions

```sql
-- À exécuter après migrations fondations (20261121000300)
INSERT INTO core.permissions (code, domain, label_fr, is_sensitive)
VALUES
  ('biz.finance.journal.read',   'business', 'Lire le journal comptable',      false),
  ('biz.finance.journal.write',  'business', 'Créer des écritures comptables', true),
  ('biz.finance.capital.read',   'business', 'Lire capital et emprunts',       false),
  ('biz.finance.capital.write',  'business', 'Gérer capital et emprunts',      true),
  ('biz.finance.assets.read',    'business', 'Lire les immobilisations',        false),
  ('biz.finance.assets.write',   'business', 'Gérer les immobilisations',       true),
  ('biz.finance.reserves.read',  'business', 'Lire les réserves',               false),
  ('biz.finance.reserves.write', 'business', 'Gérer les réserves',              true),
  ('biz.finance.closing.write',  'business', 'Clôturer les périodes',           true),
  ('biz.dashboard.read',         'business', 'Lire le tableau de bord',         false)
ON CONFLICT (code) DO NOTHING;
```

### 3.2 Seed des rôles Finance

```sql
INSERT INTO core.roles (code, label_fr, domain, is_system)
VALUES
  ('finance_admin',  'Administrateur Finance', 'business', true),
  ('finance_writer', 'Comptable Finance',       'business', false),
  ('finance_reader', 'Lecteur Finance',         'business', false)
ON CONFLICT (code) DO NOTHING;
```

### 3.3 Seed des associations rôle ↔ permission

```sql
-- finance_admin : toutes les permissions Finance
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r, core.permissions p
WHERE r.code = 'finance_admin'
  AND p.code LIKE 'biz.finance.%'
ON CONFLICT DO NOTHING;

-- finance_writer : lecture + écriture (sauf clôture admin)
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r, core.permissions p
WHERE r.code = 'finance_writer'
  AND p.code IN (
    'biz.finance.journal.read', 'biz.finance.journal.write',
    'biz.finance.assets.read', 'biz.finance.assets.write',
    'biz.finance.capital.read', 'biz.finance.capital.write',
    'biz.finance.reserves.read', 'biz.dashboard.read'
  )
ON CONFLICT DO NOTHING;

-- finance_reader : lecture uniquement
INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r, core.permissions p
WHERE r.code = 'finance_reader'
  AND p.code IN (
    'biz.finance.journal.read', 'biz.finance.assets.read',
    'biz.finance.capital.read', 'biz.finance.reserves.read',
    'biz.dashboard.read'
  )
ON CONFLICT DO NOTHING;
```

### 3.4 Assigner un utilisateur (après staging)

```sql
-- Exemple : assigner finance_admin à un utilisateur
INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, source)
SELECT
  auth.uid(),           -- à remplacer par l'UUID de l'utilisateur cible
  r.id,
  'global',
  'manual'
FROM core.roles r
WHERE r.code = 'finance_admin'
ON CONFLICT DO NOTHING;
```

---

## 4. Analyse des Politiques RLS Finance

### 4.1 Tables avec RLS activée (new arch)

| Table | RLS | Policy Read | Policy Write |
|-------|-----|-------------|-------------|
| `biz.reserves` | ✅ | `has_permission('biz.finance.reserves.read')` | `has_permission('biz.finance.reserves.write')` |
| `biz.reserve_movements` | ✅ | `has_permission('biz.finance.reserves.read')` | `has_permission('biz.finance.reserves.write')` |
| `biz.allocation_rules` | ✅ | `has_permission('biz.finance.reserves.read')` | `has_permission('biz.finance.reserves.write')` |
| `biz.financial_periods` | ✅ (mig 000100) | `has_permission('biz.finance.journal.read')` | `has_permission('biz.finance.closing.write')` |
| `biz.journal_entries` | ✅ (mig 000200) | `has_permission('biz.finance.journal.read')` | `has_permission('biz.finance.journal.write')` |
| `biz.journal_lines` | ✅ | Idem journal_entries | Idem |
| `biz.loans` | ✅ (mig 000500) | `has_permission('biz.finance.capital.read')` | `has_permission('biz.finance.capital.write')` |
| `biz.assets` | ✅ (mig 000600) | `has_permission('biz.finance.assets.read')` | `has_permission('biz.finance.assets.write')` |
| `core.roles` | ✅ (mig 000300) | Pour tous les `authenticated` | `has_permission('platform.roles.manage')` |
| `core.permissions` | ✅ | Pour tous les `authenticated` | `has_permission('platform.roles.manage')` |
| `ops.number_series` | ✅ | `has_permission('biz.dashboard.read')` | Via RPC `security definer` uniquement |

### 4.2 Risques RLS

| Risque | Probabilité | Mitigation |
|--------|------------|-----------|
| `app.has_permission()` retourne `false` si `core.user_role_assignments` vide | **ÉLEVÉE** | Seeder les rôles ET les assignments avant activation |
| `ops.number_series` vide → `app.next_number()` lève exception | **ÉLEVÉE** | Seeder toutes les séries avant premier RPC |
| Utilisateur sans rôle Finance → toutes les RPCs bloquées | **ÉLEVÉE** | Assigner `finance_admin` à au moins un utilisateur test |
| RLS old arch brisée par new arch | Nulle | Schémas distincts, aucune interaction |

### 4.3 Vues avec `security_invoker = true`

Les vues `api.*` Finance sont créées avec `WITH (security_invoker = true)`, ce qui signifie que le RLS des tables sous-jacentes est appliqué avec les permissions de **l'utilisateur appelant** (et non `security definer`). C'est le comportement correct et sécurisé.

---

## 5. Validations Distantes READ-ONLY

### 5.1 Validation Schémas (VALIDÉ)

```
Résultat requête distante 2026-11-27 :
schemas biz, api, app, ops, momo, audit, core → [] (aucun présent)
```

**Statut : CONFIRMÉ — Aucun nouveau schéma n'est appliqué en production.**

### 5.2 Validation Tables Finance (VALIDÉ)

```
Toutes les tables biz.* Finance → ABSENTES en production
```

### 5.3 Validation Fonctions prod (VALIDÉ)

```
get_my_org_id()     → ✅ Présente en prod (old arch RBAC intact)
close_cash_session() → ✅ Présente en prod (module caisse intact)
app.has_permission() → ❌ Absente (new arch RBAC non appliqué)
app.next_number()    → ❌ Absente
```

---

## 6. Checklist Seed avant Activation Finance

| # | Seed | Table | Bloquant si absent |
|---|------|-------|-------------------|
| S1 | Permissions Finance | `core.permissions` | ✅ Oui — RPCs bloquées |
| S2 | Rôles Finance | `core.roles` | ✅ Oui — assignments impossibles |
| S3 | Associations rôle↔permission | `core.role_permissions` | ✅ Oui — `has_permission()` retourne false |
| S4 | Assignment utilisateur admin | `core.user_role_assignments` | ✅ Oui — aucun accès |
| S5 | Number series (JNL, LOAN, ASSET, REPAYMENT, DEPR, RECON) | `ops.number_series` | ✅ Oui — RPCs créa échouent |
| S6 | Période comptable ouverte | `biz.financial_periods` | ✅ Oui — aucun KPI calculable |
| S7 | Plan comptable SYSCOHADA | `biz.chart_of_accounts` | ✅ Oui — saisie journal bloquée |
| S8 | Réserves par défaut | `biz.reserves` | ⚠️ Non-bloquant pour démarrage |
| S9 | Profil utilisateur actif | `core.user_profiles` | ✅ Oui — `app.has_permission()` vérifie status='active' |

---

## 7. Résumé

| Critère | Statut |
|---------|--------|
| RBAC new arch en prod | ❌ Absent (non appliqué) |
| RBAC old arch en prod | ✅ Intact (get_my_org_id) |
| Permissions Finance définies (local) | 📋 VALIDÉ STATIQUEMENT (11 permissions) |
| Seeds obligatoires avant activation | 9 catégories |
| Risque accès bloqué si seeds manquants | ÉLEVÉ |
| Coexistence old/new RBAC | ✅ Possible sans conflit |
