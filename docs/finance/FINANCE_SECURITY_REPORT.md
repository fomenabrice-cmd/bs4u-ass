# FINANCE_SECURITY_REPORT — BS4U BUSINESS MANAGER

## Périmètre

Audit des contrôles de sécurité du module Finance (migrations `20261126000100` à `20261126001100`).

## 1. Row Level Security (RLS)

### Statut : ✅ ACTIF sur toutes les tables Finance

| Table | Politique SELECT | Politique INSERT |
|-------|-----------------|-----------------|
| `biz.financial_periods` | `app.has_permission('biz.finance.journal.read')` | `biz.finance.closing.write` |
| `biz.journal_entries` | `app.has_permission('biz.finance.journal.read')` | `biz.finance.journal.write` |
| `biz.journal_lines` | Via `journal_entries` | Via `journal_entries` |
| `biz.reserves` | `biz.finance.reserves.read` | `biz.finance.reserves.write` |
| `biz.reserve_movements` | `biz.finance.reserves.read` | `biz.finance.reserves.write` |
| `biz.loans` | `biz.finance.capital.read` | `biz.finance.capital.write` |
| `biz.assets` | `biz.finance.assets.read` | `biz.finance.assets.write` |
| `biz.treasury_reconciliations` | `biz.finance.treasury.read` | `biz.finance.treasury.write` |

### Vues API

Toutes les vues `api.v_*` héritent de la RLS des tables sous-jacentes via `SECURITY INVOKER` implicite. Les RPCs utilisent `SECURITY DEFINER` mais appellent `app.require_permission()` en première instruction.

## 2. Intégrité des données

| Contrainte | Mécanisme | Tables concernées |
|------------|-----------|-------------------|
| Append-only | Trigger `app.forbid_update_delete()` | journal_lines, reserve_movements, loan_repayments, capital_contributions, depreciation_entries |
| Équilibre comptable | Trigger `biz.check_journal_balance()` | journal_entries (au passage posted) |
| Idempotence | `UNIQUE(idempotency_key)` | Toutes les tables append-only + RPCs |
| Mutation écriture postée | Trigger `biz.prevent_posted_entry_mutation()` | journal_entries |
| Montants entiers | `bigint CHECK (> 0)` | Toutes les colonnes `_xaf` |
| Débit XOR crédit | `CHECK (debit_xaf = 0 OR credit_xaf = 0)` | journal_lines |

## 3. Idempotence des RPCs

Toutes les RPCs Finance utilisent le pattern :
```sql
PERFORM app.idempotency_begin(idempotency_key, 'function_name');
-- ... logique ...
PERFORM app.idempotency_finish(idempotency_key);
```

Ce pattern garantit qu'un appel réseau dupliqué ne crée pas de double écriture.

## 4. Risques résiduels

| Risque | Niveau | Mitigation |
|--------|--------|-----------|
| Accès direct aux tables `biz.*` via service role | MOYEN | PostgREST exposé via `api.*` uniquement ; service role réservé aux migrations |
| Injection SQL dans les RPCs | FAIBLE | Paramètres typés PostgreSQL, pas de SQL dynamique |
| Fuite de données inter-organisations | FAIBLE | RLS active + `app.has_permission()` vérifie l'organisation |
| Double clôture de période | FAIBLE | Statut `closing` atomique + contrainte `UNIQUE` sur period |

## 5. Audit trail

Toutes les RPCs appellent `app.audit()` après chaque opération, enregistrant :
- `auth.uid()` (utilisateur)
- Timestamp
- Table et action
- Données avant/après (pour les mises à jour)

## Recommandations post-déploiement

1. Activer les alertes Supabase sur les tentatives d'accès refusées par RLS
2. Vérifier périodiquement les `DEFAULT PRIVILEGES` après ajout de nouveaux rôles (voir migration 033)
3. Tester les RPCs avec un JWT de rôle limité avant mise en production
