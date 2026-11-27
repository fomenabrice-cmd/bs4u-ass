# FINANCE_ASSET_DEPRECIATION_RULES
_Règles de calcul des amortissements — Généré le 2026-11-27_

## Modèle conceptuel

Une immobilisation perd de la valeur au fil du temps. Cette perte est comptabilisée périodiquement comme une **dotation aux amortissements** (charge non décaissée).

**Valeur nette comptable (VNC)** = Prix d'acquisition − Cumul des amortissements

**Règle** : La VNC ne peut pas descendre en dessous de la valeur résiduelle.

## Structure réelle de `asset_depreciation_schedules`

Colonnes existantes en DB (confirmées) :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `asset_id` | uuid NULLABLE | Référence à l'immobilisation |
| `period_number` | integer NOT NULL | Numéro de période (1 = premier mois/an) |
| `period_date` | date NOT NULL | Date de la période (1er du mois) |
| `amount_xaf` | bigint NOT NULL DEFAULT 0 | Dotation de la période |
| `created_at` | timestamptz | |
| `organization_id` | uuid | Ajouté par migration 053b |

**Remarque** : Il n'existe pas de colonne `depreciation_xaf`, `cumulative_xaf` ou `year`. Le cumul s'obtient par `SUM(amount_xaf) WHERE asset_id = ? AND period_number <= n`.

## Table `assets`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | |
| `name` | text NOT NULL | Désignation |
| `category` | text NOT NULL | equipment / vehicle / building / software / other |
| `purchase_date` | date NOT NULL | Date d'acquisition |
| `service_start_date` | date | Date de mise en service (défaut : purchase_date) |
| `purchase_price_xaf` | bigint NOT NULL | Prix d'acquisition |
| `residual_value_xaf` | bigint NOT NULL DEFAULT 0 | Valeur résiduelle en fin de vie |
| `useful_life_months` | integer NOT NULL | Durée d'utilisation en mois |
| `depreciation_method` | text NOT NULL DEFAULT 'straight_line' | Méthode |
| `disposal_date` | date | Date de sortie (cession, mise au rebut) |
| `status` | text NOT NULL DEFAULT 'active' | active / disposed / fully_depreciated |
| `notes` | text | |
| `created_at` | timestamptz | |

## Méthode d'amortissement linéaire (straight_line)

La seule méthode implémentée en Phase 3B.

### Formule

```
dotation_mensuelle = (purchase_price_xaf - residual_value_xaf) / useful_life_months
```

### Arrondi

L'arrondi est fait à l'entier (FLOOR). La dernière période absorbe le reste :
```
dernière_dotation = purchase_price_xaf - residual_value_xaf - SUM(toutes dotations précédentes)
```
Ceci évite une VNC négative due aux arrondis cumulés.

### Génération du calendrier (RPC `compute_depreciation`)

**Règle critique** : Ne pas supprimer les dotations validées (`posted`).

Algorithme :
1. Identifier les périodes existantes avec `status = 'posted'` (via table liée ou flag) → à préserver
2. Supprimer uniquement les lignes `draft` (ou sans status) du plan
3. Recréer les lignes manquantes depuis `service_start_date`
4. `period_date` = premier jour du mois (DATE_TRUNC('month', service_start_date) + (n-1) mois)
5. `period_number` = ordinal 1..useful_life_months

**Note sur les lignes existantes** : La table actuelle `asset_depreciation_schedules` n'a pas de colonne `status`. En Phase 3B, on adopte la règle : toute ligne existante est considérée draft et peut être recréée. Ajouter une colonne `status` dans la migration 054 pour distinguer draft/posted.

### Recalcul après correction

Si le prix ou la durée change après création (ex : erreur de saisie) :
1. Créer une **écriture de correction** dans le journal (pas de suppression rétroactive)
2. Recréer le plan depuis la période courante
3. Les périodes passées restent intactes dans le plan (traçabilité)

## Vue `v_assets`

Colonnes attendues par `assetService.ts` :

```sql
SELECT
  a.id, a.name, a.category,
  a.purchase_date::text            AS purchase_date,
  a.purchase_price_xaf,
  GREATEST(
    a.purchase_price_xaf - COALESCE(d.cumulative_xaf, 0),
    a.residual_value_xaf
  )                                AS current_value_xaf,
  a.depreciation_rate,
  a.status
FROM public.assets a
LEFT JOIN (
  SELECT asset_id, SUM(amount_xaf) AS cumulative_xaf
  FROM public.asset_depreciation_schedules
  GROUP BY asset_id
) d ON d.asset_id = a.id
```

**`depreciation_rate`** : Pour maintenir la compatibilité avec l'interface (`assetService.ts` attend `depreciation_rate`), ajouter une colonne calculée ou computed field. Dans la migration 054, `depreciation_rate` est un alias de `ROUND(100.0 / useful_life_months / 12 * 12, 2)` pour le taux annuel.

Alternativement, ajouter `depreciation_rate numeric` comme colonne calculée au moment de la création (`100.0 / useful_life_months * 12` pour annuel).
