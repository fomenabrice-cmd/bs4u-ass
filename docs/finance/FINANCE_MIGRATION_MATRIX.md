# Matrice de Migration — Finance

> Date : 2026-11-26  
> Source : Analyse READ-ONLY de la base distante `mvebwahpforfxqohjusp` + migrations locales  
> **Lecture seule. Aucune modification effectuée.**

---

## Légende

| Symbole | Signification |
|---------|---------------|
| ✅ PROD | Existe en production, opérationnel |
| ⚠️ CONFLIT | Existe en production ET en new arch, avec incompatibilités |
| 🆕 NOUVEAU | N'existe qu'en new arch (local seulement) |
| ❌ ABSENT | N'existe pas en production |
| 🔄 ACTION | Action requise lors de la migration |

---

## Table 1 — Migrations : Remote vs Local

| Migration | Remote (prod) | Local | Contenu |
|-----------|--------------|-------|---------|
| `20261121000000` | ❌ | ✅ | Création des schémas (biz, api, app, ops, momo…) |
| `20261121000100` | ❌ | ✅ | Tables app.* (rôles, permissions, RBAC) |
| `20261121000200` | ❌ | ✅ | ops.number_series + app.next_number |
| `20261121000300` | ❌ | ✅ | app.forbid_update_delete, app.audit |
| `20261121000400` | ❌ | ✅ | Tables biz.* de base |
| `20261121001100` | ❌ | ✅ | biz.quotes, biz.invoices, biz.payments |
| `20261121001500` | ❌ | ✅ | momo.accounts, momo.transactions |
| `20261121001600` | ❌ | ✅ | biz.expenses (new arch) |
| `20261122*` (série) | ✅ | ✅ | Architecture ancienne complète (public.*) |
| `20261125000100` | ❌ | ✅ | Ajout org_id sur momo.accounts (new arch) |
| `20261125000200..000800` | ❌ | ✅ | Autres ajouts new arch |
| `20261125115615+` | ✅ | ❌ | Patches architecture ancienne (en prod) |
| `20261126000100` | ❌ | ✅ | biz.financial_periods, biz.chart_of_accounts |
| `20261126000200` | ❌ | ✅ | biz.journal_entries, biz.journal_lines |
| `20261126000300` | ❌ | ✅ | Seed chart_of_accounts (~80 comptes SYSCOHADA) |
| `20261126000400` | ❌ | ✅ | biz.reserve_movements, biz.capital_contributions |
| `20261126000500` | ❌ | ✅ | biz.loans, biz.loan_repayments |
| `20261126000600` | ❌ | ✅ | biz.assets, biz.asset_depreciation_schedules |
| `20261126000700` | ❌ | ✅ | biz.bank_accounts, biz.bank_transactions |
| `20261126000800` | ❌ | ✅ | Vue biz.v_momo_daily_closings |
| `20261126000900` | ❌ | ✅ | RPCs: compute_depreciation, get_dashboard_kpi |
| `20261126001000` | ❌ | ✅ | Vue api.v_dashboard_kpi |
| `20261126001100` | ❌ | ✅ | Policies RLS Finance |
| `20261126001200` | ❌ | ✅ | RPCs: create_loan, create_asset, create_journal_entry |

---

## Table 2 — Schémas

| Schéma | Remote | Local | Action |
|--------|--------|-------|--------|
| `public` | ✅ PROD | ✅ | Conserver intact |
| `auth` | ✅ PROD | — | Géré par Supabase, ne pas toucher |
| `biz` | ❌ | ✅ | 🔄 Créer via `20261121000000` |
| `api` | ❌ | ✅ | 🔄 Créer via `20261121000000` |
| `app` | ❌ | ✅ | 🔄 Créer via `20261121000000` |
| `ops` | ❌ | ✅ | 🔄 Créer via `20261121000000` |
| `momo` | ❌ | ✅ | 🔄 Créer via `20261121000000` |
| `audit` | ❌ | ✅ | 🔄 Créer via `20261121000000` |

---

## Table 3 — Tables Finance (table par table)

### Tables biz.* Finance — toutes nouvelles

| Table | Existe en prod | Équivalent prod | Type conflit | Action |
|-------|---------------|-----------------|--------------|--------|
| `biz.financial_periods` | ❌ | Aucun | — | 🆕 Créer |
| `biz.journal_entries` | ❌ | `public.journal_entries` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer (ne pas migrer les données old) |
| `biz.journal_lines` | ❌ | `public.journal_lines` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer (ne pas migrer les données old) |
| `biz.chart_of_accounts` | ❌ | `public.chart_of_accounts` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer + Seeder SYSCOHADA |
| `biz.reserve_movements` | ❌ | Aucun | — | 🆕 Créer |
| `biz.capital_contributions` | ❌ | Aucun | — | 🆕 Créer |
| `biz.loans` | ❌ | Aucun | — | 🆕 Créer |
| `biz.loan_repayments` | ❌ | Aucun | — | 🆕 Créer |
| `biz.assets` | ❌ | Aucun | — | 🆕 Créer |
| `biz.asset_depreciation_schedules` | ❌ | Aucun | — | 🆕 Créer |
| `biz.depreciation_entries` | ❌ | Aucun | — | 🆕 Créer |
| `biz.bank_accounts` | ❌ | `public.secondary_accounts` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer (ne pas migrer) |
| `biz.bank_transactions` | ❌ | `public.payments_received` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer (ne pas migrer) |
| `biz.expenses` | ❌ | `public.expenses` | ⚠️ CONFLIT TYPE | 🆕 Créer (types différents) |
| `biz.quotes` | ❌ | Aucun | — | 🆕 Créer |
| `biz.invoices` | ❌ | Aucun | — | 🆕 Créer |
| `biz.payments` | ❌ | `public.payments_received` | ⚠️ CONFLIT LOGIQUE | 🆕 Créer (ne pas migrer) |

### Tables momo.* — nouvelles

| Table | Existe en prod | Équivalent prod | Conflit | Action |
|-------|---------------|-----------------|---------|--------|
| `momo.accounts` | ❌ | `public.mobile_money_accounts` | ⚠️ CONFLIT STRUCTURE | 🆕 Créer (ne pas migrer) |
| `momo.transactions` | ❌ | `public.mobile_money_transactions` | ⚠️ CONFLIT STRUCTURE | 🆕 Créer (ne pas migrer) |

### Tables app.* / ops.* — infrastructure RBAC

| Table | Existe en prod | Action |
|-------|---------------|--------|
| `app.roles` | ❌ | 🆕 Créer + Seeder les rôles Finance |
| `app.permissions` | ❌ | 🆕 Créer + Seeder les permissions Finance |
| `app.role_permissions` | ❌ | 🆕 Créer + Lier rôles↔permissions |
| `app.user_roles` | ❌ | 🆕 Créer + Assigner les utilisateurs existants |
| `ops.number_series` | ❌ | 🆕 Créer + Seeder (JNL, EMR, IMM, LOAN, ASSET, MM) |

---

## Table 4 — Incompatibilités de Types

| Colonne (ancien) | Type ancien | Colonne (new) | Type new | Impact |
|-----------------|-------------|---------------|----------|--------|
| `public.journal_lines.debit` | `NUMERIC` | `biz.journal_lines.debit_xaf` | `BIGINT` | Conversion nécessaire si migration de données |
| `public.journal_lines.credit` | `NUMERIC` | `biz.journal_lines.credit_xaf` | `BIGINT` | Conversion nécessaire si migration de données |
| `public.journal_lines.account_id` | `UUID FK` | `biz.journal_lines.account_code` | `TEXT` | Modèle fondamentalement différent |
| `public.expenses.amount` | `NUMERIC` | `biz.expenses.amount_xaf` | `BIGINT` | Conversion si migration (XAF = entiers) |
| `public.mobile_money_accounts.balance` | `NUMERIC` | `momo.accounts.balance_xaf` | `BIGINT` | Modèles différents (pas de migration directe) |
| `public.chart_of_accounts.type` | `USER-DEFINED` | `biz.chart_of_accounts.account_class` | `TEXT` | Enum → texte (mapping nécessaire) |

---

## Table 5 — Fonctions et Vues

### Fonctions prod (public.*) — à conserver
| Fonction | Utilisée par | Action |
|----------|-------------|--------|
| `get_my_org_id()` | Toutes RLS old arch | ✅ Conserver |
| `handle_new_user()` | Trigger auth | ✅ Conserver |
| `update_momo_balance()` | Trigger MoMo | ✅ Conserver |
| `close_cash_session()` | Sessions caisse | ✅ Conserver |

### Fonctions new arch (app.*) — à créer
| Fonction | Usage | Action |
|----------|-------|--------|
| `app.next_number(text)` | Numérotation auto | 🆕 Créer (via `20261121000200`) |
| `app.forbid_update_delete()` | Append-only | 🆕 Créer (via `20261121000300`) |
| `app.require_permission(text)` | RBAC check | 🆕 Créer (via `20261121000100`) |
| `app.has_permission(text)` | RBAC prédicat | 🆕 Créer (via `20261121000100`) |
| `app.audit()` | Audit trail | 🆕 Créer (via `20261121000300`) |

### Vues api.* Finance — à créer
| Vue | Dépendance | Action |
|-----|-----------|--------|
| `api.v_financial_periods` | `biz.financial_periods` | 🆕 Créer |
| `api.v_journal_entries` | `biz.journal_entries` | 🆕 Créer |
| `api.v_assets` | `biz.assets` | 🆕 Créer |
| `api.v_loans` | `biz.loans` | 🆕 Créer |
| `api.v_capital_contributions` | `biz.capital_contributions` | 🆕 Créer (migration 001200) |
| `api.v_treasury_summary` | `biz.bank_accounts` | 🆕 Créer |

---

## Table 6 — PostgREST Config

| Phase | Config `schemas` | Impact |
|-------|-----------------|--------|
| Actuel (prod) | `["public"]` (implicite) | Sert public.* → frontend fonctionnel |
| Transition | `["api", "public"]` | Finance + anciens modules fonctionnent |
| Cible finale | `["api"]` | Tous les modules via api.* (vues de compat. nécessaires) |

> **Risque transition** : Passer de `["public"]` à `["api", "public"]` nécessite un redémarrage PostgREST (coupure ~30 secondes). Planifier en heure creuse.

---

## Résumé des Actions

| Catégorie | Nombre | Priorité |
|-----------|--------|---------|
| Migrations à appliquer (fondations) | 17 (`20261121*`) | P0 — Bloquant |
| Migrations à appliquer (Finance) | 12 (`20261126*`) | P0 — Après fondations |
| Seeds à exécuter | 4 (rôles, permissions, number_series, chart_of_accounts) | P0 — Avant premier usage |
| Config PostgREST à modifier | 1 | P1 — Coordonner avec frontend |
| Vues de compatibilité à créer | ~10 (api.v_* wrappant public.*) | P2 — Migration progressive |
| Données à migrer (old → new) | **0** | Données Finance toutes nouvelles |
