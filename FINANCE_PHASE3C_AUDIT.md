# FINANCE_PHASE3C_AUDIT
_Audit contradictoire Phase 3C — Généré le 2026-11-27_

---

## Méthode

Audit adversarial : chaque contrôle est formulé comme une attaque. La réponse indique si la défense tient ou si elle échoue. Basé sur l'inspection directe de la base de données Supabase (projet `mvebwahpforfxqohjusp`) et du code Phase 3B.

---

## P0 — Privilèges effectifs des fonctions SECURITY DEFINER

### Constat (DB, 2026-11-27)

```
get_my_org_id         → EXECUTE granted to PUBLIC
get_my_establishment_id → EXECUTE granted to PUBLIC
is_admin              → EXECUTE granted to PUBLIC
can_access_establishment → EXECUTE granted to PUBLIC
set_momo_capital      → EXECUTE granted to PUBLIC + authenticated
```

### Vecteur d'attaque

Un rôle PostgreSQL non mappé (par exemple un rôle de script de migration ou un rôle de test créé hors du système de profils) peut appeler `get_my_org_id()` directement et obtenir une valeur. Dans un contexte Supabase, le rôle `anon` peut aussi appeler ces fonctions directement via PostgREST `/rpc/get_my_org_id`.

### Criticité

**HAUTE.** Le grant `PUBLIC` signifie que `set_momo_capital` est accessible sans authentification. Les 4 fonctions helper sont techniquement nécessaires pour l'évaluation des policies RLS (rôle anon), mais le grant implicite via PUBLIC est plus large que nécessaire.

### Correction requise (053B_FINAL)

```sql
REVOKE EXECUTE ON FUNCTION public.get_my_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_org_id() TO anon, authenticated;
-- (idem pour les 3 autres helpers)

REVOKE EXECUTE ON FUNCTION public.set_momo_capital FROM PUBLIC;
-- GRANT TO authenticated déjà présent
```

**Justification :** `anon` a besoin des helpers pour l'évaluation des policies RLS (si une table a des policies pour le rôle anon). `authenticated` les utilise directement. `PUBLIC` inclut aussi `postgres`, `service_role`, et tout rôle créé ultérieurement — scope trop large.

---

## P1 — Idempotence de `record_loan_repayment`

### Constat

La table `loan_repayments` n'a **aucune colonne idempotency_key** et aucune contrainte UNIQUE empêchant la double soumission.

### Vecteur d'attaque

1. L'UI envoie un remboursement de 100 000 XAF.
2. Le réseau est lent, l'utilisateur clique deux fois (ou le composant React re-soumet).
3. Deux lignes sont créées dans `loan_repayments` pour le même remboursement.
4. `outstanding_principal_xaf` est décrémenté deux fois.
5. Le prêt passe en `paid_off` prématurément (ou en négatif si pas de CHECK).

### Criticité

**HAUTE.** Corruption de données financières sans mécanisme de détection.

### Correction requise (054_FINAL)

```sql
-- Colonne idempotency_key
ALTER TABLE public.loan_repayments ADD COLUMN idempotency_key text;
ALTER TABLE public.loan_repayments ADD CONSTRAINT lr_idempotency_key_unique UNIQUE (idempotency_key);

-- Dans le RPC record_loan_repayment
SELECT id INTO v_existing FROM public.loan_repayments
WHERE idempotency_key = p_idempotency_key;
IF FOUND THEN RETURN v_existing; END IF;
```

Combiné avec `SELECT ... FOR UPDATE` sur le prêt pour éviter les races concurrentes.

---

## P1 — INSERT direct sur `reserve_movements`

### Constat

Selon le design Phase 3B, `reserve_movements` doit être immutable : seul le RPC `create_reserve_movement` peut y écrire. Mais si une policy INSERT est accordée à `authenticated`, un utilisateur peut contourner le RPC.

### Correction requise (054_FINAL)

Aucune policy `INSERT` pour `authenticated` sur `reserve_movements`. Le RPC `create_reserve_movement` est `SECURITY DEFINER` et bypasse RLS.

```sql
-- Seule la SELECT policy existe pour authenticated
CREATE POLICY rm_select ON public.reserve_movements
  FOR SELECT TO authenticated
  USING (reserve_id IN (
    SELECT id FROM public.reserves WHERE organization_id = get_my_org_id()
  ));
-- PAS de policy INSERT/UPDATE/DELETE pour authenticated
```

---

## P2 — Contrainte UNIQUE manquante sur `asset_depreciation_schedules`

### Constat (DB, 2026-11-27)

```
asset_depreciation_schedules : UNIQUEMENT PRIMARY KEY + 4 NOT NULL CHECKs
Aucune contrainte UNIQUE sur (asset_id, period_number)
```

### Vecteur d'attaque

Le RPC `compute_depreciation` utilise `ON CONFLICT (asset_id, period_number) DO NOTHING` pour éviter les doublons lors d'un recalcul. Sans la contrainte UNIQUE, cette clause SQL échoue silencieusement (PostgreSQL ne lève pas d'erreur sur ON CONFLICT avec une colonne non contrainte — il lève une erreur de syntaxe ou crée des doublons selon la version).

En parallèle, deux requêtes `compute_depreciation` sur le même actif peuvent créer des lignes dupliquées.

### Criticité

**HAUTE.** Double facturation d'amortissement.

### Correction requise (054_FINAL)

```sql
ALTER TABLE public.asset_depreciation_schedules
  ADD CONSTRAINT ads_asset_period_unique UNIQUE (asset_id, period_number);
```

---

## P3 — `create_journal_entry` : validations manquantes

### P3-a : Tableau vide ou trop court

**Vecteur :** Appel avec `p_lines = '[]'` ou `p_lines = '[{"account_id":"..."}]'` (1 seule ligne). Une écriture à une seule ligne est invalide en comptabilité en partie double.

**Correction :** `IF jsonb_array_length(p_lines) < 2 THEN RAISE EXCEPTION ...`

### P3-b : account_id non validé

**Vecteur :** Appel avec un `account_id` qui n'existe pas dans `chart_of_accounts`, ou qui appartient à une autre organisation.

**Correction :** Vérifier chaque `account_id` dans `chart_of_accounts` WHERE `organization_id = get_my_org_id() AND is_active = true`.

### P3-c : ROUND masquant un déséquilibre

**Vecteur Phase 3B :** `IF ROUND(v_total_debit, 0) <> ROUND(v_total_credit, 0)` — une écriture débit=1000.4, crédit=1000.6 passe la validation (les deux arrondis à 1000).

**Correction Phase 3C :** `IF v_total_debit <> v_total_credit` — comparaison exacte sur le type `numeric` (aucun arrondi).

### P3-d : Période avec organization_id nullable

**Constat DB :** `financial_periods.organization_id` est NULLABLE. La requête doit gérer les périodes globales (NULL) et les périodes spécifiques à l'org.

**Correction :**
```sql
WHERE (organization_id IS NULL OR organization_id = get_my_org_id())
  AND p_entry_date BETWEEN starts_at AND ends_at
  AND status != 'closed'
ORDER BY organization_id NULLS LAST
LIMIT 1;
```

---

## P4 — RLS sur les nouvelles tables (054)

### Tables sans isolation org identifiées

| Table | Problème Phase 3B |
|-------|------------------|
| `asset_depreciation_schedules` | Pas d'organization_id (corrigé dans 053b) |
| `reserve_movements` | Pas de policy INSERT directe (design voulu) |
| `loans`, `loan_repayments` | Nouvelles tables — policies à créer dans 054 |
| `capital_contributions` | Soft-cancel requis, pas de DELETE direct |

### capital_contributions : soft-cancel uniquement

**Vecteur :** Un utilisateur peut appeler DELETE sur une contribution en capital pour effacer une trace comptable.

**Correction :** Pas de policy DELETE pour `authenticated`. L'annulation se fait via `cancelled_at`/`cancelled_by`.

---

## P5 — Vues : suppression des grants anon

### Constat Phase 3B

Les RPCs et vues Finance accordent l'accès à `authenticated`. Mais si les vues Finance héritent d'un grant `anon` implicite (via le grant `PUBLIC` sur les tables), les données sont lisibles sans authentification via PostgREST.

### Correction (053B_FINAL + 054_FINAL)

Toutes les vues Finance utilisent `WITH (security_invoker = true)` — elles héritent des droits de l'appelant. Si l'appelant est `anon`, les policies RLS s'appliquent. L'accès anon aux données Finance est bloqué par l'absence de policies `anon` sur les tables.

Vérifier également que les nouvelles vues (v_loans, v_assets, etc.) ne font pas de GRANT explicite à `anon`.

---

## Résumé des findings

| ID | Criticité | Statut | Corrigé dans |
|----|----------|--------|-------------|
| P0-HELPERS | HAUTE | Confirmé DB | 053B_FINAL |
| P0-MOMO | HAUTE | Confirmé DB | 053B_FINAL |
| P1-IDEMPOTENCY | HAUTE | Absent | 054_FINAL |
| P1-RESERVE-INSERT | HAUTE | Design requis | 054_FINAL |
| P2-UNIQUE-ADS | HAUTE | Absent DB | 054_FINAL |
| P3-ARRAY-MIN | MOYENNE | Absent 3B | 054_FINAL |
| P3-ACCOUNT-VALID | HAUTE | Absent 3B | 054_FINAL |
| P3-ROUND | HAUTE | Présent en 3B | 054_FINAL |
| P3-PERIOD-NULL | MOYENNE | Absent 3B | 054_FINAL |
| P4-CAPITAL-DELETE | MOYENNE | Design requis | 054_FINAL |
