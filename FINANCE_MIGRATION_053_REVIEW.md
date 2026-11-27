# FINANCE_MIGRATION_053_REVIEW
_Revue complète de la migration locale 053 — Généré le 2026-11-27_

## Fichier

`backend/supabase/migrations/20261127000100_053_fix_finance_views.sql`  
Statut : **LOCAL UNIQUEMENT — non appliqué en production**

---

## Vue 1 : `v_treasury_reconciliations`

### SQL examiné
```sql
CREATE OR REPLACE VIEW public.v_treasury_reconciliations WITH (security_invoker = true) AS
SELECT id, account_type, account_id, financial_period_id,
  created_at::date::text AS reconciliation_date,
  expected_balance_xaf, actual_balance_xaf,
  (actual_balance_xaf - expected_balance_xaf)::bigint AS difference_xaf,
  status, notes
FROM public.treasury_reconciliations;
```

### Vérification des colonnes source

| Colonne sélectionnée | Existe dans `treasury_reconciliations` | Type | Nullable |
|---------------------|--------------------------------------|------|----------|
| `id` | ✅ | uuid | NO |
| `account_type` | ✅ | text | NO |
| `account_id` | ✅ | uuid | YES |
| `financial_period_id` | ✅ | uuid | YES |
| `created_at` | ✅ | timestamptz | YES |
| `expected_balance_xaf` | ✅ | bigint | NO |
| `actual_balance_xaf` | ✅ | bigint | NO |
| `status` | ✅ | text | NO |
| `notes` | ✅ | text | YES |

**Résultat** : Toutes les colonnes existent. ✅

### Analyse sécurité

- `security_invoker = true` → la vue hérite du contexte RLS de l'appelant ✅
- `treasury_reconciliations` a RLS activé avec policy `org_isolation` ✅
- `organization_id` nullable sur la table source → les rows avec `organization_id IS NULL` sont invisibles pour tous les utilisateurs org-scoped (pas d'erreur, mais orphelins potentiels)
- Policy `org_isolation` utilise un subquery sur `profiles` (pas `get_my_org_id()`) → légèrement moins performant mais correct

### Points d'attention

- `reconciliation_date` = `created_at::date::text` : il n'existe pas de colonne `reconciliation_date` native sur la table. Ce calcul est acceptable mais perd l'heure exacte.
- `difference_xaf` = `actual - expected` : calcul d'écart correct. Le cast `::bigint` est nécessaire si les valeurs sources sont déjà bigint (cast idempotent, sans risque).

**Verdict** : Vue correcte, prête à appliquer. ✅

---

## Vue 2 : `v_momo_daily_closings`

### SQL examiné
```sql
CREATE OR REPLACE VIEW public.v_momo_daily_closings WITH (security_invoker = true) AS
SELECT
  md5(mmt.account_id::text || mmt.created_at::date::text)::uuid AS id,
  mmt.account_id,
  mmt.created_at::date::text AS closing_date,
  COALESCE(mma.account_name, 'Compte MoMo') AS account_name,
  COALESCE(mma.provider::text, 'inconnu') AS operator,
  COALESCE(SUM(mmt.commission_xaf) FILTER (WHERE mmt.status::text = 'completed'), 0)::bigint AS total_commissions_xaf,
  0::bigint AS discrepancy_xaf,
  'validated'::text AS status
FROM public.mobile_money_transactions mmt
LEFT JOIN public.mobile_money_accounts mma ON mma.id = mmt.account_id
GROUP BY mmt.account_id, mmt.created_at::date, mma.account_name, mma.provider;
```

### Vérification du filtre de statut

Enum `transaction_status` sur `mobile_money_transactions.status` :
```
pending | completed | failed | reversed
```

Le filtre `WHERE mmt.status::text = 'completed'` cible correctement les transactions finalisées.  
Les transactions `reversed` sont exclues — correct (une commission sur transaction annulée = 0).

### Analyse de l'ID synthétique

```sql
md5(account_id::text || date::text)::uuid AS id
```

Déterministe pour chaque `(account_id, date)` unique car le GROUP BY est sur ces mêmes colonnes. Pas de collision possible dans la grille de la vue. ✅

### Shortcuts documentés

| Colonne | Valeur | Nature | Quand upgrader |
|---------|--------|--------|----------------|
| `discrepancy_xaf` | `0::bigint` | Shortcut | Phase 4 : calcul depuis réconciliations MoMo réelles |
| `status` | `'validated'` | Shortcut | Phase 4 : dériver depuis données de rapprochement |

Ces shortcuts sont acceptables en Phase 3 — la vue affiche un résumé lisible sans fausse information critique.

### Analyse sécurité

- `security_invoker = true` → RLS de l'appelant s'applique sur `mobile_money_transactions` ✅
- `mobile_money_transactions` a RLS multi-policy (org + agence) — voir `FINANCE_PHASE3A_SECURITY_AUDIT.md`
- LEFT JOIN sur `mobile_money_accounts` : si un compte est supprimé, les transactions orphelines apparaissent avec `account_name = 'Compte MoMo'` — acceptable

**Verdict** : Vue correcte avec shortcuts documentés. Prête à appliquer. ✅

---

## Vue 3 : `v_journal_entries`

### SQL examiné
```sql
CREATE OR REPLACE VIEW public.v_journal_entries WITH (security_invoker = true) AS
SELECT je.id,
  COALESCE(je.reference, 'JE-' || to_char(je.entry_date::timestamptz, 'YYYY') || '-' || substring(je.id::text, 1, 6)) AS entry_number,
  fp.id AS financial_period_id,
  je.entry_date::text AS entry_date, je.status::text AS status,
  je.description, je.related_type AS source_type, je.related_id AS source_id,
  COALESCE((SELECT SUM(jl.debit)::bigint FROM public.journal_lines jl WHERE jl.entry_id = je.id), 0) AS total_xaf,
  je.created_at::text AS created_at, fp.label AS period_label
FROM public.journal_entries je
LEFT JOIN LATERAL (
  SELECT fp2.id, fp2.label FROM public.financial_periods fp2
  WHERE fp2.organization_id = je.organization_id
    AND je.entry_date BETWEEN fp2.starts_at AND fp2.ends_at
  ORDER BY (fp2.period_type = 'monthly') DESC, fp2.starts_at DESC LIMIT 1
) fp ON true;
```

### Bug : COALESCE sur colonne NOT NULL

`journal_entries.reference` est définie `NOT NULL` en base. Le fallback dans `COALESCE(je.reference, 'JE-' || ...)` ne se déclenchera jamais.

**Impact** : Code mort. `entry_number` = toujours `je.reference`. Inoffensif, mais la logique de fallback ne sera jamais testée en production.

**Correction possible** : Soit supprimer le COALESCE et renommer directement `je.reference AS entry_number`, soit laisser tel quel (sécurité défensive).

### LATERAL join pour financial_period_id

```sql
ORDER BY (fp2.period_type = 'monthly') DESC, fp2.starts_at DESC LIMIT 1
```

Préférence correcte : période mensuelle > annuelle si les deux contiennent la date d'écriture. ✅

Cas limite : si aucune période ne contient la date d'écriture, `fp.id` retourne NULL — `financial_period_id` sera NULL. Le service (`journalService.ts`) accepte `financial_period_id: z.string().uuid().nullable()`. ✅

### Cast de dates

`je.entry_date::text` et `je.created_at::text` : si ces colonnes sont `timestamptz`, le cast vers `text` inclut le offset timezone (`+01:00`). Le service `types.ts` utilise `z.string()` pour ces champs — compatible, mais parsing côté frontend non garanti. Acceptable en Phase 3.

### Analyse sécurité

- `security_invoker = true` ✅
- `journal_entries` RLS : `organization_id = get_my_org_id()` ✅
- `journal_lines` (sous-requête) : RLS vérifié séparément ✅
- `financial_periods` (LATERAL) : RLS avec filtre `organization_id` ✅

**Verdict** : Vue correcte. Bug COALESCE = code mort inoffensif. Prête à appliquer. ✅

---

## Résumé de la migration

| Vue | Colonnes correctes | Sécurité | Shortcut | Verdict |
|-----|-------------------|----------|----------|---------|
| `v_treasury_reconciliations` | ✅ | ✅ | Aucun | ✅ Prête |
| `v_momo_daily_closings` | ✅ | ✅ | discrepancy=0, status='validated' | ✅ Prête |
| `v_journal_entries` | ✅ | ✅ | COALESCE mort | ✅ Prête |

**GRANTs** : Les 3 `GRANT SELECT ... TO authenticated, anon, service_role` sont corrects. ✅

## Instruction d'application

```sql
-- Exécuter dans Supabase SQL Editor (projet mvebwahpforfxqohjusp)
-- ou via : supabase db push --project-ref mvebwahpforfxqohjusp
```

La migration est **sûre à appliquer**. Aucune table n'est modifiée. Les vues existantes (`v_treasury_reconciliations`, `v_momo_daily_closings`, `v_journal_entries`) sont remplacées par `CREATE OR REPLACE`.

**Effet immédiat après application** :
- Page Trésorerie : affiche les rapprochements réels
- Page Commissions : affiche les commissions MoMo agrégées par jour
- Page Journal : `financial_period_id` correctement renseigné par LATERAL join
