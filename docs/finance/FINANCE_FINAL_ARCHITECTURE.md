# FINANCE_FINAL_ARCHITECTURE — BS4U BUSINESS MANAGER

## Vue d'ensemble

Le module Finance est une couche comptable SYSCOHADA intégrée au monorepo `bs4u-ecosystem`. Il couvre la comptabilité générale, la gestion des réserves, des emprunts, des immobilisations et la clôture de période.

## Schémas de base de données

| Schéma | Usage |
|--------|-------|
| `biz.*` | Tables métier Finance (journal, réserves, actifs, emprunts, capital) |
| `momo.*` | Clôtures journalières et événements MoMo |
| `api.*` | Vues PostgREST exposées au frontend (préfixe `v_`) + RPCs |
| `ops.*` | Séries de numéros, clés d'idempotence |
| `audit.*` | Traces de modification |

## Tables principales créées

```
biz.financial_periods          — Périodes comptables (open/closing/closed)
biz.chart_of_accounts          — Plan comptable SYSCOHADA (60 comptes)
biz.journal_entries            — Écritures comptables avec statut draft/posted/reversed
biz.journal_lines              — Lignes de journal (append-only, debit_xaf/credit_xaf bigint)
biz.reserves                   — Réserves (sécurité, équipements, stock, développement)
biz.reserve_movements          — Mouvements de réserves (append-only)
biz.allocation_rules           — Règles d'allocation automatique par source
biz.capital_contributions      — Apports en capital (append-only)
biz.loans                      — Emprunts bancaires et fournisseurs
biz.loan_repayments            — Remboursements (append-only)
biz.assets                     — Immobilisations
biz.asset_depreciation_schedules — Plans d'amortissement linéaire
biz.depreciation_entries       — Dotations calculées par période (append-only)
biz.treasury_reconciliations   — Rapprochements de trésorerie
momo.daily_closings            — Clôtures journalières MoMo
momo.provider_events           — Événements opérateurs
momo.commission_rules          — Barèmes de commissions
```

## RPCs exposées

| Fonction | Description |
|----------|-------------|
| `api.allocate_margin(...)` | Alloue une marge vers les réserves selon les règles actives |
| `api.record_loan_repayment(...)` | Enregistre un remboursement et met à jour l'encours |
| `api.compute_depreciation(...)` | Calcule et insère les dotations de la période |
| `api.close_financial_period(...)` | Clôture une période après validation des 4 prérequis |
| `api.momo_calculate_commission(...)` | Calcule la commission MoMo selon le barème actif |

## Contraintes invariantes

- **Montants** : toujours `bigint` suffixé `_xaf`, jamais `float`/`numeric`
- **Append-only** : `journal_lines`, `reserve_movements`, `capital_contributions`, `loan_repayments`, `depreciation_entries` — protégés par `app.forbid_update_delete()`
- **Idempotence** : toutes les opérations financières ont une `idempotency_key text UNIQUE`
- **Équilibre** : trigger `biz.check_journal_balance()` valide débit = crédit au passage `draft → posted`
- **RLS** : toutes les tables ont des politiques `app.has_permission('biz.finance.*')`

## Stack frontend

- React 18 + Vite + React Router v7
- TanStack Query v5 (cache 60–120s, invalidation sur mutation)
- Service layer isolé dans `src/services/finance/`
- Framer Motion v11 pour les animations
- Zod v3 pour la validation des schémas

## Numérotation

| Série | Format | Usage |
|-------|--------|-------|
| JOURNAL | JNL-YYYY-NNNNNN | Numéros d'écriture |
| CAPITAL | CAP-YYYY-NNNNNN | Apports en capital |
| LOAN | EMR-YYYY-NNNNNN | Emprunts |
| REPAYMENT | RBR-YYYY-NNNNNN | Remboursements |
| ASSET | IMM-YYYY-NNNNNN | Immobilisations |
| DEPR | AMO-YYYY-NNNNNN | Dotations |
| RECON | RAP-YYYY-NNNNNN | Rapprochements |
