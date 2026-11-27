# Plan de Migration Staging → Production — Finance

> Date : 2026-11-26  
> Périmètre : Application des migrations Finance sur staging, puis production  
> **RÈGLE ABSOLUE : Aucune exécution en production sans autorisation écrite + backup préalable.**  
> **Aucun `supabase db push` sans validation staging complète.**

---

## Pré-requis Obligatoires

Avant toute exécution :
- [ ] Backup complet de la base de production (`pg_dump` ou snapshot Supabase)
- [ ] Environnement staging fonctionnel avec données de test
- [ ] Accès en écriture au projet staging Supabase
- [ ] Autorisation écrite du responsable technique
- [ ] Fenêtre de maintenance planifiée (hors heures de pointe)
- [ ] Rollback testé sur staging avant passage en production

---

## Phase 0 — Préparation (Local)

**Durée estimée : 1 jour**  
**Risque : Zéro (aucune base touchée)**

### Étapes

```powershell
# 0.1 — Vérifier l'état local
cd "G:\codex appli\app bs4u manager\bs4u-ecosystem\backend\supabase"
ls migrations/ | Sort-Object Name | Select-Object -Last 5

# 0.2 — Vérifier les migrations dans l'ordre chronologique
# Ordre attendu (20261121* avant 20261126*) :
# 20261121000000, 20261121000100, ..., 20261121001600
# puis 20261125000100, ..., 20261125000800
# puis 20261126000100, ..., 20261126001200
```

### Checklist Phase 0
- [ ] Toutes les migrations listées dans l'ordre correct
- [ ] Pas de migration avec timestamp conflictuel (ex: 20261121* après 20261122* déjà appliqué)
- [ ] `supabase/config.toml` conserve `schemas = ["api"]` pour le staging
- [ ] Seeds présents : `ops.number_series`, `app.roles`, `biz.chart_of_accounts`

---

## Phase 1 — Application sur Staging

**Durée estimée : 2–4 heures**  
**Risque : Faible (staging isolé)**

### 1.1 — Backup staging (optionnel mais recommandé)

```bash
# Via Supabase CLI ou pg_dump
supabase db dump --linked > backup_staging_avant_migration_$(date +%Y%m%d).sql
```

### 1.2 — Application des fondations

```bash
# Méthode A : Via Supabase CLI (recommandé)
supabase db push --linked

# Méthode B : Application manuelle dans l'ordre
# Appliquer chaque migration via l'éditeur SQL Supabase ou psql
# ORDRE STRICT :
# 1. 20261121000000_schemas_and_grants.sql
# 2. 20261121000100_app_rbac.sql
# 3. 20261121000200_ops_number_series.sql
# 4. 20261121000300_app_triggers.sql
# 5. 20261121000400_biz_base.sql
# 6. 20261121001100_biz_finance.sql
# 7. 20261121001500_momo_accounts.sql
# 8. 20261121001600_biz_expenses.sql
# 9. 20261125000100_momo_add_organization.sql
# ... (suite 20261125000*)
```

### 1.3 — Vérification après fondations

```sql
-- Vérifier les schémas créés
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('biz','api','app','ops','momo','audit')
ORDER BY schema_name;
-- Attendu : 6 lignes

-- Vérifier les fonctions app.*
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'app'
ORDER BY routine_name;
-- Attendu : app.next_number, app.forbid_update_delete, app.require_permission, app.has_permission, etc.
```

### 1.4 — Application des migrations Finance

```bash
# Après validation des fondations
# Appliquer dans l'ordre :
# 20261126000100 → 20261126001200
```

### 1.5 — Vérification après Finance

```sql
-- Tables biz.* créées
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'biz'
ORDER BY table_name;
-- Attendu : assets, asset_depreciation_schedules, bank_accounts, bank_transactions,
--           capital_contributions, chart_of_accounts, depreciation_entries,
--           expenses, financial_periods, invoices, journal_entries, journal_lines,
--           loan_repayments, loans, payments, quotes, reserve_movements

-- Vues api.* créées
SELECT table_name FROM information_schema.views
WHERE table_schema = 'api'
ORDER BY table_name;
-- Attendu : v_financial_periods, v_journal_entries, v_assets, v_loans,
--           v_capital_contributions, v_treasury_summary, v_momo_daily_closings, etc.
```

---

## Phase 2 — Seeding Obligatoire (Staging)

**Durée estimée : 30 minutes**  
**Risque : Faible**

### 2.1 — Number Series

```sql
-- À exécuter via Supabase SQL Editor sur staging
INSERT INTO ops.number_series (prefix, year, last_number)
VALUES
  ('JNL', EXTRACT(YEAR FROM NOW())::int, 0),
  ('EMR', EXTRACT(YEAR FROM NOW())::int, 0),
  ('IMM', EXTRACT(YEAR FROM NOW())::int, 0),
  ('MM',  EXTRACT(YEAR FROM NOW())::int, 0),
  ('DEP', EXTRACT(YEAR FROM NOW())::int, 0)
ON CONFLICT (prefix, year) DO NOTHING;

-- Vérification
SELECT * FROM ops.number_series;
-- Attendu : 5 lignes
```

### 2.2 — Rôles Finance

```sql
INSERT INTO app.roles (name, description) VALUES
  ('finance_admin',   'Accès complet au module Finance'),
  ('finance_writer',  'Création d''écritures, actifs, emprunts'),
  ('finance_reader',  'Lecture seule Finance')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.permissions (name) VALUES
  ('biz.finance.journal.read'),
  ('biz.finance.journal.write'),
  ('biz.finance.assets.read'),
  ('biz.finance.assets.write'),
  ('biz.finance.capital.read'),
  ('biz.finance.capital.write'),
  ('biz.finance.admin')
ON CONFLICT (name) DO NOTHING;

-- Lier finance_admin à toutes les permissions
INSERT INTO app.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM app.roles r CROSS JOIN app.permissions p
WHERE r.name = 'finance_admin'
ON CONFLICT DO NOTHING;
```

### 2.3 — Période comptable de test

```sql
INSERT INTO biz.financial_periods (label, starts_at, ends_at, status)
VALUES ('Novembre 2026', '2026-11-01', '2026-11-30', 'open');

SELECT id, label, status FROM biz.financial_periods;
```

---

## Phase 3 — Tests Fonctionnels Staging

**Durée estimée : 2–5 jours**  
**Risque : Faible**

### 3.1 — Tests automatiques

```bash
# Lancer la suite de tests Finance
cd "G:\codex appli\app bs4u manager\bs4u-ecosystem"
pnpm test --filter=manager
# Ou spécifiquement les tests Finance si séparés
```

### 3.2 — Tests manuels (8 catégories)

| # | Test | Critère |
|---|------|---------|
| T1 | Créer une période comptable | Succès, deuxième création bloquée |
| T2 | Créer une écriture déséquilibrée | Exception `JOURNAL_UNBALANCED` |
| T3 | Créer une écriture équilibrée | UUID retourné, `entry_number` = `JNL-2026-000001` |
| T4 | Modifier une écriture postée | Exception append-only |
| T5 | Créer un emprunt | UUID retourné, `loan_number` = `EMR-2026-000001` |
| T6 | Enregistrer un remboursement | Capital restant mis à jour |
| T7 | Créer une immobilisation | Plan d'amortissement généré |
| T8 | Tableau de bord KPI | Données cohérentes pour la période |

### 3.3 — Test de non-régression old arch

```sql
-- Vérifier que public.* n'est pas impacté
SELECT COUNT(*) FROM public.cash_sessions;      -- doit retourner valeur pré-migration
SELECT COUNT(*) FROM public.cash_movements;     -- idem
SELECT COUNT(*) FROM public.mobile_money_accounts; -- idem
SELECT COUNT(*) FROM public.organizations;      -- idem

-- Vérifier RLS old arch toujours fonctionnelle
-- (depuis un compte utilisateur authentifié)
SELECT * FROM public.products LIMIT 1;          -- doit retourner des données filtrées par org
```

### 3.4 — Test PostgREST coexistence

```bash
# Modifier config.toml pour staging
# schemas = ["api", "public"]
# Redémarrer le PostgREST staging
# Tester les deux
curl -H "apikey: $STAGING_ANON_KEY" \
  "$STAGING_URL/rest/v1/v_financial_periods"     # Doit retourner 200

curl -H "apikey: $STAGING_ANON_KEY" \
  "$STAGING_URL/rest/v1/products"                # Doit retourner 200
```

---

## Phase 4 — Transition PostgREST (Staging → Cible)

**Durée estimée : 1 heure**  
**Risque : Modéré (coupure PostgREST)**

```toml
# supabase/config.toml — Étape de transition
[api]
schemas = ["api", "public"]
extra_search_path = ["public", "extensions"]
```

> Si le frontend utilise directement `supabase.from("table_name")` avec des tables `public.*`, cette config garantit que les deux fonctionnent pendant la transition.

---

## Phase 5 — Validation Finale Staging (2 semaines min.)

**Durée estimée : 14 jours**  
**Risque : Faible**

- Utilisation quotidienne du module Finance sur staging
- Monitoring des erreurs PostgREST
- Vérification de l'absence de double-comptage
- Validation des KPI tableau de bord
- Formation des utilisateurs clés

---

## Phase 6 — Application en Production

**REQUIERT : Autorisation écrite + Backup confirmé**

### 6.1 — Backup production obligatoire

```bash
# Option A : Snapshot Supabase (recommandé)
# Depuis le dashboard Supabase : Settings → Backups → Create backup

# Option B : pg_dump
pg_dump "postgresql://postgres:[password]@db.mvebwahpforfxqohjusp.supabase.co:5432/postgres" \
  > backup_production_avant_finance_$(date +%Y%m%d_%H%M%S).sql

# Vérifier la taille du backup
ls -lh backup_production_*.sql
```

### 6.2 — Fenêtre de maintenance

Communiquer aux utilisateurs :
- Heure de début / fin
- Modules impactés : **Module Finance uniquement** (nouveau module, pas encore en prod)
- Modules non impactés : Caisse, MoMo, Ventes, Stocks

### 6.3 — Application des migrations

```bash
# Via Supabase CLI, depuis le répertoire backend
supabase db push --linked

# Vérification immédiate post-migration
# (Exécuter les mêmes requêtes SQL de vérification qu'en Phase 1)
```

### 6.4 — Seeding production

```sql
-- Mêmes seeds que Phase 2, adaptés à l'environnement production
-- Exécuter via Supabase SQL Editor (production)
-- Remplacer les dates par les dates réelles
INSERT INTO ops.number_series (prefix, year, last_number)
VALUES
  ('JNL', 2026, 0), ('EMR', 2026, 0),
  ('IMM', 2026, 0), ('MM',  2026, 0), ('DEP', 2026, 0)
ON CONFLICT (prefix, year) DO NOTHING;

-- Rôles (adapter selon les utilisateurs réels)
-- Assigner via app.user_roles après création des rôles
```

### 6.5 — Vérification post-déploiement

```bash
# Tests smoke en production (READ-ONLY)
curl -H "apikey: $PROD_ANON_KEY" \
  "$PROD_URL/rest/v1/v_financial_periods"

# Depuis l'application
# - Ouvrir Finance → Tableau de bord : doit s'afficher sans erreur
# - Créer une période comptable test
# - Vérifier numérotation : premier JNL = JNL-2026-000001
```

---

## Plan de Rollback

### Si la migration échoue en cours

```bash
# Option 1 : Restaurer depuis le backup pg_dump
psql "postgresql://postgres:[password]@db.mvebwahpforfxqohjusp.supabase.co:5432/postgres" \
  < backup_production_avant_finance_YYYYMMDD_HHMMSS.sql

# Option 2 : Restaurer depuis snapshot Supabase
# Settings → Backups → Restore (depuis le dashboard)
```

### Script de rollback rapide (si migration partielle)

```sql
-- Supprimer les nouveaux schémas si la migration a échoué à mi-chemin
-- ATTENTION : Irréversible pour les données saisies après migration
DROP SCHEMA IF EXISTS biz CASCADE;
DROP SCHEMA IF EXISTS api CASCADE;
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS ops CASCADE;
DROP SCHEMA IF EXISTS momo CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
-- NE PAS toucher public.*
```

> **Note** : Le rollback par DROP SCHEMA n'est sûr que si aucune donnée Finance n'a encore été saisie. Si des données ont été saisies, restaurer depuis le backup.

---

## Résumé du Planning

| Phase | Durée | Environnement | Autorisation requise |
|-------|-------|---------------|---------------------|
| Phase 0 — Préparation | 1 jour | Local | — |
| Phase 1 — Application staging | 2–4 h | Staging | — |
| Phase 2 — Seeding staging | 30 min | Staging | — |
| Phase 3 — Tests staging | 2–5 jours | Staging | — |
| Phase 4 — PostgREST transition | 1 h | Staging | — |
| Phase 5 — Validation staging | 14 jours | Staging | — |
| Phase 6 — Production | 2 h | **PRODUCTION** | ✅ Obligatoire |
| **Total** | **~3 semaines** | | |

---

## Checklist Finale Avant Production

- [ ] Toutes les phases staging complétées avec succès
- [ ] Tests T1–T8 validés
- [ ] Non-régression old arch confirmée
- [ ] PostgREST coexistence testée 14 jours
- [ ] Backup production créé et vérifié
- [ ] Autorisation écrite du responsable technique reçue
- [ ] Fenêtre de maintenance communiquée
- [ ] Rollback testé sur staging
- [ ] Support utilisateurs formés

> **Rappel** : Ce plan s'applique à l'ajout du module Finance. Il n'inclut pas la migration des données historiques de `public.journal_entries` vers `biz.journal_entries`. Les données historiques restent dans `public.*` et sont accessibles via les anciens modules.
