# Finance Module — Schéma final (F0–F8)

> Migration range : `20261126000100` → `20261126001200`  
> Projet Supabase : `mvebwahpforfxqohjusp`  
> Schéma principal : `biz.*`  
> Vues publiques : `api.*`  
> Règle monétaire : **bigint XAF**, colonnes suffixées `_xaf` — jamais float/numeric

---

## 1. Tables biz.*

### biz.financial_periods
Périodes comptables (mois). Une seule peut être `open` à la fois.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | gen_random_uuid() |
| label | text NOT NULL | ex: "Novembre 2026" |
| starts_at | date NOT NULL | |
| ends_at | date NOT NULL | |
| status | text NOT NULL | CHECK IN ('open','closed','locked') |
| created_at | timestamptz | default now() |

**Trigger** : `chk_one_open_period` — interdit deux périodes `open` simultanées.

---

### biz.journal_entries
En-tête des écritures comptables.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| entry_number | text UNIQUE NOT NULL | format JNL-YYYY-NNNNNN |
| entry_date | date NOT NULL | |
| financial_period_id | uuid FK → biz.financial_periods | |
| status | text NOT NULL | CHECK IN ('draft','posted','reversed') |
| description | text NOT NULL | |
| source_type | text | ex: 'sale', 'repayment', 'depreciation' |
| source_id | uuid | référence vers la table source |
| total_xaf | bigint NOT NULL default 0 | |
| created_at | timestamptz | |

**Append-only** : bloqué par `app.forbid_update_delete()` sauf transition `draft→posted`.

---

### biz.journal_lines
Lignes de débit/crédit.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| entry_id | uuid FK → biz.journal_entries | NOT NULL |
| line_number | int NOT NULL | |
| account_code | text NOT NULL | SYSCOHADA |
| debit_xaf | bigint NOT NULL default 0 | |
| credit_xaf | bigint NOT NULL default 0 | |

**Contraintes** :
- `chk_line_exclusive` : NOT (debit_xaf > 0 AND credit_xaf > 0)
- `chk_line_nonzero` : debit_xaf > 0 OR credit_xaf > 0
- Balance (débit = crédit) vérifiée au passage `draft → posted`

**Append-only** : `app.forbid_update_delete()`

---

### biz.chart_of_accounts
Plan comptable SYSCOHADA.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| code | text UNIQUE NOT NULL | ex: '601', '411' |
| label | text NOT NULL | |
| account_class | text NOT NULL | '1'..'9' |
| is_debit_normal | bool NOT NULL | |
| created_at | timestamptz | |

Seed : ~80 comptes essentiels (migration `000300`).

---

### biz.reserve_movements
Mouvements des réserves légales/statutaires. **Append-only**.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| financial_period_id | uuid FK | |
| movement_type | text | CHECK IN ('allocation','withdrawal','revaluation') |
| amount_xaf | bigint NOT NULL | |
| description | text | |
| created_at | timestamptz | |

---

### biz.capital_contributions
Apports au capital. **Append-only**.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| contributor_name | text NOT NULL | |
| amount_xaf | bigint NOT NULL | |
| contributed_at | date NOT NULL | |
| notes | text | |

---

### biz.loans
Emprunts (bank, personnel, fournisseur, autre).

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| loan_number | text UNIQUE NOT NULL | format EMR-YYYY-NNNNNN |
| lender | text NOT NULL | |
| loan_type | text NOT NULL | CHECK IN ('bank','personal','supplier','other') |
| principal_xaf | bigint NOT NULL | |
| rate_pct | numeric(5,2) default 0 | taux annuel |
| disbursed_at | date NOT NULL | |
| due_date | date | nullable |
| status | text NOT NULL | CHECK IN ('active','fully_repaid','defaulted') |
| notes | text | |

---

### biz.loan_repayments
Remboursements d'emprunt. **Append-only**.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| loan_id | uuid FK → biz.loans | NOT NULL |
| repayment_date | date NOT NULL | |
| principal_xaf | bigint NOT NULL default 0 | |
| interest_xaf | bigint NOT NULL default 0 | |
| fees_xaf | bigint NOT NULL default 0 | |
| total_xaf | bigint NOT NULL | |

**Contrainte** : `chk_repayment_sum` : principal_xaf + interest_xaf + fees_xaf = total_xaf

---

### biz.assets
Immobilisations corporelles/incorporelles.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| asset_number | text UNIQUE NOT NULL | format IMM-YYYY-NNNNNN |
| name | text NOT NULL | |
| asset_category | text NOT NULL | CHECK IN ('it_equipment','office_equipment','furniture','vehicle','other') |
| acquisition_cost_xaf | bigint NOT NULL | |
| acquisition_date | date NOT NULL | |
| useful_life_months | int NOT NULL | |
| residual_value_xaf | bigint NOT NULL default 0 | |
| financial_period_id | uuid FK | période d'acquisition |
| status | text NOT NULL | CHECK IN ('active','disposed','fully_depreciated') |
| notes | text | |

---

### biz.asset_depreciation_schedules
Tableau d'amortissement pré-calculé par actif.

| Colonne | Type | Contrainte |
|---------|------|------------|
| id | uuid PK | |
| asset_id | uuid FK → biz.assets | NOT NULL |
| period_number | int NOT NULL | 1..N |
| period_start | date NOT NULL | |
| period_end | date NOT NULL | |
| amount_xaf | bigint NOT NULL | amortissement mensuel |
| cumulative_xaf | bigint NOT NULL | amortissement cumulé |

**Calcul** : `(cost - residual) / months`, dernier mois prend le reste.

---

### biz.depreciation_entries
Dotations effectives passées en journal. **Append-only**.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| asset_id | uuid FK | |
| financial_period_id | uuid FK | |
| amount_xaf | bigint NOT NULL | |
| journal_entry_id | uuid FK | écriture générée |
| idempotency_key | text UNIQUE | |

---

### biz.bank_accounts
Comptes bancaires et caisses.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| account_name | text NOT NULL | |
| account_type | text | CHECK IN ('bank','cash','mobile_money') |
| bank_name | text | |
| account_number | text | |
| is_active | bool default true | |

---

### biz.bank_transactions
Mouvements de trésorerie.

| Colonne | Type | Note |
|---------|------|------|
| id | uuid PK | |
| bank_account_id | uuid FK | NOT NULL |
| financial_period_id | uuid FK | |
| transaction_date | date NOT NULL | |
| amount_xaf | bigint NOT NULL | positif=entrée, négatif=sortie |
| description | text | |
| reference | text | |
| is_reconciled | bool default false | |

---

## 2. Vues publiques api.*

| Vue | Description |
|-----|-------------|
| `api.v_financial_periods` | Périodes avec statut |
| `api.v_journal_entries` | Écritures avec `period_label` et `financial_period_id` |
| `api.v_assets` | Actifs avec `book_value_xaf` et `accumulated_depreciation_xaf` calculés |
| `api.v_loans` | Emprunts avec `total_repaid_xaf` et `remaining_xaf` calculés |
| `api.v_treasury_summary` | Soldes par compte bancaire |
| `api.v_momo_daily_closings` | Clôtures MoMo agrégées |

Toutes déclarées `WITH (security_invoker = true)` — les droits RLS de l'utilisateur s'appliquent.

---

## 3. RPCs api.*

### api.create_loan
```sql
api.create_loan(
  p_lender text, p_loan_type text, p_principal_xaf bigint,
  p_rate_pct numeric, p_disbursed_at date, p_due_date date, p_notes text
) returns uuid
```
- Génère `loan_number` via `app.next_number('LOAN')` → `EMR-YYYY-NNNNNN`
- Insère dans `biz.loans`

### api.create_asset
```sql
api.create_asset(
  p_name text, p_asset_category text, p_acquisition_cost_xaf bigint,
  p_acquisition_date date, p_useful_life_months int,
  p_residual_value_xaf bigint, p_notes text
) returns uuid
```
- Génère `asset_number` via `app.next_number('ASSET')` → `IMM-YYYY-NNNNNN`
- Insère dans `biz.assets`
- Génère le tableau complet dans `biz.asset_depreciation_schedules`

### api.create_journal_entry
```sql
api.create_journal_entry(
  p_description text, p_entry_date date, p_period_id uuid, p_lines jsonb
) returns uuid
```
- Génère `entry_number` via `app.next_number('JOURNAL')` → `JNL-YYYY-NNNNNN`
- Valide débit = crédit avant insertion
- Insère en-tête + lignes en statut `draft`

### api.compute_depreciation
```sql
api.compute_depreciation(p_period_id uuid, p_idempotency_key_prefix text) 
returns jsonb -- { entries_created, total_xaf }
```
- Passe les dotations via `biz.depreciation_entries` (idempotent)

### api.get_dashboard_kpi
```sql
api.get_dashboard_kpi(p_period_id uuid) returns jsonb
```
Retourne un objet `DashboardKpi` avec tous les `kpi_*_xaf` fields.

---

## 4. Ordre d'application des migrations

```
20261126000100  financial_periods, chart_of_accounts
20261126000200  journal_entries, journal_lines, chart_of_accounts (triggers)
20261126000300  seed chart_of_accounts (~80 comptes SYSCOHADA)
20261126000400  reserve_movements, capital_contributions
20261126000500  loans, loan_repayments
20261126000600  assets, asset_depreciation_schedules, depreciation_entries
20261126000700  bank_accounts, bank_transactions, treasury views
20261126000800  momo_daily_closings view
20261126000900  RPCs: compute_depreciation, get_dashboard_kpi (anciens)
20261126001000  dashboard KPI view api.*
20261126001100  RLS policies (authenticated read/write par table)
20261126001200  RPCs: create_loan, create_asset, create_journal_entry
                       Correction view v_journal_entries (+ financial_period_id)
```

---

## 5. Utilitaires app.*

| Fonction | Usage |
|----------|-------|
| `app.next_number(series text)` | Séquences auto-incrémentées par année |
| `app.forbid_update_delete()` | Trigger append-only |
| `app.require_permission(perm text)` | Contrôle RBAC |
| `app.has_permission(perm text)` | Prédicat RBAC |
| `app.idempotency_begin/finish()` | Clés d'idempotence |
| `app.audit()` | Trigger d'audit |
| `app.touch_row()` | updated_at automatique |

---

## 6. Règles de non-double-comptage

- Les transferts inter-comptes (`biz.bank_transactions` entre comptes internes) ne sont **pas** comptabilisés en revenus
- Les clôtures MoMo (`biz.v_momo_daily_closings`) agrègent uniquement les commissions nettes (`kpi_commissions_xaf`), pas les montants bruts transactionnels
- `kpi_revenue_sales_xaf` = ventes produits uniquement (table `biz.sales`)
- `kpi_revenue_services_xaf` = services uniquement
- Les remboursements d'emprunt n'impactent **pas** le compte de résultat (ils sont des flux de trésorerie)
