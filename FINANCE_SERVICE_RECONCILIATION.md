# FINANCE_SERVICE_RECONCILIATION
_Réconciliation services Finance — Généré le 2026-11-27_

## Périmètre

L'inventaire initial annonçait « 9 services Finance ». Ce rapport établit la réalité : **7 modules services + 2 fichiers de support = 9 fichiers** dans `apps/manager/src/services/finance/`.

---

## Inventaire réel des fichiers

| Fichier | Rôle | Type |
|---------|------|------|
| `periodService.ts` | CRUD périodes financières | Service |
| `dashboardService.ts` | KPIs et agrégats dashboard | Service |
| `reserveService.ts` | Réserves + allocation rules | Service |
| `capitalService.ts` | Contributions capital + emprunts | Service |
| `assetService.ts` | Immobilisations + amortissements | Service |
| `journalService.ts` | Écritures comptables | Service |
| `treasuryService.ts` | Rapprochements trésorerie + MoMo | Service |
| `types.ts` | Schémas Zod (toutes entités Finance) | Types |
| `index.ts` | Re-export des 7 services | Barrel |

**Total** : 9 fichiers = **7 services** + 1 types + 1 index.

L'inventaire précédent comptait `types.ts` et `index.ts` comme services — c'est le seul écart.

---

## Dépendances DB par service

### periodService.ts
- **Lit** : `financial_periods` (table directe)
- **Écrit** : `financial_periods` (UPDATE status pour clôture)
- **RPCs** : aucun
- **Statut DB** : ✅ Table existe, RLS activé

### dashboardService.ts
- **Lit** : `v_dashboard_finance`, `v_finance_periods_summary`
- **RPCs** : aucun
- **Statut DB** : ✅ Vues existent (non stubées)

### reserveService.ts
- **Lit** : `v_reserves`, `allocation_rules`
- **RPCs** : aucun
- **Statut DB** : 🔴 `v_reserves` = stub (WHERE false, 0 lignes) — `allocation_rules` ✅

### capitalService.ts
- **Lit** : `v_loans`, `v_capital_contributions`
- **RPCs** : `create_loan`, `record_loan_repayment`
- **Statut DB** : 🔴 `v_loans` = stub — `v_capital_contributions` = stub — RPCs **ABSENTS**

### assetService.ts
- **Lit** : `v_assets`, `asset_depreciation_schedules`
- **RPCs** : `create_asset`, `compute_depreciation`
- **Statut DB** : 🔴 `v_assets` = stub — `asset_depreciation_schedules` ✅ — RPCs **ABSENTS**

### journalService.ts
- **Lit** : `v_journal_entries`
- **Écrit** : `journal_entries` (UPDATE status)
- **RPCs** : `create_journal_entry`
- **Statut DB** : ⚠️ `v_journal_entries` existante mais `financial_period_id` NULL (fixé par migration 053) — RPC **ABSENT**

### treasuryService.ts
- **Lit** : `v_treasury_reconciliations`, `v_momo_daily_closings`
- **Écrit** : INSERT dans `treasury_reconciliations`
- **RPCs** : aucun
- **Statut DB** : ⚠️ Les deux vues sont stubées (fixées par migration 053)

---

## RPCs fantômes — analyse d'impact

Ces 5 fonctions sont appelées dans les services mais **n'existent pas** en base de données :

| RPC | Service | Action UI | Erreur attendue | Pages impactées |
|-----|---------|-----------|-----------------|-----------------|
| `create_journal_entry` | journalService.ts | Submit formulaire nouvelle écriture | `PGRST202` / 404 | Journal |
| `create_loan` | capitalService.ts | Submit formulaire nouvel emprunt | `PGRST202` / 404 | Emprunts |
| `record_loan_repayment` | capitalService.ts | Bouton remboursement | `PGRST202` / 404 | Emprunts |
| `create_asset` | assetService.ts | Submit formulaire nouvelle immobilisation | `PGRST202` / 404 | Immobilisations |
| `compute_depreciation` | assetService.ts | Bouton calcul amortissement | `PGRST202` / 404 | Immobilisations, Amortissements |

**Comportement actuel** : Les pages s'affichent sans erreur (état vide correct). L'erreur survient uniquement lors de la soumission d'un formulaire de création — les services attrapent l'erreur et la remontent via React Query (`isError`), ce qui affiche un message d'erreur dans l'UI sans crash.

**Ce n'est pas un bug d'affichage mais un manque de migration côté DB.**

---

## Schémas Zod (types.ts) — conformité avec DB actuelle

| Type Zod | Table/vue DB | Conformité |
|----------|-------------|-----------|
| `FinancialPeriod` | `financial_periods` | ✅ |
| `JournalEntry` | `v_journal_entries` | ✅ (`financial_period_id` nullable OK) |
| `JournalLine` | `journal_lines` | ✅ |
| `Expense` | `v_depenses` | ✅ |
| `Invoice` | `invoices` | ✅ |
| `TreasuryReconciliation` | `v_treasury_reconciliations` | ✅ |
| `MoMoDailyClosing` | `v_momo_daily_closings` | ✅ |
| `Loan` | `v_loans` (stub) | ⚠️ Schéma prévu, DB manquante |
| `CapitalContribution` | `v_capital_contributions` (stub) | ⚠️ |
| `Asset` | `v_assets` (stub) | ⚠️ |
| `DepreciationSchedule` | `asset_depreciation_schedules` | ⚠️ Fuite RLS (voir SECURITY_AUDIT) |
| `Reserve` | `v_reserves` (stub) | ⚠️ |

---

## Résumé

| Catégorie | Compte |
|-----------|--------|
| Services réels | 7 |
| Fichiers de support (types + index) | 2 |
| Services entièrement fonctionnels (lecture + écriture) | 2 (periodService, dashboardService) |
| Services partiellement fonctionnels (lecture OK, mutation bloquée) | 2 (journalService, treasuryService — débloqués par 053) |
| Services en attente de migration 054 | 3 (reserveService, capitalService, assetService) |
| RPCs référencés mais absents en DB | 5 |
