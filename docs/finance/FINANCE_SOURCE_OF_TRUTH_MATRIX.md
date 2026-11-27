# Matrice Source de Vérité — Module Finance

> Date : 2026-11-27  
> Méthode : Analyse statique + vérification distante READ-ONLY  
> Statut colonnes : VALIDÉ (vérification distante `public.invoices`) / VALIDÉ STATIQUEMENT (migrations locales)

---

## Principe

Une et une seule source de vérité par domaine financier. Aucun double-comptage autorisé.

---

## 1. Matrice par Domaine

| Domaine | Source de Vérité | Schéma | Table/Vue principale | Architecture | Statut Prod |
|---------|-----------------|--------|---------------------|--------------|-------------|
| **Périodes comptables** | `biz.financial_periods` | biz | `biz.financial_periods` | Nouvelle | ❌ Absent prod |
| **Plan comptable** | `biz.chart_of_accounts` | biz | `biz.chart_of_accounts` | Nouvelle (SYSCOHADA) | ❌ Absent prod |
| **Écritures comptables** | `biz.journal_entries` | biz | `biz.journal_entries` + `biz.journal_lines` | Nouvelle | ❌ Absent prod |
| **Ecritures old arch** | `public.journal_entries` | public | `public.journal_entries` | Ancienne | ✅ Présent prod |
| **Réserves** | `biz.reserves` | biz | `biz.reserves` + `biz.reserve_movements` | Nouvelle | ❌ Absent prod |
| **Capital** | `biz.capital_contributions` | biz | `biz.capital_contributions` | Nouvelle | ❌ Absent prod |
| **Emprunts** | `biz.loans` | biz | `biz.loans` + `biz.loan_repayments` | Nouvelle | ❌ Absent prod |
| **Immobilisations** | `biz.assets` | biz | `biz.assets` + `biz.asset_depreciation_schedules` | Nouvelle | ❌ Absent prod |
| **Amortissements** | `biz.depreciation_entries` | biz | `biz.depreciation_entries` | Nouvelle | ❌ Absent prod |
| **Trésorerie/Rapprochement** | `biz.treasury_reconciliations` | biz | `biz.treasury_reconciliations` | Nouvelle | ❌ Absent prod |
| **Comptes bancaires** | `biz.bank_accounts` | biz | `biz.bank_accounts` + `biz.bank_transactions` | Nouvelle | ❌ Absent prod |
| **Comptes MoMo** | `momo.accounts` | momo | `momo.accounts` | Nouvelle | ❌ Absent prod |
| **Transactions MoMo** | `momo.transactions` | momo | `momo.transactions` | Nouvelle | ❌ Absent prod |
| **Clôtures journalières MoMo** | `momo.daily_closings` | momo | `momo.daily_closings` | Nouvelle | ❌ Absent prod |
| **Sessions caisse** | `public.cash_sessions` | public | `public.cash_sessions` | Ancienne | ✅ Présent prod |
| **Mouvements caisse** | `public.cash_movements` | public | `public.cash_movements` | Ancienne | ✅ Présent prod |
| **Transactions MoMo (old)** | `public.mobile_money_transactions` | public | `public.mobile_money_transactions` | Ancienne | ✅ Présent prod |
| **Dépenses** | `public.v_depenses` | public | `public.v_depenses` (vue) | Ancienne | ✅ Vue présente prod |
| **Factures** | `public.invoices` | public | `public.invoices` | Ancienne | ✅ Présent prod |
| **Règles d'allocation** | `biz.allocation_rules` | biz | `biz.allocation_rules` | Nouvelle | ❌ Absent prod |

---

## 2. Règles d'Exclusivité Obligatoires

Ces règles doivent être respectées pour éviter le double-comptage :

| Règle | Description | Risque si violée |
|-------|-------------|-----------------|
| **R1 — Journal exclusif** | Ne jamais enregistrer la même écriture dans `public.journal_entries` ET `biz.journal_entries` | Double-comptage du CA et des charges |
| **R2 — MoMo exclusif** | Ne jamais enregistrer la même transaction dans `public.mobile_money_transactions` ET `momo.transactions` | Double-comptage des commissions et de la trésorerie MoMo |
| **R3 — Dépenses exclusives** | Ne jamais enregistrer la même dépense dans `public.expenses` ET `biz.expenses` | Double-comptage des charges |
| **R4 — Caisse non migrée** | `public.cash_sessions` reste la source de vérité caisse — ne pas migrer vers biz | Perte de données si migration partielle |
| **R5 — MoMo comptes** | Décision architecture requise : `public.mobile_money_accounts` OU `momo.accounts`, pas les deux simultanément | Incohérence des soldes |

---

## 3. Anomalies Critiques de Source de Vérité

### A3.1 — FinanceInvoices vs public.invoices (CRITIQUE)

**Problème :** `FinanceInvoices.tsx` utilise `supabase.from("invoices")` et sélectionne les colonnes :
```
invoice_number, status, total, amount_paid, issued_at, due_date, client:client_id(...)
```

**Colonnes réelles de `public.invoices` (VALIDÉ distante) :**
| Colonne demandée | Colonne réelle | Statut |
|-----------------|----------------|--------|
| `invoice_number` | `reference` | ❌ NOM DIFFÉRENT |
| `total` | `total` | ✅ Identique |
| `amount_paid` | `paid_amount` | ❌ NOM DIFFÉRENT |
| `issued_at` | `invoice_date` ou `sent_at` | ❌ NOM DIFFÉRENT |
| `due_date` | `due_date` | ✅ Identique |

**Impact :** `FinanceInvoices.tsx` retourne NULL ou erreur sur `invoice_number`, `amount_paid`, `issued_at`. **Page cassée en production actuelle et en new arch.**

### A3.2 — FinanceEncaissements vs public.v_invoices (CRITIQUE)

**Problème :** `FinanceEncaissements.tsx` utilise `supabase.from("v_invoices")`.

**Vérification distante :** `public.v_invoices` **absente** de la production.

**Impact :** Page retourne erreur 400. **Bloquant en production actuelle.**

### A3.3 — Conflit biz.invoices vs public.invoices

`20261121001100_biz_finance.sql` crée `biz.invoices` (new arch). `public.invoices` existe en production old arch. Ces deux tables ont des structures différentes. `FinanceInvoices.tsx` cible `public.invoices` mais avec des noms de colonnes d'une tierce architecture (ni old arch, ni new arch biz.invoices). **C'est une troisième architecture fantôme.**

---

## 4. Tableau de Bord KPI — Source de Données

| KPI | Source de calcul | Table(s) sous-jacentes | Statut |
|-----|-----------------|----------------------|--------|
| `kpi_revenue_sales_xaf` | Comptes 70* du journal | `biz.journal_entries` + `biz.journal_lines` | ❌ Tables absentes |
| `kpi_revenue_services_xaf` | Comptes 71* du journal | Idem | ❌ |
| `kpi_commissions_xaf` | Comptes 73* du journal | Idem | ❌ |
| `kpi_expenses_xaf` | Comptes 6* du journal | Idem | ❌ |
| `kpi_cash_xaf` | Solde net comptes 51* | `biz.journal_entries` | ❌ |
| `kpi_momo_xaf` | Somme des soldes MoMo actifs | `momo.accounts` | ❌ |
| `kpi_stock_value_xaf` | qty × unit_cost des mouvements stock | `biz.stock_movements` ⚠️ | ❌ Table non confirmée |
| `kpi_reserves_xaf` | Somme des réserves actives | `biz.reserves` | ❌ |
| `kpi_outstanding_loans_xaf` | Capital emprunts actifs - remboursements | `biz.loans` + `biz.loan_repayments` | ❌ |
| `kpi_capital_xaf` | Somme des apports capital | `biz.capital_contributions` | ❌ |
| `kpi_depreciation_xaf` | Somme des écritures amortissement / période | `biz.depreciation_entries` | ❌ |
| `kpi_free_funds_xaf` | Trésorerie - Réserves - Dettes | Calculé | ❌ |

**Toutes les 12 métriques du dashboard sont BLOQUÉES en production** (tables new arch absentes).

---

## 5. Vues PostgREST — Source vs Exposition

| Vue API | Source de données | PostgREST actuel (public) | Statut |
|---------|------------------|--------------------------|--------|
| `api.v_dashboard_finance` | `biz.*` | ❌ Schéma `api` absent | NON EXPOSÉ |
| `api.v_journal_entries` | `biz.journal_entries` | ❌ | NON EXPOSÉ |
| `api.v_reserves` | `biz.reserves` | ❌ | NON EXPOSÉ |
| `api.v_assets` | `biz.assets` | ❌ | NON EXPOSÉ |
| `api.v_loans` | `biz.loans` | ❌ | NON EXPOSÉ |
| `api.v_capital_contributions` | `biz.capital_contributions` | ❌ | NON EXPOSÉ |
| `api.v_treasury_reconciliations` | `biz.treasury_reconciliations` | ❌ | NON EXPOSÉ |
| `api.v_momo_daily_closings` | `momo.daily_closings` | ❌ | NON EXPOSÉ |
| `api.v_finance_periods_summary` | `biz.financial_periods` | ❌ | NON EXPOSÉ |
| `public.v_depenses` | `public.*` | ✅ Exposé via public | FONCTIONNEL |
| `public.invoices` | `public.*` | ✅ Exposé via public | PARTIELLEMENT (colonnes mal mappées) |
