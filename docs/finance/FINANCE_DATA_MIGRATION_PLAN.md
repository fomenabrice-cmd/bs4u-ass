# Plan de Migration des Données Historiques — Module Finance

> Date : 2026-11-27  
> Méthode : Analyse des incompatibilités de schéma old arch vs new arch  
> Contrainte : Aucune migration des données sans autorisation. Lecture seule.

---

## 1. Décision Architecturale

### 1.1 Principes directeurs

Le module Finance (new arch `biz.*`) est un **démarrage à zéro**. Il n'y a pas de données Finance historiques dans `biz.*` car ces tables n'existent pas en production.

**Décision validée :** Ne pas migrer les données `public.*` vers `biz.*`. Les deux systèmes opèrent sur des schémas distincts avec des modèles incompatibles.

### 1.2 Données qui RESTENT dans public.* (ne pas toucher)

| Table | Données | Décision |
|-------|---------|---------|
| `public.journal_entries` | Écritures comptables historiques | ✅ Conserver — lecture seule |
| `public.journal_lines` | Lignes d'écriture historiques | ✅ Conserver — lecture seule |
| `public.chart_of_accounts` | Plan comptable old arch (UUID FK) | ✅ Conserver — incompatible avec SYSCOHADA |
| `public.expenses` | Dépenses historiques | ✅ Conserver — lecture seule |
| `public.mobile_money_accounts` | Comptes MoMo old arch | ✅ Conserver — module MoMo actif |
| `public.mobile_money_transactions` | Transactions MoMo historiques | ✅ Conserver — module MoMo actif |
| `public.invoices` | Factures old arch | ✅ Conserver — utilisé par FinanceInvoices |
| `public.cash_sessions` | Sessions caisse | ✅ Conserver — module caisse actif |
| `public.cash_movements` | Mouvements caisse | ✅ Conserver — module caisse actif |

### 1.3 Données nouvelles dans biz.* (repartir de zéro)

| Table | Données initiales | Méthode |
|-------|-----------------|---------|
| `biz.financial_periods` | Première période comptable | Seed manuel |
| `biz.chart_of_accounts` | 80 comptes SYSCOHADA | Seed automatique (mig 000300) |
| `biz.journal_entries` | Vide — saisie future uniquement | — |
| `biz.reserves` | 4 réserves par défaut | Seed automatique (mig 000400) |
| `biz.capital_contributions` | Vide — saisie future | — |
| `biz.loans` | Vide — saisie future | — |
| `biz.assets` | Vide — saisie future | — |
| `momo.accounts` | Vide — à créer manuellement | — |

---

## 2. Incompatibilités Irréparables

Ces incompatibilités justifient la décision de ne pas migrer :

### 2.1 Incompatibilité du plan comptable

| Aspect | Old arch (`public.*`) | New arch (`biz.*`) |
|--------|----------------------|-------------------|
| Clé de compte | UUID (`account_id`) | Code texte SYSCOHADA (`account_code`) |
| Structure | Table avec FK UUID | Référence directe par code (ex: `'601'`) |
| Migration possible | ❌ Mapping UUID→code non automatisable sans table de correspondance manuelle |

**Conséquence :** Les `public.journal_lines` référencent `account_id UUID`. Les `biz.journal_lines` référencent `account_code TEXT`. Il n'existe pas de correspondance automatique entre les deux.

### 2.2 Incompatibilité des types monétaires

| Aspect | Old arch | New arch |
|--------|---------|---------|
| Type | `NUMERIC` | `BIGINT XAF` |
| Conversion | Possible (XAF = entiers) | Vérification préalable obligatoire |
| Risque | Si un montant old arch a des décimales | Troncature silencieuse |

**Vérification recommandée avant toute migration de données (READ-ONLY) :**
```sql
-- Vérifier l'absence de décimales dans les montants old arch
SELECT COUNT(*) FROM public.journal_lines
WHERE debit % 1 != 0 OR credit % 1 != 0;
-- Attendu : 0 (tous les XAF sont des entiers)
```

### 2.3 Incompatibilité des colonnes invoices

| Colonne FinanceInvoices | Colonne public.invoices (VALIDÉ) | Statut |
|------------------------|----------------------------------|--------|
| `invoice_number` | `reference` | ❌ Différent |
| `amount_paid` | `paid_amount` | ❌ Différent |
| `issued_at` | `invoice_date` / `sent_at` | ❌ Différent |
| `total` | `total` | ✅ Identique |
| `due_date` | `due_date` | ✅ Identique |

---

## 3. Plan de Migration Optionnelle (Si Demandé)

Si une migration de données `public.journal_entries` → `biz.journal_entries` est demandée à l'avenir, voici les prérequis :

### 3.1 Prérequis obligatoires

1. `biz.chart_of_accounts` seedé avec SYSCOHADA
2. Table de correspondance `account_id UUID → account_code TEXT` créée manuellement
3. `biz.financial_periods` créée pour couvrir les périodes historiques
4. Vérification que tous les montants old arch sont des entiers
5. Script de migration avec transactions et rollback
6. Backup complet avant exécution

### 3.2 Exemple de script de migration (NON EXÉCUTÉ — pour référence)

```sql
-- NE PAS EXÉCUTER sans autorisation écrite et backup confirmé
-- Ce script est fourni à titre informatif uniquement

-- Étape 1 : Créer la table de correspondance (à remplir manuellement)
CREATE TABLE migration_account_mapping (
  old_account_id  uuid NOT NULL,
  new_account_code text NOT NULL,
  CONSTRAINT pk PRIMARY KEY (old_account_id)
);
-- INSERT INTO migration_account_mapping VALUES (...); -- à faire manuellement

-- Étape 2 : Migration des écritures (brouillon uniquement)
INSERT INTO biz.journal_entries (
  entry_number, financial_period_id, entry_date, status, description, created_by
)
SELECT
  'MIG-' || je.id::text,
  (SELECT id FROM biz.financial_periods WHERE starts_at <= je.created_at::date ORDER BY starts_at DESC LIMIT 1),
  je.created_at::date,
  'draft',  -- brouillon : validation manuelle requise
  je.description,
  je.created_by
FROM public.journal_entries je
WHERE je.organization_id = 'ORG_ID';

-- Étape 3 : Migration des lignes (avec mapping des comptes)
INSERT INTO biz.journal_lines (
  entry_id, line_number, account_code, debit_xaf, credit_xaf
)
SELECT
  new_je.id,
  jl.line_number,
  mam.new_account_code,
  jl.debit::bigint,
  jl.credit::bigint
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.entry_id
JOIN biz.journal_entries new_je ON new_je.entry_number = 'MIG-' || je.id::text
JOIN migration_account_mapping mam ON mam.old_account_id = jl.account_id;
```

---

## 4. Données à Saisir Manuellement au Démarrage

Pour le premier démarrage du module Finance en staging, ces données sont nécessaires :

### 4.1 Période comptable initiale

```sql
-- À saisir via l'interface Finance ou SQL Editor staging
INSERT INTO biz.financial_periods (label, period_type, starts_at, ends_at, status)
VALUES ('Novembre 2026', 'monthly', '2026-11-01', '2026-11-30', 'open');
```

### 4.2 Comptes MoMo (si migration de MoMo vers new arch décidée)

```sql
-- Exemple — adapter selon les comptes réels
INSERT INTO momo.accounts (operator, phone_number, display_name, is_active, balance_xaf)
VALUES
  ('orange_money', '+237600000000', 'Orange Money BS4U', true, 0),
  ('mtn_momo',     '+237670000000', 'MTN MoMo BS4U',    true, 0);
```

### 4.3 Number Series

```sql
INSERT INTO ops.number_series (series_code, prefix, pattern, reset_cycle, description)
VALUES
  ('JOURNAL',    'JNL',  'JNL-{YYYY}-{NNNNNN}',  'yearly', 'Écritures comptables'),
  ('LOAN',       'EMR',  'EMR-{YYYY}-{NNNNNN}',  'yearly', 'Emprunts'),
  ('REPAYMENT',  'RMB',  'RMB-{YYYY}-{NNNNNN}',  'yearly', 'Remboursements'),
  ('ASSET',      'IMM',  'IMM-{YYYY}-{NNNNNN}',  'yearly', 'Immobilisations'),
  ('DEPR',       'AMO',  'AMO-{YYYY}-{NNNNNN}',  'yearly', 'Amortissements'),
  ('RECON',      'RAP',  'RAP-{YYYY}-{NNNNNN}',  'yearly', 'Rapprochements')
ON CONFLICT (series_code) DO NOTHING;
```

---

## 5. Résumé

| Décision | Valeur |
|---------|--------|
| Données Finance à migrer depuis old arch | **0** (repartir à zéro) |
| Tables old arch à conserver intactes | 9 |
| Incompatibilités irréparables | 3 |
| Seeds obligatoires avant premier usage | 6 |
| Periode de coexistence old/new arch | Indéfinie (Option B : migration progressive) |
| Données caisse à migrer | Non (public.cash_sessions reste la source) |
| Données MoMo à migrer | Décision architecture en attente |

**Statut global : VALIDÉ STATIQUEMENT — Aucune migration de données requise pour démarrer le module Finance.**
