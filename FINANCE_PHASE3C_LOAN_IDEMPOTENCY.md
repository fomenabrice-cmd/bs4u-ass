# FINANCE_PHASE3C_LOAN_IDEMPOTENCY
_Conception de l'idempotence pour les remboursements d'emprunt — Phase 3C — Généré le 2026-11-27_

---

## Problème

La soumission d'un remboursement de prêt est une opération financière non réversible. Sans mécanisme d'idempotence, les scénarios suivants causent une double déduction :

1. **Double-clic UI** : l'utilisateur clique deux fois sur "Valider".
2. **Timeout réseau + retry** : la requête PostgREST time-out côté client, le client retente.
3. **Re-render React** : le composant soumet deux fois via `useEffect` ou double `mutation.mutate()`.
4. **Race condition** : deux onglets ouverts sur le même formulaire.

### Impact sans correction

```
Prêt : outstanding = 500 000 XAF
Remboursement demandé : 50 000 XAF principal

Appel 1 → outstanding = 450 000
Appel 2 → outstanding = 400 000 ← corruption
```

---

## Solution : idempotency_key

### Schéma

```sql
ALTER TABLE public.loan_repayments
  ADD COLUMN idempotency_key text;

ALTER TABLE public.loan_repayments
  ADD CONSTRAINT lr_idempotency_key_unique UNIQUE (idempotency_key);
```

**Type :** `text` nullable. Si `NULL`, aucune vérification d'idempotence (comportement Phase 3B — non recommandé, mais compatible).

**Contrainte :** `UNIQUE` sur la colonne (index unique partiel sur les valeurs non-NULL serait plus propre en PostgreSQL, mais la contrainte simple UNIQUE null-safe est suffisante : PostgreSQL 15+ permet deux NULL dans une colonne UNIQUE).

### Génération de la clé côté client

Recommandation : `crypto.randomUUID()` depuis le navigateur, stocké en state React avant la soumission.

```typescript
// Dans le composant ou le service TypeScript
const idempotencyKey = useRef(crypto.randomUUID());
// Transmis au RPC à chaque tentative de soumission pour le même formulaire
// Réinitialisé uniquement après succès confirmé
```

---

## Mécanique du RPC `record_loan_repayment`

### Paramètre ajouté

```sql
p_idempotency_key text DEFAULT NULL
```

### Logique Phase 3C

```sql
DECLARE
  v_loan public.loans%ROWTYPE;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Vérification idempotence avant tout verrouillage
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.loan_repayments
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
      -- Retour idempotent : même ID, aucun effet
      RETURN v_existing_id;
    END IF;
  END IF;

  -- 2. Verrous pour éviter les races concurrentes
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
    AND organization_id = get_my_org_id()
  FOR UPDATE;  -- Bloque les autres transactions sur ce prêt

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan % not found or access denied', p_loan_id;
  END IF;

  IF v_loan.status != 'active' THEN
    RAISE EXCEPTION 'Loan % is not active (status: %)', p_loan_id, v_loan.status;
  END IF;

  -- 3. Validations métier
  IF p_principal_xaf + p_interest_xaf + p_fees_xaf != p_total_amount_xaf THEN
    RAISE EXCEPTION 'Total % != principal % + interest % + fees %',
      p_total_amount_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf;
  END IF;

  IF p_principal_xaf > v_loan.outstanding_principal_xaf THEN
    RAISE EXCEPTION 'Principal % exceeds outstanding %',
      p_principal_xaf, v_loan.outstanding_principal_xaf;
  END IF;

  -- 4. INSERT avec idempotency_key
  INSERT INTO public.loan_repayments(
    organization_id, loan_id, idempotency_key,
    total_amount_xaf, principal_xaf, interest_xaf, fees_xaf,
    repayment_date, notes, created_by
  ) VALUES (
    get_my_org_id(), p_loan_id, p_idempotency_key,
    p_total_amount_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf,
    p_repayment_date, p_notes, auth.uid()
  ) RETURNING id INTO v_new_id;

  -- 5. Mise à jour du solde
  UPDATE public.loans
  SET
    outstanding_principal_xaf = outstanding_principal_xaf - p_principal_xaf,
    status = CASE
      WHEN outstanding_principal_xaf - p_principal_xaf <= 0 THEN 'paid_off'
      ELSE 'active'
    END,
    updated_at = now()
  WHERE id = p_loan_id;

  RETURN v_new_id;
END;
```

### Garanties

| Scénario | Comportement |
|----------|-------------|
| Premier appel | Insert + mise à jour outstanding |
| Deuxième appel même `idempotency_key` | Retour ID existant, pas de modification |
| Deux appels simultanés sans clé | SELECT FOR UPDATE sérialise — le second voit le solde après le premier |
| Appel avec principal > outstanding | RAISE EXCEPTION avant INSERT |

---

## Contrainte de base de données

La contrainte `UNIQUE (idempotency_key)` sur `loan_repayments` garantit qu'une collision de clé (deux transactions simultanées avec la même clé) lève une `unique_violation` PostgreSQL. Le RPC la gère naturellement : la transaction qui arrive en second échoue à l'INSERT et PostgreSQL rollback automatiquement.

```
Transaction A : idempotency_key='abc123' → INSERT réussit
Transaction B : idempotency_key='abc123' → vérification trouve la ligne A → retourne A.id
```

Si les deux transactions B arrivent en même temps (race sur la vérification) :
- Transaction A : vérification (rien), INSERT réussit, RETURN A.id
- Transaction B : vérification (rien), INSERT → `unique_violation` → exception PostgreSQL

Côté client, la `unique_violation` doit être traitée comme un succès idempotent (relire le remboursement existant par `idempotency_key`).

---

## Impact sur les tests Phase 3C

| Test | Scénario | Résultat attendu |
|------|----------|-----------------|
| T3 | Deux appels identiques même clé | 2ème appel retourne le même ID |
| T4 | Deux appels simultanés sans clé | SELECT FOR UPDATE sérialise |
| T5 | principal > outstanding | RAISE EXCEPTION |
