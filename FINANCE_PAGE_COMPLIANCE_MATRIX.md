# FINANCE_PAGE_COMPLIANCE_MATRIX
_Généré le 2026-11-27_

## Règles financières (spec)

| Règle | Statut implémentation |
|---|---|
| Volume MoMo ≠ revenu ; seules les commissions comptent | ✅ — `kpi_commissions_xaf` séparé de `kpi_revenue_sales_xaf` |
| Pas de double comptage commissions/renouvellement stock | ✅ — `v_dashboard_finance` agrège séparément |
| Transferts internes ne créent pas revenu/charge | ✅ — non inclus dans les KPIs |
| Réserves = allocation interne, pas une charge | ✅ — `v_reserves` séparé du P&L |
| Remboursement capital emprunt ≠ charge | ✅ — `outstanding_xaf` distinct des charges |
| Fonds fournisseurs ≠ capital | ✅ — pas dans `v_capital_contributions` |
| Montants en XAF bigint (pas de float) | ✅ — toutes colonnes `_xaf` en `bigint` |
| Écritures validées immuables | ✅ — `v_journal_entries` filtre sur `status = 'posted'` pour affichage |
| Opérations critiques idempotentes | ✅ — `create_journal_entry` RPC côté DB |

## Matrice page × exigence

| Page | Données réelles | TypeScript OK | Perm RBAC | Empty state | Note |
|---|---|---|---|---|---|
| Vue d'ensemble | ✅ | ✅ | ✅ (libre) | ✅ | Affiche 0 XAF si période vide |
| Marges | ⚠️ | ✅ | ✅ | ✅ | Calculé depuis KPIs ; pas de détail produit |
| Commissions | ⚠️ | ✅ | ✅ | ✅ | Dépend de `v_momo_daily_closings` (fix 053) |
| Rentabilité | ✅ | ✅ | ✅ | ✅ | Simulateur break-even fonctionnel |
| Rapports | ⚠️ | ✅ | ✅ | ✅ | Boutons affichent alert() — à implémenter |
| Trésorerie | ⚠️ | ✅ | ✅ | ✅ | Dépend des 2 vues (fix 053) |
| Dépenses | ✅ | ✅ | `biz.expenses.create` | ✅ | Fonctionnel |
| Encaissements | ✅ | ✅ | `biz.payments.record` | ✅ | Fonctionnel |
| Factures | ✅ | ✅ | `biz.invoices.read` | ✅ | Fonctionnel |
| Journal | ⚠️ | ✅ | ✅ | ✅ | Création OK ; filtre période après fix 053 |
| Clôtures | ⚠️ | ✅ | ✅ | ✅ | Fonctionne si période existe |
| Capital | 🔴 | ✅ | ✅ | ✅ | Stub — table `capital_contributions` manquante |
| Réserves | 🔴 | ✅ | ✅ | ✅ | Stub — table `reserves` manquante |
| Immobilisations | 🔴 | ✅ | ✅ | ✅ | Stub — table `assets` manquante |
| Amortissements | 🔴 | ✅ | ✅ | ✅ | Stub — dépend de `assets` |
| Emprunts | 🔴 | ✅ | ✅ | ✅ | Stub — table `loans` manquante |
| Paramètres | ⚠️ | ✅ | ✅ | ✅ | Affiche `allocation_rules` ; pas d'édition |

## Blocages nécessitant migration

Les 5 pages STUB nécessitent une migration pour créer les tables manquantes :
- `assets` + RPCs `create_asset`, `compute_depreciation`
- `loans` + RPCs `create_loan`, `record_loan_repayment`
- `capital_contributions`
- `reserves`

Migration 053 (`20261127000100_053_fix_finance_views.sql`) est prête — à appliquer manuellement.
