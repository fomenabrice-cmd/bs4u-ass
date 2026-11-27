# Inventaire des Pages Finance — BS4U Manager

> Date : 2026-11-27  
> Méthode : Lecture statique de `apps/manager/src/App.tsx` + 17 composants + 9 services  
> Statut : **VALIDÉ STATIQUEMENT** (aucun test d'exécution effectué)  
> Contrainte : Lecture seule. Aucune modification de la base distante.

---

## Légende

| Symbole | Signification |
|---------|---------------|
| ✅ VALIDÉ | Vérifié par exécution réelle |
| 📋 VALIDÉ STATIQUEMENT | Vérifié par analyse statique du code source |
| ⚠️ NON EXÉCUTÉ | Analysé mais non testé en environnement live |
| ❌ BLOQUÉ | Dépendance manquante ou anomalie critique détectée |
| ➖ NON APPLICABLE | Hors périmètre |

---

## 1. Fichier de Routage

**Fichier** : `apps/manager/src/App.tsx`  
**Pattern** : React Router v7 — `<Routes>` / `<Route>` via `BrowserRouter`  
**Lazy-loading** : Tous les composants Finance chargés via `React.lazy()`  
**Guard** : `ProtectedRoute` → `AppShell` (vérifie `isAuthenticated` via `useAuth()`)

---

## 2. Inventaire Complet des 17 Routes Finance

### 2.1 Tableau de bord et KPI

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance` | `FinanceDashboard` | `pages/finance/FinanceDashboard.tsx` |
| `/finance/marges` | `FinanceMargins` | `pages/finance/FinanceMargins.tsx` |
| `/finance/commissions` | `FinanceCommissions` | `pages/finance/FinanceCommissions.tsx` |
| `/finance/rentabilite` | `FinanceProfitability` | `pages/finance/FinanceProfitability.tsx` |
| `/finance/rapports-financiers` | `FinanceReports` | `pages/finance/FinanceReports.tsx` |

### 2.2 Comptabilité et période

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance/journal` | `FinanceJournal` | `pages/finance/FinanceJournal.tsx` |
| `/finance/cloture` | `FinanceClosings` | `pages/finance/FinanceClosings.tsx` |

### 2.3 Capital, emprunts, immobilisations

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance/capital` | `FinanceCapital` | `pages/finance/FinanceCapital.tsx` |
| `/finance/emprunts` | `FinanceLoans` | `pages/finance/FinanceLoans.tsx` |
| `/finance/immobilisations` | `FinanceAssets` | `pages/finance/FinanceAssets.tsx` |
| `/finance/amortissements` | `FinanceDepreciation` | `pages/finance/FinanceDepreciation.tsx` |

### 2.4 Trésorerie et réserves

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance/tresorerie` | `FinanceTreasury` | `pages/finance/FinanceTreasury.tsx` |
| `/finance/reserves` | `FinanceReserves` | `pages/finance/FinanceReserves.tsx` |

### 2.5 Transactions (architecture mixte — voir anomalies)

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance/factures` | `FinanceInvoices` | `pages/finance/FinanceInvoices.tsx` |
| `/finance/encaissements` | `FinanceEncaissements` | `pages/finance/FinanceEncaissements.tsx` |
| `/finance/depenses` | `FinanceDepenses` | `pages/finance/FinanceDepenses.tsx` |

### 2.6 Paramètres

| Route | Composant | Fichier |
|-------|-----------|---------|
| `/finance/parametres-finance` | `FinanceSettings` | `pages/finance/FinanceSettings.tsx` |

---

## 3. Inventaire des Endpoints Supabase par Composant

### 3.1 Architecture Nouvelle (api.*) — via pattern `as never`

| Composant | Endpoint Supabase | Type | Vue/RPC cible | QueryKey TanStack |
|-----------|------------------|------|----------------|-------------------|
| FinanceDashboard | `v_dashboard_finance` | VIEW | `api.v_dashboard_finance` | `["finance","dashboard"]` |
| FinanceDashboard | `v_finance_periods_summary` | VIEW | `api.v_finance_periods_summary` | `["finance","periods-summary"]` |
| FinanceMargins | `v_dashboard_finance` | VIEW | `api.v_dashboard_finance` | `["finance","dashboard-kpi"]` ⚠️ |
| FinanceCommissions | `v_dashboard_finance` | VIEW | `api.v_dashboard_finance` | `["finance","dashboard-kpi"]` ⚠️ |
| FinanceProfitability | `v_dashboard_finance` | VIEW | `api.v_dashboard_finance` | `["finance","dashboard-kpi"]` ⚠️ |
| FinanceReports | `v_dashboard_finance` | VIEW | `api.v_dashboard_finance` | `["finance","dashboard-kpi"]` ⚠️ |
| FinanceJournal | `v_journal_entries` | VIEW | `api.v_journal_entries` | `["finance","journal"]` |
| FinanceJournal | `journal_entries` | TABLE update | `biz.journal_entries` | — |
| FinanceJournal | `create_journal_entry` | RPC | `api.create_journal_entry` | — |
| FinanceJournal | `financial_periods` | TABLE read | `biz.financial_periods` | `["finance","period"]` |
| FinanceCapital | `v_capital_contributions` | VIEW | `api.v_capital_contributions` | `["finance","capital"]` |
| FinanceLoans | `v_loans` | VIEW | `api.v_loans` | `["finance","loans"]` |
| FinanceLoans | `create_loan` | RPC | `api.create_loan` | — |
| FinanceLoans | `record_loan_repayment` | RPC | `api.record_loan_repayment` | — |
| FinanceAssets | `v_assets` | VIEW | `api.v_assets` | `["finance","assets"]` |
| FinanceAssets | `create_asset` | RPC | `api.create_asset` | — |
| FinanceDepreciation | `v_assets` | VIEW | `api.v_assets` | `["finance","assets"]` |
| FinanceDepreciation | `asset_depreciation_schedules` | TABLE read | `biz.asset_depreciation_schedules` | `["finance","depreciation"]` |
| FinanceTreasury | `v_treasury_reconciliations` | VIEW | `api.v_treasury_reconciliations` | `["finance","treasury"]` |
| FinanceTreasury | `v_momo_daily_closings` | VIEW | `api.v_momo_daily_closings` | `["finance","momo"]` |
| FinanceTreasury | `treasury_reconciliations` | TABLE insert | `biz.treasury_reconciliations` | — |
| FinanceClosings | `financial_periods` | TABLE read | `biz.financial_periods` | `["finance","periods"]` |
| FinanceClosings | `v_finance_periods_summary` | VIEW | `api.v_finance_periods_summary` | `["finance","periods-summary"]` |
| FinanceClosings | `close_financial_period` | RPC | `api.close_financial_period` | — |
| FinanceReserves | `v_reserves` | VIEW | `api.v_reserves` | `["finance","reserves"]` |
| FinanceReserves | `allocation_rules` | TABLE read | `biz.allocation_rules` | `["finance","rules"]` |
| FinanceSettings | `v_reserves` | VIEW | `api.v_reserves` | `["finance","reserves"]` |
| FinanceSettings | `allocation_rules` | TABLE read | `biz.allocation_rules` | `["finance","rules"]` |

### 3.2 ⚠️ Architecture Ancienne (public.*) — ANOMALIES CRITIQUES

Ces composants utilisent directement `supabase.from("nom")` **sans pattern `as never`** et **sans TanStack Query** (useEffect + useState).

| Composant | Endpoint Supabase | Type | Arch cible (inféré) | Statut Prod |
|-----------|------------------|------|---------------------|-------------|
| FinanceInvoices | `invoices` | TABLE read | `public.invoices` | 📋 TABLE existe en prod |
| FinanceEncaissements | `v_invoices` | VIEW read | `public.v_invoices` | ❌ Vue absente en prod |
| FinanceDepenses | `v_depenses` | VIEW read | `public.v_depenses` | 📋 Vue existe en prod |

**Colonnes utilisées par FinanceInvoices :** `id, invoice_number, status, total, amount_paid, issued_at, due_date, client:client_id(full_name, company_name, is_company)`  
→ Noms old arch (`total`, `amount_paid` vs `total_xaf`, `paid_xaf` new arch) — **incompatible avec new arch**

---

## 4. Anomalies Critiques Détectées

### Anomalie A — QueryKey Incohérence (3 composants)

**Problème :** `FinanceDashboard` utilise la clé `["finance","dashboard"]` pour `getKpis()`, mais `FinanceMargins`, `FinanceCommissions`, `FinanceProfitability` et `FinanceReports` utilisent `["finance","dashboard-kpi"]` pour le même appel.

**Impact :** Double fetch réseau pour les mêmes données. Incohérence de cache : deux composants peuvent afficher des chiffres différents si l'un se met à jour et l'autre pas.

**Fichiers impactés :**
- `pages/finance/FinanceDashboard.tsx` — queryKey `["finance","dashboard"]`
- `pages/finance/FinanceMargins.tsx` — queryKey `["finance","dashboard-kpi"]`
- `pages/finance/FinanceCommissions.tsx` — queryKey `["finance","dashboard-kpi"]`
- `pages/finance/FinanceProfitability.tsx` — queryKey `["finance","dashboard-kpi"]`
- `pages/finance/FinanceReports.tsx` — queryKey `["finance","dashboard-kpi"]`

**Correction recommandée :** Unifier sur `["finance","dashboard-kpi"]` dans tous les composants.

### Anomalie B — FinanceInvoices (Architecture Mixte)

**Problème :** `FinanceInvoices.tsx` utilise directement `public.invoices` avec colonnes `total`/`amount_paid` (old arch). Pattern useEffect/useState au lieu de TanStack Query.

**Impact :** 
- Fonctionne en production actuelle (PostgREST sert public.*).
- Incompatible avec la migration vers `api.*` schemas=["api"].
- Incohérence de style avec les 14 autres composants Finance.

### Anomalie C — FinanceEncaissements (Vue Manquante) ❌ BLOQUANT

**Problème :** `FinanceEncaissements.tsx` utilise `public.v_invoices`. Cette vue **n'existe pas** en production (vérification distante READ-ONLY : absent).

**Impact :** Page `/finance/encaissements` retourne une erreur 400 en production actuelle. **Bloquant**.

**Correction requise :** Créer `public.v_invoices` ou réécrire vers `api.v_capital_contributions` / nouvelle vue `api.v_encaissements`.

### Anomalie D — Export Non Implémenté (FinanceReports)

**Problème :** Bouton Export dans `FinanceReports.tsx` appelle `onClick={() => alert("Export disponible après déploiement de la fonction Edge report-generator")}`.

**Impact :** Fonctionnalité non disponible. Edge Function `report-generator` non déployée.

---

## 5. Patterns TanStack Query

### 5.1 Pattern Standard (14 composants sur 17)
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["finance", "..."],
  queryFn: () => serviceFile.method()
});
// + useMutation pour les mutations
```

### 5.2 Pattern Dégradé (3 composants — Anomalies)
```typescript
useEffect(() => {
  supabase.from("table_name").select("...").then(({ data, error }) => {
    setData(data);
  });
}, []);
```

---

## 6. Mutations (RPCs) Inventoriées

| RPC | Composant | Paramètres principaux | Permission requise |
|-----|-----------|----------------------|-------------------|
| `create_journal_entry` | FinanceJournal | `p_description, p_entry_date, p_period_id, p_lines` | `biz.finance.journal.write` |
| `create_loan` | FinanceLoans | `p_lender, p_loan_type, p_principal_xaf, ...` | `biz.finance.capital.write` |
| `record_loan_repayment` | FinanceLoans | `p_loan_id, p_total_xaf, p_principal_xaf, ...` | `biz.finance.capital.write` |
| `create_asset` | FinanceAssets | `p_name, p_asset_category, p_acquisition_cost_xaf, ...` | `biz.finance.assets.write` |
| `compute_depreciation` | FinanceDepreciation | `p_period_id, p_idempotency_key_prefix` | `biz.finance.assets.write` |
| `close_financial_period` | FinanceClosings | `p_period_id` | `biz.finance.closing.write` |
| `allocate_margin` | FinanceReserves | `p_source_type, p_source_id, p_margin_xaf, ...` | `biz.finance.reserves.write` |

---

## 7. Synthèse

| Critère | Résultat |
|---------|---------|
| Total routes Finance | 17 |
| Composants Architecture Nouvelle (api.*) | 14 / 17 (82%) |
| Composants Architecture Ancienne (public.*) | 3 / 17 (18%) |
| Endpoints API vérifiés en prod | 0 (schémas non appliqués) |
| Endpoints fonctionnels en prod actuelle | 2 (public.invoices, public.v_depenses) |
| Endpoints bloqués en prod actuelle | 1 (public.v_invoices absent) |
| Anomalies QueryKey | 1 (double cache key) |
| Export Edge Function manquante | 1 (report-generator) |

**Statut global : NON EXÉCUTÉ — Architecture statiquement cohérente pour 14/17 pages ; 3 anomalies à corriger avant staging.**
