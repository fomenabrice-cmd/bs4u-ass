# FINANCE_PHASE3B_TEST_REPORT
_Tests Phase 3B — Généré le 2026-11-27_

## Méthode

Les tests listés ci-dessous ont été **préparés** mais **non exécutés** : l'environnement de preview Supabase n'est pas disponible dans cette phase et aucune migration n'est appliquée en production.

Les tests sont classés :
- **PRÉPARÉ** : logique vérifiée par analyse statique du SQL
- **NON EXÉCUTÉ** : nécessite une base de données active

---

## Scénario 1 — Deux organisations distinctes

**Objectif** : Vérifier qu'un utilisateur de l'org A ne peut pas lire les données de l'org B.

**Tables concernées** : toutes les tables Finance avec RLS basé sur `get_my_org_id()`.

**Vecteur de test** :
```sql
-- Connecté en tant que user_org_A
SELECT * FROM public.journal_entries;
-- Résultat attendu : uniquement les lignes de l'org A
-- Résultat interdit : lignes de l'org B
```

**Status** : PRÉPARÉ (analyse statique — `get_my_org_id()` vérifié dans toutes les policies)

**Risque résiduel** : `asset_depreciation_schedules` sans org_id — corrigé par migration 053b (non appliquée)

---

## Scénario 2 — Deux agences d'une même organisation

**Objectif** : Un utilisateur d'agence A ne voit pas les transactions MoMo de l'agence B.

**Vecteur** :
```sql
-- user_agence_A : profiles.establishment_id = uuid_agence_A
SELECT * FROM public.mobile_money_transactions;
-- Attendu : uniquement les lignes avec establishment_id = uuid_agence_A
```

**Status** : PRÉPARÉ (migration 053b corrige `can_access_establishment` + policy unifiée)  
**Non exécuté** : nécessite 2 profils avec établissements différents

---

## Scénario 3 — Utilisateur sans établissement (siège)

**Objectif** : Un utilisateur sans `establishment_id` ne doit pas voir toutes les données multi-agence.

**Before (bugué)** : `can_access_establishment(any_id)` retournait TRUE pour tout user sans establishment_id.  
**After (corrigé)** : User sans establishment ne voit que les lignes avec `establishment_id IS NULL`.

**Vecteur** :
```sql
-- user_siege : profiles.establishment_id = NULL, is_admin() = false
SELECT * FROM public.expenses;
-- Attendu : uniquement expenses WHERE establishment_id IS NULL
-- Interdit : expenses d'une agence spécifique
```

**Status** : PRÉPARÉ (logique vérifiée dans la nouvelle policy `expenses_access`)  
**Non exécuté**

---

## Scénario 4 — Administrateur autorisé

**Objectif** : `is_admin()` voit toutes les données de son org.

**Vecteur** :
```sql
-- admin_org_A : user_roles.role IN ('admin','super_admin')
SELECT * FROM public.expenses;
-- Attendu : toutes les expenses de l'org A (toutes agences confondues)
```

**Status** : PRÉPARÉ (`is_admin()` shortcut dans `expenses_access` et `mmt_access`)  
**Non exécuté**

---

## Scénario 5 — Tentative de lecture inter-organisation

**Objectif** : Insertion directe avec un organization_id étranger.

**Vecteur** :
```sql
-- user_org_A tente d'insérer dans l'org B
INSERT INTO public.loans(organization_id, ...) VALUES ('uuid_org_B', ...);
-- Attendu : rejeté par WITH CHECK (organization_id = get_my_org_id())
```

**Status** : PRÉPARÉ (WITH CHECK sur toutes les policies INSERT)  
**Non exécuté**

---

## Scénario 6 — Insertion avec un autre organization_id

Identique à scénario 5. La RPC `create_loan` injecte `get_my_org_id()` directement — l'appelant ne peut pas passer d'organization_id.

**Status** : PRÉPARÉ (design du RPC)

---

## Scénario 7 — Remboursement partiel d'emprunt

**Vecteur** :
```sql
SELECT record_loan_repayment(
  'uuid_loan_actif', 50000, 40000, 10000, 0, '2026-11-01', 'Mensualité 1'
);
-- Attendu :
--   loan_repayments : 1 ligne créée
--   loans.outstanding_principal_xaf = principal - 40000
--   loans.status = 'active'
```

**Status** : PRÉPARÉ (logique vérifiée dans le RPC)  
**Non exécuté**

---

## Scénario 8 — Remboursement final (solde = 0)

**Vecteur** :
```sql
-- outstanding = 10000
SELECT record_loan_repayment('uuid_loan', 12000, 10000, 2000, 0, '2026-12-01', 'Solde');
-- Attendu :
--   outstanding_principal_xaf = 0
--   status = 'paid_off'
```

**Status** : PRÉPARÉ  
**Non exécuté**

---

## Scénario 9 — Remboursement supérieur au solde

**Vecteur** :
```sql
-- outstanding = 10000
SELECT record_loan_repayment('uuid_loan', 60000, 50000, 10000, 0, CURRENT_DATE, 'Erreur');
-- Attendu : RAISE EXCEPTION 'Principal 50000 exceeds outstanding 10000'
```

**Status** : PRÉPARÉ (validation dans le RPC)  
**Non exécuté**

---

## Scénario 10 — Amortissement avec arrondis

**Vecteur** :
```sql
-- Asset : purchase_price=1000000, residual=0, useful_life_months=36
-- monthly = 1000000/36 = 27777 (FLOOR)
-- total dotations = 27777 * 35 = 972195
-- dernière dotation = 1000000 - 972195 = 27805
SELECT compute_depreciation('uuid_asset');
-- Vérifier :
SELECT SUM(amount_xaf) FROM asset_depreciation_schedules WHERE asset_id='uuid_asset';
-- Attendu : 1000000 exactement (pas 999972 ni 1000008)
```

**Status** : PRÉPARÉ (logique `v_remainder` dans le RPC)  
**Non exécuté**

---

## Scénario 11 — Recalcul d'un échéancier partiellement posté

**Vecteur** :
```sql
-- 3 lignes draft, 2 lignes posted
SELECT compute_depreciation('uuid_asset_partiel');
-- Attendu : 3 lignes draft supprimées et recréées, 2 lignes posted intactes
```

**Status** : PRÉPARÉ (`DELETE WHERE status = 'draft'` + `ON CONFLICT DO NOTHING`)  
**Non exécuté**

---

## Scénario 12 — Affectation et utilisation d'une réserve

**Vecteur** :
```sql
-- Affectation de 100000 à la réserve légale
INSERT INTO reserve_movements(reserve_id, movement_type, amount_xaf, movement_date, reason)
VALUES ('uuid_reserve', 'allocation', 100000, CURRENT_DATE, 'Affectation résultat 2026');
UPDATE reserves SET current_balance_xaf = current_balance_xaf + 100000 WHERE id='uuid_reserve';
-- Utilisation de 30000
INSERT INTO reserve_movements ... ('usage', 30000, ...);
UPDATE reserves SET current_balance_xaf = current_balance_xaf - 30000 ...;
-- Solde attendu : 70000
```

**Status** : PRÉPARÉ (logique RPC `create_reserve_movement`)  
**Non exécuté**

---

## Scénario 13 — Écriture déséquilibrée

**Vecteur** :
```sql
SELECT create_journal_entry(
  '2026-11-01', 'Test déséquilibré', 'JE-TEST-001',
  '[{"account_id":"uuid","debit":1000,"credit":0,"description":"Débit"},
    {"account_id":"uuid","debit":0,"credit":800,"description":"Crédit partiel"}]'
);
-- Attendu : RAISE EXCEPTION 'Unbalanced entry: debit=1000 credit=800'
```

**Status** : PRÉPARÉ (validation `ROUND(debit, 0) != ROUND(credit, 0)`)  
**Non exécuté**

---

## Scénario 14 — Écriture sur période clôturée

**Vecteur** :
```sql
-- financial_periods WHERE status='closed' ET contient '2025-01-15'
SELECT create_journal_entry('2025-01-15', 'Test période clôturée', 'JE-CLOTURE', '[]');
-- Attendu : RAISE EXCEPTION 'No open financial period for date 2025-01-15'
```

**Status** : PRÉPARÉ (vérification période dans le RPC)  
**Non exécuté**

---

## Scénario 15 — Double soumission idempotente

**Note** : Les RPCs Finance ne sont pas idempotentes par conception. Chaque appel crée une nouvelle entrée. L'idempotence est gérée côté UI (désactivation du bouton). Pas de test de double soumission pour ces RPCs.

**Status** : NON APPLICABLE (design conscient, documenté)

---

## Résumé

| Scénario | Type | Status |
|----------|------|--------|
| 1. Inter-organisation | Sécurité | PRÉPARÉ |
| 2. Inter-agence | Sécurité | PRÉPARÉ |
| 3. User sans établissement | Sécurité | PRÉPARÉ |
| 4. Administrateur | Sécurité | PRÉPARÉ |
| 5-6. Insertion org étrangère | Sécurité | PRÉPARÉ |
| 7. Remboursement partiel | Fonctionnel | PRÉPARÉ |
| 8. Remboursement final | Fonctionnel | PRÉPARÉ |
| 9. Remboursement > solde | Validation | PRÉPARÉ |
| 10. Amortissement + arrondis | Calcul | PRÉPARÉ |
| 11. Recalcul partiel | Calcul | PRÉPARÉ |
| 12. Réserve affectation/usage | Fonctionnel | PRÉPARÉ |
| 13. Écriture déséquilibrée | Validation | PRÉPARÉ |
| 14. Période clôturée | Validation | PRÉPARÉ |
| 15. Double soumission | Idempotence | NON APPLICABLE |

**Tests exécutés** : 0  
**Tests préparés** : 14  
**Tests non applicables** : 1
