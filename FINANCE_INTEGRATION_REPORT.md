# FINANCE_INTEGRATION_REPORT
_Généré le 2026-11-27_

## Intégrations existantes

| Module source | Données utilisées | Page Finance cible |
|---|---|---|
| MoMo (`mobile_money_transactions`) | `commission_xaf` agrégé par jour | Commissions (via `v_momo_daily_closings` — fix 053) |
| MoMo (`mobile_money_accounts`) | `account_name`, `provider` | Commissions, Trésorerie |
| Dépenses (`expenses`) | Toutes dépenses validées | Dépenses (`v_depenses`) |
| Facturation (`invoices`) | Factures client | Encaissements, Factures |
| Caisse (`cash_movements`) | Solde caisse | Dashboard KPI (`kpi_cash_xaf`) |
| Périodes (`financial_periods`) | Période courante | Journal, Clôtures |
| Journal (`journal_entries`+`journal_lines`) | Écritures comptables | Journal |

## Intégrations manquantes (Phase 4 — non implémentée)

| Module | Données nécessaires | Page cible | Blocage |
|---|---|---|---|
| Stock (`inventory`, `stock_movements`) | Coût des marchandises vendues | Marges | Requiert vue `v_cogs_by_period` |
| Caisse (`cash_sessions`, `cash_closings`) | Flux journaliers caisse | Trésorerie | Requiert agrégation par période |
| MoMo (`momo_reconciliations`) | Rapprochements MoMo | Trésorerie | Table existe, vue non créée |

## Points d'attention règles métier

- `kpi_commissions_xaf` dans `v_dashboard_finance` : vérifier que seules les commissions (pas le volume) sont agrégées
- Les transferts internes MoMo (flotte) ne doivent pas apparaître dans les revenus
- `treasury_reconciliations` : pas de `reconciliation_date` natif → calculé depuis `created_at`
