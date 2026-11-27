# FINANCE_RESERVE_LEDGER_DESIGN
_Conception du grand livre des réserves — Généré le 2026-11-27_

## Modèle conceptuel

Une réserve est une **affectation interne de trésorerie**, pas une charge.

**Règle fondamentale** : L'affectation à une réserve N'EST PAS une charge supplémentaire dans le compte de résultat. C'est un virement interne depuis le résultat courant ou les bénéfices non distribués vers un compte de réserve. Elle ne réduit PAS le chiffre d'affaires ni les marges.

**Conséquence** : La page Marges et le Dashboard ne doivent pas déduire les réserves du résultat net. Les réserves apparaissent uniquement dans le bilan (capitaux propres), pas dans le compte de résultat.

## Schéma de données

### Table `reserves`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | |
| `name` | text NOT NULL | Ex : "Réserve légale", "Réserve pour investissements" |
| `current_balance_xaf` | bigint NOT NULL DEFAULT 0 | Solde actuel (maintenu par trigger ou RPC) |
| `target_xaf` | bigint | Objectif (nullable) |
| `reserve_type` | text NOT NULL | legal / statutory / voluntary / contingency |
| `description` | text | |
| `created_at` | timestamptz | |

### Table `reserve_movements`

Chaque mouvement est tracé immutablement. Une annulation crée un mouvement contraire, pas une suppression.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `reserve_id` | uuid NOT NULL FK | |
| `movement_type` | text NOT NULL | allocation / usage / reconstitution / cancellation |
| `amount_xaf` | bigint NOT NULL | Toujours positif (direction = movement_type) |
| `movement_date` | date NOT NULL | |
| `reason` | text NOT NULL | Motif obligatoire |
| `source_type` | text | Type de l'objet source (journal_entry, expense, etc.) |
| `source_id` | uuid | ID de l'objet source |
| `created_by` | uuid | auth.uid() au moment de la création |
| `created_at` | timestamptz | |
| `cancelled_at` | timestamptz | NULL si actif |
| `cancelled_by` | uuid | auth.uid() de l'annulateur |
| `cancel_reason` | text | |

**Contraintes** :
- `amount_xaf > 0` (toujours positif, la direction est portée par `movement_type`)
- `movement_type IN ('allocation', 'usage', 'reconstitution', 'cancellation')`
- Pas de DELETE ni UPDATE sur les mouvements validés

## Sémantique des mouvements

| Type | Effet sur solde | Exemple |
|------|----------------|---------|
| `allocation` | +amount | Affectation du bénéfice à la réserve légale |
| `usage` | -amount | Utilisation pour financer un investissement |
| `reconstitution` | +amount | Reconstitution après utilisation |
| `cancellation` | Inverse un mouvement précédent | Erreur d'affectation corrigée |

**Le solde `current_balance_xaf`** est maintenu en cohérence par le RPC de création de mouvement. Il ne doit pas être mis à jour directement.

## Règles du RPC `create_reserve_movement`

### Validations

1. `reserve.organization_id = get_my_org_id()`
2. `amount_xaf > 0`
3. Pour `usage` et `cancellation` : `amount_xaf <= current_balance_xaf` (interdit les soldes négatifs)
4. `reason` non vide
5. `movement_type` dans la liste valide

### Effets

```sql
-- Allocation / reconstitution
UPDATE reserves SET current_balance_xaf = current_balance_xaf + amount_xaf WHERE id = p_reserve_id;

-- Usage
UPDATE reserves SET current_balance_xaf = current_balance_xaf - amount_xaf WHERE id = p_reserve_id;

-- Cancellation (annule un mouvement précédent)
-- Inverse le delta du mouvement original
-- Nécessite p_original_movement_id
```

### Annulation contrôlée

```sql
-- Annuler un mouvement existant (crée un mouvement inverse)
-- 1. Lire le mouvement original
-- 2. Vérifier qu'il n'est pas déjà annulé (cancelled_at IS NULL)
-- 3. Marquer le mouvement original comme annulé
-- 4. Créer un mouvement de type 'cancellation' inverse
-- 5. Mettre à jour le solde de la réserve
```

## Lien avec `allocation_rules`

La table `allocation_rules` (existante) définit les règles automatiques d'allocation :

| Colonne | Description |
|---------|-------------|
| `organization_id` | Organisation |
| `name` | Nom de la règle |
| `reserve_id` | Réserve cible |
| `percentage` | Pourcentage à allouer |
| `source_type` | Source des fonds (ex: 'net_profit') |
| `is_active` | Règle active/inactive |
| `effective_from` / `effective_to` | Période de validité |

Ces règles sont lues par `reserveService.ts` mais ne créent pas automatiquement des mouvements. Les mouvements sont créés manuellement ou lors d'une clôture de période. Cela évite les doubles déductions.

## Vue `v_reserves`

```sql
SELECT
  id, name, current_balance_xaf, target_xaf,
  reserve_type, description,
  NULL::text AS last_allocation_date  -- calculé via reserve_movements si besoin
FROM public.reserves
```

Pour inclure `last_allocation_date` :
```sql
LEFT JOIN (
  SELECT reserve_id, MAX(movement_date)::text AS last_allocation_date
  FROM public.reserve_movements
  WHERE movement_type IN ('allocation', 'reconstitution') AND cancelled_at IS NULL
  GROUP BY reserve_id
) m ON m.reserve_id = r.id
```
