# Rapport de Compatibilité Base de Données — Finance

> Date : 2026-11-26  
> Base distante : `mvebwahpforfxqohjusp` (READ-ONLY via MCP)  
> Méthode : Requêtes SQL en lecture seule uniquement  
> **Aucune modification de la base distante.**

---

## 1. État Vérifié de la Base Distante

### Résumé de la vérification
```
Migrations appliquées : 70
Tables dans public.*  : 65
Schémas présents      : auth, cron, extensions, graphql, public, realtime, storage, vault
Schémas ABSENTS       : biz, api, app, ops, momo, asso, disc, meet, audit, core
Vues présentes        : 2 (vues publiques existantes)
Fonctions présentes   : 70+
Policies RLS          : 60+
```

### Dernières migrations appliquées (extrait)
```
20261126073445  (dernière)
20261126070000
20261126060000
...
20261125115615
20261125...
20261122...  (série complète old arch)
```

---

## 2. Analyse des Clés Étrangères (FK)

### Contraintes FK en production — tables core
| Contrainte | Table | Référence | Statut |
|-----------|-------|-----------|--------|
| `profiles.organization_id` → `organizations.id` | Multi-tenancy | Intact | ✅ |
| `cash_movements.session_id` → `cash_sessions.id` | Caisse | Intact | ✅ |
| `cash_sessions.register_id` → `cash_registers.id` | Caisse | Intact | ✅ |
| `mobile_money_transactions.account_id` → `mobile_money_accounts.id` | MoMo | Intact | ✅ |
| `journal_lines.entry_id` → `journal_entries.id` | Compta old | Intact | ✅ |
| `journal_lines.account_id` → `chart_of_accounts.id` | Compta old | Intact | ✅ |

### Contraintes FK new arch (locales, non appliquées)
| Contrainte | Table | Référence | Risque création |
|-----------|-------|-----------|----------------|
| `biz.journal_entries.financial_period_id` → `biz.financial_periods.id` | Finance | Sera créée | Aucun (new table) |
| `biz.journal_lines.entry_id` → `biz.journal_entries.id` | Finance | Sera créée | Aucun |
| `biz.assets.financial_period_id` → `biz.financial_periods.id` | Finance | Sera créée | Aucun |
| `biz.loan_repayments.loan_id` → `biz.loans.id` | Finance | Sera créée | Aucun |
| `biz.depreciation_entries.journal_entry_id` → `biz.journal_entries.id` | Finance | Sera créée | Aucun |
| `momo.transactions.account_id` → `momo.accounts.id` | MoMo new | Sera créée | Aucun |

> **Conclusion FK** : Aucun conflit. Les nouvelles FK s'appliquent exclusivement sur de nouvelles tables. Aucune FK nouvelle ne pointe vers `public.*`.

---

## 3. Analyse des Triggers

### Triggers en production (public.*)

| Trigger | Table | Fonction | Comportement |
|---------|-------|----------|-------------|
| `handle_new_user` | `auth.users` | `handle_new_user()` | Crée profil automatiquement |
| `update_cash_session_amounts` | `cash_movements` | `update_cash_session_amounts()` | Met à jour totaux session |
| `prevent_cash_movement_update` | `cash_movements` | `prevent_update()` | Append-only |
| `prevent_cash_movement_delete` | `cash_movements` | `prevent_delete()` | Append-only |
| `update_momo_balance` | `mobile_money_transactions` | `update_momo_balance()` | Calcule balance MoMo |
| `update_journal_total` | `journal_lines` | `update_journal_total()` | Somme débit/crédit |
| `prevent_journal_update` | `journal_entries` | — | Protège écritures postées |

### Triggers new arch (locaux, non appliqués)

| Trigger | Table | Fonction | Statut |
|---------|-------|----------|--------|
| `biz_journal_entries_forbid` | `biz.journal_entries` | `app.forbid_update_delete()` | ❌ À créer |
| `biz_journal_lines_forbid` | `biz.journal_lines` | `app.forbid_update_delete()` | ❌ À créer |
| `biz_capital_contributions_forbid` | `biz.capital_contributions` | `app.forbid_update_delete()` | ❌ À créer |
| `biz_loan_repayments_forbid` | `biz.loan_repayments` | `app.forbid_update_delete()` | ❌ À créer |
| `momo_transactions_forbid` | `momo.transactions` | `app.forbid_update_delete()` | ❌ À créer |
| `chk_one_open_period` | `biz.financial_periods` | Function inline | ❌ À créer |
| `momo_balance_update` | `momo.transactions` | Trigger balance calculée | ❌ À créer |

> **Conclusion Triggers** : Aucun conflit. Les triggers old arch opèrent sur `public.*`, les triggers new arch sur `biz.*`/`momo.*`. Coexistence sans interférence possible.

---

## 4. Analyse des Policies RLS

### Modèle RLS old arch (public.*)
```sql
-- Pattern typique
CREATE POLICY "policy_name" ON public.table_name
  USING (organization_id = get_my_org_id());
```
- Isolation par `organization_id`
- Fonction `get_my_org_id()` retourne l'org de l'utilisateur courant
- **60+ policies** de ce type en production — toutes intactes, non touchées

### Modèle RLS new arch (biz.*, momo.*)
```sql
-- Pattern typique
CREATE POLICY "policy_name" ON biz.table_name
  USING (app.has_permission('biz.finance.journal.read'));
```
- Isolation par permission RBAC
- Fonction `app.has_permission()` : vérifie les rôles via `app.user_roles`
- **Dépendance** : `app.user_roles` doit être seedée avant d'activer les policies

### Risque de migration RLS

| Risque | Probabilité | Description |
|--------|------------|-------------|
| `app.has_permission()` manquante | Élevée | Bloque toutes les requêtes Finance si fondations pas appliquées |
| `app.user_roles` vide → accès refusé | Élevée | Aucun utilisateur n'aura accès à Finance sans seeding |
| Conflit de policy name | Faible | Tables différentes, aucun risque |
| RLS old arch brisée | Nulle | Aucune modification de public.* |

### Mitigation requise
```sql
-- À exécuter après application des fondations, avant activation Finance
INSERT INTO app.roles (name) VALUES ('finance_admin'), ('finance_reader'), ('finance_writer');
INSERT INTO app.permissions (name) VALUES 
  ('biz.finance.journal.read'), ('biz.finance.journal.write'),
  ('biz.finance.assets.read'), ('biz.finance.assets.write'),
  ('biz.finance.capital.read'), ('biz.finance.capital.write'),
  ('biz.finance.admin');
-- Puis assigner les utilisateurs via app.user_roles
```

---

## 5. Analyse des Types de Données

### Conflit NUMERIC vs BIGINT

| Contexte | Ancien type | Nouveau type | XAF entier ? | Risque de perte |
|---------|-------------|-------------|-------------|-----------------|
| Montants journal | `NUMERIC` | `BIGINT XAF` | ✅ Oui (XAF sans centimes) | Aucune perte si migration avec `::bigint` |
| Montants dépenses | `NUMERIC` | `BIGINT XAF` | ✅ Oui | Aucune perte |
| Balance MoMo | `NUMERIC` | `BIGINT XAF` | ✅ Oui | Aucune perte |
| Taux d'emprunt | — | `NUMERIC(5,2)` | N/A (%) | N/A |

> **Le franc CFA (XAF) n'a pas de subdivision décimale.** La conversion `numeric → bigint` est sans perte pour des montants XAF. Validation recommandée : `WHERE amount % 1 != 0` sur les tables old arch avant migration de données.

### Conflit account_id (UUID) vs account_code (TEXT)

```
Ancien : public.journal_lines.account_id UUID → public.chart_of_accounts.id UUID
Nouveau : biz.journal_lines.account_code TEXT  → code SYSCOHADA (ex: '601', '411')
```

**Impact** : Ces deux systèmes sont **fondamentalement incompatibles**. Il n'est pas possible de migrer automatiquement les données old `journal_lines` vers `biz.journal_lines` sans une table de correspondance `account_id → account_code`.

**Décision recommandée** : Ne pas migrer les données historiques de `public.journal_entries` vers `biz.journal_entries`. Repartir de zéro dans le nouveau système comptable. Les données historiques restent accessibles via `public.*`.

---

## 6. Analyse PostgREST

### Configuration actuelle (remote)
```toml
# config inféré depuis le comportement observé
[api]
schemas = ["public"]
```

### Configuration cible (locale)
```toml
[api]
schemas = ["api"]
```

### Impact de la transition

| Étape | Config | Impact frontend |
|-------|--------|----------------|
| Avant migration | `["public"]` | Tout fonctionne via `public.*` |
| Pendant transition | `["api", "public"]` | Finance fonctionne via `api.*`, anciens modules via `public.*` |
| Après migration complète | `["api"]` | Anciens modules nécessitent des vues `api.*` de compatibilité |

### Vues de compatibilité requises pour `schemas = ["api"]` final
```sql
-- Exemples de vues de compat. à créer dans api.*
CREATE VIEW api.organizations AS SELECT * FROM public.organizations;
CREATE VIEW api.products AS SELECT * FROM public.products;
CREATE VIEW api.cash_sessions AS SELECT * FROM public.cash_sessions;
-- etc. pour chaque table public.* utilisée par le frontend
```

> **Ne pas passer à `schemas = ["api"]` seul** tant que toutes les vues de compatibilité ne sont pas créées et testées.

---

## 7. Analyse du Risque de Double-Comptage

### Paires à risque
| Système 1 (old) | Système 2 (new) | Risque |
|----------------|----------------|--------|
| `public.journal_entries` | `biz.journal_entries` | ⚠️ CRITIQUE si les deux sont utilisés pour les mêmes flux |
| `public.expenses` | `biz.expenses` | ⚠️ FORT si les deux enregistrent les mêmes dépenses |
| `public.mobile_money_transactions` | `momo.transactions` | ⚠️ FORT si les deux enregistrent les mêmes opérations MoMo |
| `public.payments_received` | `biz.payments` | ⚠️ FORT si les deux enregistrent les mêmes paiements |

### Mitigation obligatoire
- **Règle d'exclusivité** : Chaque flux de données doit être enregistré dans **un seul système**.
- Module Finance (Journal, Immobilisations, Emprunts, Capital) → `biz.*` exclusivement
- Caisse (`cash_sessions`, `cash_movements`) → `public.*` exclusivement (jusqu'à migration complète)
- MoMo → Décision architecture requise : `public.mobile_money_*` OU `momo.*`, pas les deux simultanément

---

## 8. Tests de Compatibilité Requis

| Test | Méthode | Critère de succès |
|------|---------|-------------------|
| T1 — Schémas créés sans erreur | `\dn` après migration 000000 | 10 nouveaux schémas présents |
| T2 — RBAC fonctionnel | `SELECT app.has_permission('biz.finance.journal.read')` | Retourne bool sans erreur |
| T3 — Numérotation auto | `SELECT app.next_number('JNL')` | Retourne `JNL-2026-000001` |
| T4 — Période ouverte | `INSERT INTO biz.financial_periods...` | Succès + deuxième INSERT bloqué |
| T5 — Écriture équilibrée | `SELECT api.create_journal_entry(...)` | UUID retourné, zéro erreur |
| T6 — Append-only | `UPDATE biz.journal_lines SET debit_xaf = 1` | EXCEPTION levée |
| T7 — Old arch intacte | `SELECT * FROM public.cash_sessions LIMIT 1` | Données présentes, RLS active |
| T8 — PostgREST coexistence | `GET /rest/v1/v_financial_periods` | 200 OK |

---

## 9. Verdict Technique

| Critère | Résultat |
|---------|---------|
| Conflit FK bloquant | ❌ Aucun |
| Conflit trigger bloquant | ❌ Aucun |
| Conflit RLS bloquant | ❌ Aucun (si seedé correctement) |
| Conflit de types irréparable | ❌ Aucun (XAF = entiers) |
| Conflit de nommage | ❌ Aucun (schémas distincts) |
| Risque double-comptage | ⚠️ Élevé si règle d'exclusivité non respectée |
| Risque accès bloqué Finance | ⚠️ Élevé si `app.user_roles` non seedé |
| Migration données old → new requise | Non (données Finance toutes nouvelles) |

**VERDICT : COMPATIBLE — avec précautions (seeding RBAC + règle d'exclusivité)**
