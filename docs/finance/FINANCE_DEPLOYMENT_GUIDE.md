# FINANCE_DEPLOYMENT_GUIDE — BS4U BUSINESS MANAGER

## Prérequis

- Projet Supabase : `mvebwahpforfxqohjusp`
- Supabase CLI ≥ 1.200
- Variables d'environnement : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`

## Contraintes de déploiement Production

> **RÈGLE ABSOLUE** : Les migrations ne s'appliquent en production qu'après autorisation explicite écrite.

## Ordre des migrations

Les migrations doivent être appliquées **dans l'ordre chronologique** (les timestamps garantissent l'ordre) :

```
20261126000100_finance_periods.sql
20261126000200_finance_journal.sql
20261126000300_finance_seed_coa.sql
20261126000400_finance_reserves.sql
20261126000500_finance_capital_loans.sql
20261126000600_finance_assets.sql
20261126000700_finance_treasury.sql
20261126000800_momo_closings.sql
20261126000900_finance_rpcs.sql
20261126001000_finance_dashboard.sql
20261126001100_finance_rls.sql
```

## Vérification avant déploiement

```bash
# 1. Identifier le projet cible
supabase projects list

# 2. Vérifier l'état des migrations distantes
supabase migration list --project-ref mvebwahpforfxqohjusp

# 3. Vérifier les migrations locales non appliquées
supabase migration list

# 4. Tester sur environnement local d'abord
supabase start
supabase db push --local

# 5. Lancer les tests pgTAP (local)
supabase test db
```

## Déploiement local (automatique autorisé)

```bash
supabase db push --local
```

## Déploiement production (autorisation requise)

```bash
# Seulement après validation explicite écrite
supabase db push --project-ref mvebwahpforfxqohjusp
```

## Post-déploiement

```bash
# Vérifier les vues API
supabase db execute --project-ref mvebwahpforfxqohjusp \
  "SELECT table_name FROM information_schema.views WHERE table_schema = 'api' AND table_name LIKE 'v_%' ORDER BY 1;"

# Vérifier les grants
supabase db execute --project-ref mvebwahpforfxqohjusp \
  "SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'authenticated' AND table_schema IN ('biz','momo','api') ORDER BY table_schema, table_name;"
```

## Rollback

Toutes les migrations Finance sont non destructives sur les données existantes. En cas de problème :

1. Identifier la migration à annuler
2. Créer une migration inverse (`DROP TABLE` ou `DROP FUNCTION`)
3. Appliquer après autorisation

## Seed de production

La migration `20261126000300_finance_seed_coa.sql` insère le plan comptable SYSCOHADA. Elle est idempotente (`ON CONFLICT DO NOTHING`). La période initiale `2026-11` est insérée par `20261126000100_finance_periods.sql`.
