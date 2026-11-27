# FINANCE_PAGE_INVENTORY
_Généré le 2026-11-27_

## Routes & fichiers

| Route | Composant | Fichier page | Statut |
|---|---|---|---|
| `/finance` | `FinanceDashboard` | `pages/finance/FinanceDashboard.tsx` | ✅ FONCTIONNEL |
| `/finance/marges` | `FinanceMargins` | `pages/finance/FinanceMargins.tsx` | ⚠️ PARTIEL |
| `/finance/commissions` | `FinanceCommissions` | `pages/finance/FinanceCommissions.tsx` | ⚠️ PARTIEL |
| `/finance/rentabilite` | `FinanceProfitability` | `pages/finance/FinanceProfitability.tsx` | ✅ FONCTIONNEL |
| `/finance/rapports-financiers` | `FinanceReports` | `pages/finance/FinanceReports.tsx` | ⚠️ PARTIEL |
| `/finance/tresorerie` | `FinanceTreasury` | `pages/finance/FinanceTreasury.tsx` | ⚠️ PARTIEL |
| `/finance/depenses` | `FinanceDepenses` | `pages/finance/FinanceDepenses.tsx` | ✅ FONCTIONNEL |
| `/finance/encaissements` | `FinanceEncaissements` | `pages/finance/FinanceEncaissements.tsx` | ✅ FONCTIONNEL |
| `/finance/factures` | `FinanceInvoices` | `pages/finance/FinanceInvoices.tsx` | ✅ FONCTIONNEL |
| `/finance/journal` | `FinanceJournal` | `pages/finance/FinanceJournal.tsx` | ⚠️ PARTIEL |
| `/finance/cloture` | `FinanceClosings` | `pages/finance/FinanceClosings.tsx` | ⚠️ PARTIEL |
| `/finance/capital` | `FinanceCapital` | `pages/finance/FinanceCapital.tsx` | 🔴 STUB |
| `/finance/reserves` | `FinanceReserves` | `pages/finance/FinanceReserves.tsx` | 🔴 STUB |
| `/finance/immobilisations` | `FinanceAssets` | `pages/finance/FinanceAssets.tsx` | 🔴 STUB |
| `/finance/amortissements` | `FinanceDepreciation` | `pages/finance/FinanceDepreciation.tsx` | 🔴 STUB |
| `/finance/emprunts` | `FinanceLoans` | `pages/finance/FinanceLoans.tsx` | 🔴 STUB |
| `/finance/parametres-finance` | `FinanceSettings` | `pages/finance/FinanceSettings.tsx` | ⚠️ PARTIEL |

## Services Finance

| Service | Fichier | Vues/tables utilisées |
|---|---|---|
| `dashboardService` | `services/finance/dashboardService.ts` | `v_dashboard_finance`, `v_finance_periods_summary` |
| `capitalService` | `services/finance/capitalService.ts` | `v_loans` (stub), `v_capital_contributions` (stub) |
| `journalService` | `services/finance/journalService.ts` | `v_journal_entries`, `journal_entries` |
| `assetService` | `services/finance/assetService.ts` | `v_assets` (stub), `asset_depreciation_schedules` |
| `treasuryService` | `services/finance/treasuryService.ts` | `v_treasury_reconciliations`, `v_momo_daily_closings` |
| `reserveService` | `services/finance/reserveService.ts` | `v_reserves` (stub), `allocation_rules` |
| `periodService` | `services/finance/periodService.ts` | `financial_periods` |

## Objets DB (remote, schéma public)

### Vues existantes
| Vue | Type | Données réelles |
|---|---|---|
| `v_dashboard_finance` | Vue | ✅ Oui (migration 051) |
| `v_finance_periods_summary` | Vue | ✅ Oui (migration 051) |
| `v_depenses` | Vue | ✅ Oui (sur `expenses`) |
| `v_journal_entries` | Vue | ⚠️ Partiel (financial_period_id NULL — fix migration 053) |
| `v_assets` | Vue stub | 🔴 WHERE false (table `assets` manquante) |
| `v_capital_contributions` | Vue stub | 🔴 WHERE false (table `capital_contributions` manquante) |
| `v_loans` | Vue stub | 🔴 WHERE false (table `loans` manquante) |
| `v_momo_daily_closings` | Vue stub | 🔴 WHERE false → fix migration 053 |
| `v_reserves` | Vue stub | 🔴 WHERE false (table `reserves` manquante) |
| `v_treasury_reconciliations` | Vue stub | 🔴 WHERE false → fix migration 053 |

### Tables réelles pertinentes
`financial_periods`, `journal_entries`, `journal_lines`, `expenses`, `invoices`, `treasury_reconciliations`, `mobile_money_transactions`, `mobile_money_accounts`, `allocation_rules`, `asset_depreciation_schedules`

### Tables manquantes (bloquent 5 pages)
`assets`, `loans`, `capital_contributions`, `reserves`
