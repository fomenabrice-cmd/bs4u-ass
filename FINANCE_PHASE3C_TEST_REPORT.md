# FINANCE_PHASE3C_TEST_REPORT
_Rapport de tests Phase 3C — Généré le 2026-11-27_

## Méthode

Les 20 scénarios ont été **conçus et vérifiés par analyse statique**. Ils sont écrits comme SQL exécutable (`FINANCE_PHASE3C_TESTS.sql`) avec `ROLLBACK` pour ne laisser aucune donnée permanente. L'exécution réelle nécessite un environnement Supabase Preview avec les migrations 053B et 054 appliquées.

**Statuts possibles :**
- `ANALYSE STATIQUE` : logique vérifiée par lecture du SQL, non exécuté sur une DB active
- `BLOQUÉ` : nécessite migrations appliquées

---

## Tableau récapitulatif

| # | Catégorie | Scénario | Résultat attendu | Statut |
|---|-----------|----------|-----------------|--------|
| T1 | P0 | REVOKE PUBLIC sur `get_my_org_id` | No grant PUBLIC | ANALYSE STATIQUE |
| T2 | P0 | REVOKE PUBLIC sur `set_momo_capital` | No grant PUBLIC | ANALYSE STATIQUE |
| T3 | P1 | Idempotence — même clé → même ID | Retour ID existant | ANALYSE STATIQUE |
| T4 | P1 | Remboursement > outstanding | RAISE EXCEPTION | ANALYSE STATIQUE |
| T5 | P1 | Remboursement sur prêt paid_off | RAISE EXCEPTION | ANALYSE STATIQUE |
| T6 | P1 | INSERT direct reserve_movements | RLS violation | ANALYSE STATIQUE |
| T7 | P1 | Usage réserve > solde | RAISE EXCEPTION | ANALYSE STATIQUE |
| T8 | P2 | Contrainte UNIQUE sur ADS | Contrainte présente | ANALYSE STATIQUE |
| T9 | P2 | SUM amortissements = valeur amortissable | 1 000 000 XAF | ANALYSE STATIQUE |
| T10 | P2 | Recalcul préserve périodes posted | 3 posted + 33 draft | ANALYSE STATIQUE |
| T11 | P3 | Écriture 1 ligne rejetée | "at least 2 lines" | ANALYSE STATIQUE |
| T12 | P3 | Tableau vide rejeté | "at least 2 lines" | ANALYSE STATIQUE |
| T13 | P3 | Déséquilibre 0.1 XAF rejeté | "Unbalanced entry" | ANALYSE STATIQUE |
| T14 | P3 | account_id autre org rejeté | "Invalid account_id" | ANALYSE STATIQUE |
| T15 | P3 | Date dans période clôturée | "No open financial period" | ANALYSE STATIQUE |
| T16 | P3 | Écriture valide acceptée | UUID retourné | ANALYSE STATIQUE |
| T17 | P4 | Prêt org B invisible pour user org A | COUNT = 0 | ANALYSE STATIQUE |
| T18 | P4 | Réserve org B invisible pour user org A | COUNT = 0 | ANALYSE STATIQUE |
| T19 | P4 | ADS org B invisible pour user org A | COUNT = 0 | ANALYSE STATIQUE |
| T20 | P2 | SUM avec résiduelle = purchase - residual | 900 000 XAF | ANALYSE STATIQUE |

---

## Analyse par catégorie

### P0 — Privilèges effectifs (T1, T2)

**Logique vérifiée :** Les tests T1 et T2 interrogent `information_schema.routine_privileges` pour vérifier l'absence de grant PUBLIC. Cette requête est indépendante des migrations Finance — elle peut s'exécuter immédiatement après 053B.

**Risque résiduel :** Si la function `set_momo_capital` a été créée en plusieurs versions (overloaded), le REVOKE doit cibler la signature exacte. Le script 053B utilise `REVOKE ... FROM PUBLIC` sans signature — PostgreSQL applique à toutes les surcharges.

### P1 — Idempotence et intégrité (T3-T7)

**T3 (Idempotence) :** La logique `SELECT id WHERE idempotency_key = ...` avant INSERT garantit le retour idempotent. La contrainte UNIQUE partielle (`WHERE idempotency_key IS NOT NULL`) assure la déduplication au niveau base.

**T4-T5 (Validations) :** Les checks `outstanding > principal` et `status = 'active'` sont dans le RPC avant tout INSERT. L'analyse statique confirme leur placement avant la modification de données.

**T6 (INSERT direct bloqué) :** L'absence de policy INSERT pour `authenticated` sur `reserve_movements` est vérifiable par `SELECT * FROM pg_policies WHERE tablename = 'reserve_movements' AND cmd = 'INSERT' AND roles @> '{authenticated}'`.

**T7 (Solde insuffisant) :** Le SELECT FOR UPDATE sur `reserves` charge le solde actuel avant la vérification — pas de TOCTOU possible.

### P2 — Amortissement (T8-T10, T20)

**T8 :** Vérifiable directement : `SELECT conname FROM pg_constraint WHERE conrelid = 'asset_depreciation_schedules'::regclass AND contype = 'u'`.

**T9 et T20 :** L'algorithme garantit la somme exacte par construction :
- `v_monthly = depreciable / months` (division entière = FLOOR)
- `v_remainder = depreciable - v_monthly * (months - 1)`
- `SUM = v_monthly * (months - 1) + v_remainder = depreciable` ✅

**T10 :** `DELETE WHERE status = 'draft'` suivi de `ON CONFLICT DO NOTHING` garantit la préservation des posted. Vérifiable par l'analyse du RPC.

### P3 — Validation journal (T11-T16)

**T13 (Déséquilibre 0.1 XAF) :** C'est le test clé de Phase 3C. Avec `ROUND(x, 0)` (Phase 3B), `ROUND(1000.1, 0) = ROUND(1000.0, 0) = 1000` — le déséquilibre passait. Avec l'égalité exacte `v_total_debit <> v_total_credit` sur `numeric`, `1000.1 <> 1000.0` → exception. ✅

**T14 (account_id autre org) :** La validation `WHERE organization_id = get_my_org_id()` dans le check de `chart_of_accounts` empêche l'injection de comptes tiers.

**T15 (Période clôturée) :** La requête `status != 'closed'` filtre les périodes fermées. La date `2025-06-15` tombe dans la période `2025 (closed)` créée dans les données de test.

### P4 — RLS isolation (T17-T19)

**T17-T19 :** Ces tests simulent un changement de rôle avec `SET LOCAL role TO 'authenticated'`. En environnement Supabase réel, le JWT claims est passé via le header HTTP. L'analyse statique confirme que toutes les policies vérifient `organization_id = get_my_org_id()`.

---

## Résultat d'analyse statique

| Catégorie | Tests | Résultat |
|-----------|-------|---------|
| P0 Privilèges | T1, T2 | ✅ Logique correcte |
| P1 Idempotence | T3-T7 | ✅ Logique correcte |
| P2 Amortissement | T8-T10, T20 | ✅ Logique correcte |
| P3 Journal | T11-T16 | ✅ Logique correcte |
| P4 RLS | T17-T19 | ✅ Logique correcte |

**Verdict analyse statique : PASS sur les 20 scénarios.**

---

## Tests non exécutés (bloqués)

| Test | Raison du blocage |
|------|-----------------|
| T3 (idempotence réelle) | Nécessite JWT claims Supabase configuré |
| T6 (RLS violation) | Nécessite rôle `authenticated` dans la DB |
| T17-T19 (isolation RLS) | Nécessite `get_my_org_id()` retournant l'org du JWT |

Ces 4 tests nécessitent l'environnement Supabase Preview avec l'auth configurée. Ils ne peuvent pas s'exécuter en mode `postgres` direct.

---

## Checklist avant exécution sur Preview

- [ ] Migration 053B_FINAL appliquée
- [ ] Migration 054_FINAL appliquée
- [ ] Données de test créées (SECTION 0 du fichier SQL)
- [ ] Rôle `authenticated` avec JWT claims disponible
- [ ] Résultats T1-T2 : zéro grant PUBLIC sur helpers
- [ ] Résultat T8 : contrainte `ads_asset_period_unique` présente
- [ ] Résultats T17-T19 : COUNT = 0 pour données inter-org
