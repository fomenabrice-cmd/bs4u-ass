# Réconciliation Architecturale — Module Finance

> Date : 2026-11-26  
> Périmètre : Base Supabase `mvebwahpforfxqohjusp` (lecture seule) vs migrations locales  
> Méthode : Comparaison READ-ONLY via MCP Supabase + analyse des fichiers de migration locaux  
> **Aucune modification de la base distante n'a été effectuée.**

---

## 1. Résumé Exécutif

Deux architectures coexistent dans ce projet, développées en parallèle et **jamais réconciliées** :

| Aspect | Ancienne architecture (remote) | Nouvelle architecture (local) |
|--------|-------------------------------|-------------------------------|
| **Schéma** | `public.*` uniquement | `biz.*`, `api.*`, `app.*`, `ops.*`, `momo.*` |
| **Appliquée en prod** | ✅ Oui (70 migrations) | ❌ Non (0 migration) |
| **Isolation** | `organization_id` + RLS `get_my_org_id()` | RBAC `app.has_permission()` |
| **Monétaire** | `numeric` (majorité) | `bigint XAF` exclusif |
| **Compta** | `account_id UUID FK` | `account_code TEXT SYSCOHADA` |
| **PostgREST** | Sert `public.*` | Config locale `schemas=["api"]` |
| **Tables** | 65 tables prod actives | 37 tables Finance nouvelles (locales) |

**La production est entièrement sur l'ancienne architecture.** Le module Finance (12 migrations, `20261126*`) dépend intégralement de fondations (`20261121*`) absentes de la production.

---

## 2. État des Migrations

### Remote (production)
- **70 migrations appliquées** : `20261122*` → `20261126073445`
- Dernière migration : `20261126073445`
- Schémas présents : `auth`, `cron`, `extensions`, `graphql`, `public`, `realtime`, `storage`, `vault`
- **Absent** : `biz`, `api`, `app`, `ops`, `momo`, `asso`, `disc`, `meet`, `audit`, `core`

### Local (non appliqué)
Trois familles de migrations locales **absentes de la production** :

| Famille | Fichiers | Contenu | Statut |
|---------|----------|---------|--------|
| `20261121*` | 17 fichiers | Fondations : schémas, RBAC, `app.*`, `biz.*`, `momo.*` | ❌ Jamais appliqué |
| `20261125000*` | 8 fichiers | Ajouts new arch (org_id sur momo, etc.) | ❌ Jamais appliqué |
| `20261126*` | 12 fichiers | Module Finance complet | ❌ Jamais appliqué |

> Les migrations remote `20261125115615`+ sont une série différente des locales `20261125000*` : elles portent les numéros de timestamp de l'ancienne architecture, pas de la nouvelle.

---

## 3. Cartographie des Tables

### Tables production (public.*) — sans équivalent new arch
| Table | Rôle | Migration | Équivalent new arch |
|-------|------|-----------|---------------------|
| `public.organizations` | Multi-tenancy | 20261122* | — (remplacé par RBAC) |
| `public.profiles` | Utilisateurs | 20261122* | — |
| `public.products` | Catalogue | 20261122* | — |
| `public.inventory` | Stock | 20261122* | — |
| `public.cash_sessions` | Sessions caisse | 20261122* | — |
| `public.cash_movements` | Mouvements caisse | 20261122* | — |
| `public.cash_registers` | Registres caisse | 20261122* | — |
| `public.mobile_money_accounts` | Comptes MoMo | 20261122* | `momo.accounts` (différent) |
| `public.mobile_money_transactions` | Transactions MoMo | 20261122* | `momo.transactions` (différent) |
| `public.journal_entries` | Écriture compta | 20261122* | `biz.journal_entries` (incompatible) |
| `public.journal_lines` | Lignes compta | 20261122* | `biz.journal_lines` (incompatible) |
| `public.chart_of_accounts` | Plan comptable | 20261122* | `biz.chart_of_accounts` (différent) |
| `public.expenses` | Dépenses | 20261122* | `biz.expenses` (types différents) |
| `public.secondary_accounts` | Comptes bancaires | 20261122* | `biz.bank_accounts` (différent) |
| `public.payments_received` | Paiements reçus | 20261122* | `biz.payments` (différent) |

### Tables new arch (biz.*/momo.*) — uniquement locales
| Table | Rôle | Dépendance |
|-------|------|-----------|
| `biz.financial_periods` | Périodes comptables | `app.forbid_update_delete` |
| `biz.journal_entries` | En-têtes écritures | `biz.financial_periods`, `ops.number_series` |
| `biz.journal_lines` | Lignes écritures | `biz.journal_entries`, `biz.chart_of_accounts` |
| `biz.chart_of_accounts` | Plan SYSCOHADA | Seed ~80 comptes |
| `biz.capital_contributions` | Apports capital | Append-only |
| `biz.loans` / `biz.loan_repayments` | Emprunts | `app.next_number` |
| `biz.assets` / schedules | Immobilisations | `app.next_number`, `biz.financial_periods` |
| `biz.bank_accounts` / `biz.bank_transactions` | Trésorerie | — |
| `momo.accounts` | Comptes MoMo new | `app.touch_row`, balance computed |
| `momo.transactions` | Transactions MoMo new | Append-only, `app.next_number` |

---

## 4. Analyse des 3 Stratégies

### Option A — Conserver public.* (statu quo)
- Continuer l'ancienne architecture pour le module Finance
- Réécrire les migrations Finance pour opérer dans `public.*`
- **Avantages** : Aucune migration de fondation. Zéro risque.
- **Inconvénients** : Perd RBAC, bigint, SYSCOHADA, append-only, numérotation automatique. Perd ~6 semaines de travail Finance.
- **Verdict** : Rejet. Régression fonctionnelle majeure.

### Option B — Migration progressive vers biz.* ✅ RECOMMANDÉE
- Appliquer les fondations `20261121*` sur staging d'abord
- PostgREST sert temporairement `["api", "public"]` (coexistence)
- Module Finance en `biz.*` immédiatement opérationnel
- Ancienne architecture continue via `public.*` sans interruption
- Migration progressive des anciens modules vers `api.*` views
- **Avantages** : Finance fonctionne. Aucune perte de données. Réversible.
- **Inconvénients** : Transition PostgREST nécessite une coupure courte.

### Option C — Coexistence duale avec vues de compatibilité
- Créer des vues `api.v_*` wrappant `public.*` pour les anciens modules
- Garder `biz.*` pour les nouveaux modules exclusivement
- **Avantages** : Transparence totale pour le frontend.
- **Inconvénients** : Double maintenance. Risque de double-comptage si les deux systèmes journal coexistent. Complexité accrue.
- **Verdict** : Acceptable comme étape intermédiaire dans Option B, pas comme stratégie finale.

---

## 5. Recommandation : Option B (Migration Progressive)

### Principe
`public.*` et `biz.*` opèrent dans des **schémas distincts** : il n'y a pas de conflit de nommage. Les deux peuvent coexister. L'objectif est d'activer `biz.*` sans toucher aux tables `public.*` existantes.

### Séquence
```
Phase 0 (Préparation)   : Backup complet + tests de non-régression sur staging
Phase 1 (Fondations)    : Appliquer 20261121* sur staging → créer les schémas
Phase 2 (Finance)       : Appliquer 20261126* → module Finance opérationnel
Phase 3 (PostgREST)     : Transition schemas=["api","public"] → puis ["api"]
Phase 4 (Vues compat.)  : Créer api.v_* wrappant public.* pour les anciens modules
Phase 5 (Validation)    : Tests staging 2 semaines min.
Phase 6 (Production)    : Appliquer avec backup + fenêtre de maintenance courte
```

### Ce qui ne change PAS
- `public.cash_sessions`, `public.cash_movements`, `public.cash_registers` : intacts
- `public.mobile_money_accounts`, `public.mobile_money_transactions` : intacts
- `public.organizations`, `public.profiles`, `public.products` : intacts
- Toutes les RLS policies existantes : intactes

### Ce qui s'ajoute
- 10 nouveaux schémas (biz, api, app, ops, momo, asso, disc, meet, audit, core)
- ~37 nouvelles tables Finance
- ~25 nouvelles fonctions RPC
- Module RBAC (`app.permissions`, `app.role_permissions`, `app.user_roles`)
- Module numérotation (`ops.number_series`, `app.next_number`)

---

## 6. Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| Double-comptage journal (public + biz) | Élevée | Critique | Ne JAMAIS utiliser les deux systèmes pour les mêmes données |
| PostgREST config transition → 404 existants | Élevée | Fort | Maintenir `public` dans schemas pendant la transition |
| `app.has_permission()` non configuré → accès refusé | Élevée | Fort | Seeder les rôles avant d'activer les RPCs Finance |
| `ops.number_series` vide → numéros NULL | Élevée | Fort | Seeder la table avec toutes les séries (JNL, EMR, IMM, LOAN, ASSET) |
| Conversion numeric → bigint (perte centimes) | Faible | Modéré | Toutes les transactions XAF sont des entiers → aucune perte réelle |
| Migration partielle bloquée en prod | Faible | Critique | Scripts de rollback testés sur staging |

---

## 7. Verdict

**ARCHITECTURE COMPATIBLE APRÈS MIGRATION**

Les deux architectures opèrent dans des schémas distincts et peuvent coexister. La migration est faisable, progressive et réversible, à condition de :

1. ✅ Appliquer les migrations sur staging en premier (jamais en production directement)
2. ✅ Disposer d'un backup complet avant chaque étape production
3. ✅ Seeder `app.roles`, `ops.number_series` et `biz.chart_of_accounts` avant d'activer Finance
4. ✅ Maintenir `public` dans la config PostgREST pendant la transition
5. ✅ Ne jamais utiliser simultanément `public.journal_entries` et `biz.journal_entries` pour les mêmes flux

> Autorisation écrite du responsable technique requise avant toute exécution en production.
