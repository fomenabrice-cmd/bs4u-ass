# FINANCE_LOAN_ACCOUNTING_RULES
_Règles comptables des emprunts — Généré le 2026-11-27_

## Modèle conceptuel

Un emprunt est une dette financière. Son remboursement comporte deux composantes distinctes :

| Composante | Nature | Effet sur le résultat |
|-----------|--------|----------------------|
| Remboursement du principal | Réduction de la dette | Neutre (bilan uniquement) |
| Paiement des intérêts | Charge financière | Réduit le résultat net |
| Frais (éventuels) | Charge financière | Réduit le résultat net |

**Règle fondamentale** : Le principal remboursé NE CRÉE PAS une charge. Il diminue uniquement le solde de la dette. Seuls les intérêts et frais sont des charges.

## Schéma de données

### Table `loans`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | Org propriétaire |
| `creditor_name` | text NOT NULL | Créancier |
| `principal_xaf` | bigint NOT NULL | Capital initial emprunté |
| `outstanding_principal_xaf` | bigint NOT NULL | Principal restant dû |
| `interest_rate` | numeric(5,4) NOT NULL | Taux annuel (ex : 0.1500 = 15%) |
| `start_date` | date NOT NULL | Date de début |
| `end_date` | date | Date d'échéance prévue |
| `term_months` | integer | Durée prévue en mois |
| `status` | text NOT NULL | active / paid_off / defaulted |
| `notes` | text | |
| `created_at` | timestamptz | |

**Contraintes** :
- `principal_xaf > 0`
- `outstanding_principal_xaf >= 0`
- `outstanding_principal_xaf <= principal_xaf`
- `interest_rate >= 0`
- `status IN ('active', 'paid_off', 'defaulted')`

### Table `loan_repayments`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `loan_id` | uuid NOT NULL FK | Référence emprunt |
| `total_amount_xaf` | bigint NOT NULL | Montant total versé |
| `principal_xaf` | bigint NOT NULL | Dont : principal remboursé |
| `interest_xaf` | bigint NOT NULL | Dont : intérêts payés |
| `fees_xaf` | bigint NOT NULL DEFAULT 0 | Dont : frais |
| `payment_date` | date NOT NULL | Date du paiement |
| `notes` | text | Référence de virement, etc. |
| `created_at` | timestamptz | |

**Contraintes** :
- `total_amount_xaf = principal_xaf + interest_xaf + fees_xaf` (CHECK)
- `principal_xaf >= 0`, `interest_xaf >= 0`, `fees_xaf >= 0`
- `total_amount_xaf > 0`

## Règles du RPC `record_loan_repayment`

### Validations obligatoires

1. **Organisation** : `loans.organization_id = get_my_org_id()` — pas de remboursement inter-org
2. **Statut** : `loans.status = 'active'` — impossible de rembourser un prêt déjà soldé
3. **Équilibre** : `p_principal + p_interest + p_fees = p_total_amount` — rejeté sinon
4. **Capacité** : `p_principal <= outstanding_principal_xaf` — impossible de rembourser plus que le solde
5. **Montants positifs** : tous les composants >= 0, total > 0

### Effets

```
outstanding_principal_xaf ← outstanding_principal_xaf - p_principal
status ← 'paid_off' si outstanding_principal_xaf = 0
```

### Idempotence

La RPC n'est pas naturellement idempotente (chaque appel crée un remboursement). Pour éviter les doublons :
- L'appelant doit conserver l'`id` retourné
- Une contrainte UNIQUE sur `(loan_id, payment_date, total_amount_xaf)` peut être ajoutée en option (non recommandé : deux paiements le même jour au même montant sont légitimes)
- Approche recommandée : UI désactive le bouton après envoi, service vérifie `isLoading`

## Vue `v_loans`

Colonnes exposées au frontend (attendues par `capitalService.ts`) :

```sql
SELECT
  l.id,
  l.creditor_name,
  l.principal_xaf,
  l.outstanding_principal_xaf                              AS outstanding_xaf,
  l.interest_rate,
  l.start_date::text                                       AS start_date,
  l.end_date::text                                         AS end_date,
  l.status,
  l.notes,
  COALESCE(r.total_repaid_xaf, 0)                         AS total_repaid_xaf,
  COALESCE(r.total_interest_xaf, 0)                       AS total_interest_paid_xaf
FROM public.loans l
LEFT JOIN (
  SELECT loan_id,
    SUM(principal_xaf) AS total_repaid_xaf,
    SUM(interest_xaf)  AS total_interest_xaf
  FROM public.loan_repayments
  GROUP BY loan_id
) r ON r.loan_id = l.id
```

## Calcul des intérêts

Le calcul des intérêts est à la charge du frontend ou d'un service dédié. La DB ne calcule pas automatiquement les intérêts à chaque paiement — c'est l'opérateur qui décompose son paiement en principal/intérêts.

Pour les emprunts à taux fixe, intérêts calculés sur le principal restant :
```
intérêts_mensuels = outstanding_principal × (interest_rate / 12)
```

Cette logique est dans `capitalService.ts` ou dans l'UI, pas en DB.
