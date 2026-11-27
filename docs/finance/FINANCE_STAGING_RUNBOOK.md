# Runbook Staging — Module Finance BS4U

> Date : 2026-11-27  
> Périmètre : Application des 37 migrations Finance sur staging  
> **RÈGLE ABSOLUE : Aucune exécution en production sans autorisation écrite + backup préalable.**  
> **Aucun `supabase db push` en production.**  
> **Ne déclarer jamais un test réussi s'il n'a pas réellement été exécuté.**

---

## Pré-requis

- [ ] Environnement staging Supabase séparé du projet production
- [ ] Accès Supabase CLI avec `supabase link --project-ref <staging-ref>`
- [ ] Backup staging optionnel (recommandé)
- [ ] Autorisation du responsable technique pour l'environnement staging

---

## Phase 0 — Vérification Locale (READ-ONLY, aucune base touchée)

### 0.1 — Vérifier l'ordre des migrations

```powershell
ls "G:\codex appli\app bs4u manager\bs4u-ecosystem\backend\supabase\migrations" |
  Sort-Object Name |
  Select-Object Name
```

**Ordre attendu :**
```
20261121000000_schemas_and_grants.sql
20261121000100_app_utilities.sql
20261121000200_core_persons.sql
20261121000300_rbac.sql
20261121000400_audit_idempotency_numbers.sql
20261121000500_system_settings_files.sql
20261121000600_ops_jobs_notifications.sql
20261121000700_api_me_allowed_transitions.sql
20261121000800_biz_customers.sql
20261121000900_biz_catalog_orders.sql
20261121001000_biz_print_jobs.sql
20261121001100_biz_finance.sql
20261121001200_biz_stock_pos.sql
20261121001300_biz_documents.sql
20261121001400_asso_members.sql
20261121001500_momo_accounts.sql
20261121001600_biz_expenses.sql
20261125000100_momo_add_organization.sql
20261125000200_momo_add_performed_by.sql
20261125000300_momo_public_rls.sql
20261125000400_supplier_funds.sql
20261125000500_cash_rpcs.sql
20261125000600_cash_movements_immutable.sql
20261125000700_cash_rls.sql
20261125000800_pos_rpcs.sql
20261126000100_finance_periods.sql
20261126000200_finance_journal.sql
20261126000300_finance_seed_coa.sql
20261126000400_finance_reserves.sql
20261126000500_finance_capital_loans.sql
20261126000600_finance_assets.sql
20261126000700_finance_treasury.sql
20261126000800_momo_closings.sql
20261126000900_finance_rpcs.sql
20261126001000_finance_dashboard.sql
20261126001100_finance_rls.sql
20261126001200_finance_create_rpcs.sql
```

**Checklist Phase 0 :**
- [ ] 37 migrations présentes
- [ ] Ordre chronologique correct (20261121* < 20261125* < 20261126*)
- [ ] Pas de doublons de timestamp
- [ ] `supabase/config.toml` a `schemas = ["api"]` pour le staging

### 0.2 — Corriger les anomalies frontend AVANT staging

Les 3 composants anomaliques doivent être corrigés en premier :

**Anomalie C (BLOQUANT) — Créer public.v_invoices :**
```sql
-- Option staging rapide : créer public.v_invoices
CREATE OR REPLACE VIEW public.v_invoices AS
  SELECT
    id,
    reference    AS invoice_number,
    status,
    total        AS total_xaf,
    paid_amount  AS paid_xaf,
    invoice_date AS issued_at,
    -- customer_name depuis la table clients (à adapter)
    NULL::text   AS customer_name
  FROM public.invoices;
GRANT SELECT ON public.v_invoices TO authenticated;
```

**Anomalie A (IMPORTANT) — Corriger les colonnes de FinanceInvoices.tsx :**
Modifier `apps/manager/src/pages/finance/FinanceInvoices.tsx` :
```typescript
// AVANT (cassé)
.select("id, invoice_number, status, total, amount_paid, issued_at, due_date, ...")
// APRÈS (old arch)
.select("id, reference as invoice_number, status, total, paid_amount as amount_paid, invoice_date as issued_at, due_date, ...")
```

**Anomalie QueryKey (IMPORTANT) — Unifier les cache keys :**
Modifier les 4 composants pour utiliser `["finance", "dashboard-kpi"]` uniformément.

---

## Phase 1 — Application des Migrations sur Staging

### 1.1 — Lier le projet staging

```bash
# Remplacer STAGING_REF par la ref du projet staging
supabase link --project-ref STAGING_REF
```

### 1.2 — Appliquer les migrations

```bash
# Depuis le répertoire backend
cd "G:\codex appli\app bs4u manager\bs4u-ecosystem\backend"
supabase db push --linked
```

**En cas d'erreur :** Identifier la migration qui échoue et corriger avant de relancer.

### 1.3 — Vérification des schémas créés

```sql
-- Vérifier via Supabase SQL Editor staging
SELECT schema_name FROM information_schema.schemata
WHERE schema_name IN ('biz','api','app','ops','momo','audit','core')
ORDER BY schema_name;
-- Attendu : 7 lignes
```
**Statut attendu : VALIDÉ** (après application)

### 1.4 — Vérifier les fonctions app.*

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'app'
  AND routine_name IN ('next_number','forbid_update_delete','require_permission','has_permission','audit')
ORDER BY routine_name;
-- Attendu : 5 lignes
```

---

## Phase 2 — Seeds Obligatoires (Staging)

Exécuter dans cet ordre exact.

### 2.1 — Number Series

```sql
INSERT INTO ops.number_series (series_code, prefix, pattern, reset_cycle, description)
VALUES
  ('JOURNAL',   'JNL', 'JNL-{YYYY}-{NNNNNN}', 'yearly', 'Écritures comptables'),
  ('LOAN',      'EMR', 'EMR-{YYYY}-{NNNNNN}', 'yearly', 'Emprunts'),
  ('REPAYMENT', 'RMB', 'RMB-{YYYY}-{NNNNNN}', 'yearly', 'Remboursements'),
  ('ASSET',     'IMM', 'IMM-{YYYY}-{NNNNNN}', 'yearly', 'Immobilisations'),
  ('DEPR',      'AMO', 'AMO-{YYYY}-{NNNNNN}', 'yearly', 'Amortissements'),
  ('RECON',     'RAP', 'RAP-{YYYY}-{NNNNNN}', 'yearly', 'Rapprochements')
ON CONFLICT (series_code) DO NOTHING;
-- Vérification : SELECT series_code, prefix FROM ops.number_series; → 6 lignes minimum
```

### 2.2 — Permissions Finance

```sql
INSERT INTO core.permissions (code, domain, label_fr, is_sensitive)
VALUES
  ('biz.finance.journal.read',   'business', 'Lire le journal',          false),
  ('biz.finance.journal.write',  'business', 'Créer des écritures',      true),
  ('biz.finance.capital.read',   'business', 'Lire capital/emprunts',    false),
  ('biz.finance.capital.write',  'business', 'Gérer capital/emprunts',   true),
  ('biz.finance.assets.read',    'business', 'Lire immobilisations',     false),
  ('biz.finance.assets.write',   'business', 'Gérer immobilisations',    true),
  ('biz.finance.reserves.read',  'business', 'Lire réserves',            false),
  ('biz.finance.reserves.write', 'business', 'Gérer réserves',           true),
  ('biz.finance.closing.write',  'business', 'Clôturer périodes',        true),
  ('biz.dashboard.read',         'business', 'Lire tableau de bord',     false)
ON CONFLICT (code) DO NOTHING;
```

### 2.3 — Rôles Finance

```sql
INSERT INTO core.roles (code, label_fr, domain, is_system)
VALUES
  ('finance_admin',  'Admin Finance',    'business', true),
  ('finance_writer', 'Comptable',         'business', false),
  ('finance_reader', 'Lecteur Finance',   'business', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO core.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM core.roles r, core.permissions p
WHERE r.code = 'finance_admin' AND p.code LIKE 'biz.finance.%'
ON CONFLICT DO NOTHING;
```

### 2.4 — Assigner finance_admin à l'utilisateur de test

```sql
-- Remplacer USER_UUID par l'UUID de l'utilisateur de test
INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, source)
SELECT 'USER_UUID'::uuid, r.id, 'global', 'manual'
FROM core.roles r WHERE r.code = 'finance_admin'
ON CONFLICT DO NOTHING;
```

### 2.5 — Période comptable de test

```sql
INSERT INTO biz.financial_periods (label, period_type, starts_at, ends_at, status)
VALUES ('Novembre 2026', 'monthly', '2026-11-01', '2026-11-30', 'open');
-- Vérification : SELECT id, label, status FROM biz.financial_periods; → 1 ligne
```

---

## Phase 3 — Configuration PostgREST Staging

```toml
# supabase/config.toml — staging uniquement
[api]
schemas = ["api", "public"]
extra_search_path = ["public", "extensions"]
```

**Redémarrer le PostgREST staging** après modification.

---

## Phase 4 — Tests Fonctionnels

### 4.1 — Tests RPCs Finance (exécuter via SQL Editor staging)

```sql
-- T1 : Créer une écriture déséquilibrée (doit échouer)
SELECT api.create_journal_entry(
  'Test déséquilibré',
  current_date,
  (SELECT id FROM biz.financial_periods WHERE status='open' LIMIT 1),
  '[{"account_code":"601","debit_xaf":1000,"credit_xaf":0}]'::jsonb
);
-- Attendu : EXCEPTION 'JOURNAL_MIN_LINES' ou 'JOURNAL_UNBALANCED'
```

```sql
-- T2 : Créer une écriture équilibrée (doit réussir)
SELECT api.create_journal_entry(
  'Achat fournitures test',
  current_date,
  (SELECT id FROM biz.financial_periods WHERE status='open' LIMIT 1),
  '[{"account_code":"601","debit_xaf":5000,"credit_xaf":0},
    {"account_code":"401","debit_xaf":0,"credit_xaf":5000}]'::jsonb
);
-- Attendu : UUID retourné, entry_number = 'JNL-2026-000001'
```

```sql
-- T3 : Créer un emprunt
SELECT api.create_loan(
  'Banque de test', 'bank_loan', 500000, 5.0, current_date, null, 'Test staging'
);
-- Attendu : UUID retourné, loan_number = 'EMR-2026-000001'
```

```sql
-- T4 : Vérifier le dashboard KPI
SELECT * FROM api.v_dashboard_finance;
-- Attendu : 1 ligne avec les KPI de la période courante
```

```sql
-- T5 : Tester l'idempotence (rejouer T2 avec même clé)
-- La deuxième exécution avec même idempotency_key doit retourner le même UUID
```

### 4.2 — Tests de non-régression old arch

```sql
-- Vérifier que public.* n'est pas impacté
SELECT COUNT(*) FROM public.cash_sessions;      -- doit retourner valeur pré-migration
SELECT COUNT(*) FROM public.cash_movements;     -- idem
SELECT COUNT(*) FROM public.mobile_money_accounts; -- idem
SELECT COUNT(*) FROM public.organizations;      -- idem
-- Vérifier RLS old arch (depuis compte utilisateur authentifié)
SELECT * FROM public.products LIMIT 1;          -- données filtrées par org
```

### 4.3 — Tests UI (après démarrage serveur staging)

| Test | Page | Critère | Statut Attendu |
|------|------|---------|---------------|
| T1 | `/finance` | Dashboard KPI visible | NON EXÉCUTÉ |
| T2 | `/finance/journal` | Liste écritures vide ou données | NON EXÉCUTÉ |
| T3 | `/finance/journal` | Créer écriture → succès | NON EXÉCUTÉ |
| T4 | `/finance/emprunts` | Créer emprunt → succès | NON EXÉCUTÉ |
| T5 | `/finance/immobilisations` | Créer actif → plan généré | NON EXÉCUTÉ |
| T6 | `/finance/cloture` | Clôturer période avec écritures draft → erreur | NON EXÉCUTÉ |
| T7 | `/finance/factures` | Liste factures (public.invoices) | NON EXÉCUTÉ |
| T8 | `/finance/encaissements` | Liste encaissements (après correction) | NON EXÉCUTÉ |
| T9 | `/finance/depenses` | Liste dépenses (public.v_depenses) | NON EXÉCUTÉ |

---

## Phase 5 — Validation Staging (Minimum 14 jours)

- Utilisation quotidienne du module Finance sur staging
- Monitoring erreurs PostgREST
- Vérification KPI incohérents
- Formation utilisateurs clés

---

## Phase 6 — Passage en Production

**REQUIERT OBLIGATOIREMENT :**
- [ ] Toutes les phases staging complétées
- [ ] Tests T1-T9 validés avec preuves
- [ ] Non-régression old arch confirmée
- [ ] **Backup production créé et vérifié** (snapshot Supabase ou pg_dump)
- [ ] **Autorisation écrite du responsable technique**
- [ ] Fenêtre de maintenance communiquée aux utilisateurs

```bash
# UNIQUEMENT APRÈS AUTORISATION ÉCRITE ET BACKUP CONFIRMÉ
# NE PAS EXÉCUTER MAINTENANT
# supabase db push --linked  # (sur projet production lié)
```

---

## Plan de Rollback

```sql
-- Si la migration échoue à mi-chemin et qu'aucune donnée n'a été saisie dans biz.*
-- NE PAS EXÉCUTER sans vérification préalable
DROP SCHEMA IF EXISTS biz CASCADE;
DROP SCHEMA IF EXISTS api CASCADE;
DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS ops CASCADE;
DROP SCHEMA IF EXISTS momo CASCADE;
DROP SCHEMA IF EXISTS audit CASCADE;
DROP SCHEMA IF EXISTS core CASCADE;
-- NE PAS toucher public.* -- JAMAIS
```

> **Note rollback :** Si des données ont été saisies dans `biz.*`, restaurer depuis le backup plutôt que d'utiliser DROP SCHEMA.

---

## Résumé du Planning

| Phase | Durée | Autorisation |
|-------|-------|-------------|
| Phase 0 — Préparation + corrections frontend | 1-2 jours | — |
| Phase 1 — Application staging | 2-4 heures | — |
| Phase 2 — Seeds staging | 30 minutes | — |
| Phase 3 — PostgREST staging | 1 heure | — |
| Phase 4 — Tests fonctionnels | 1-2 jours | — |
| Phase 5 — Validation staging | 14 jours minimum | — |
| Phase 6 — Production | 2 heures | ✅ OBLIGATOIRE |
| **Total** | **~17-19 jours** | |
