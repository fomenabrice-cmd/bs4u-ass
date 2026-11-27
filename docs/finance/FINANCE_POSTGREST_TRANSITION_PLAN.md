# Plan de Transition PostgREST — Module Finance

> Date : 2026-11-27  
> Méthode : Analyse statique du code frontend + vérification distante READ-ONLY  
> Contrainte : Aucune modification de la base distante. Aucun `supabase db push`.

---

## 1. État Actuel

### 1.1 Configuration PostgREST distante (inférée)

```toml
# Config distante implicite (non modifiable sans autorisation)
[api]
schemas = ["public"]
```

**Ce que cela signifie :**
- PostgREST sert uniquement `public.*`
- Toutes les vues `api.*` sont **inaccessibles** depuis le frontend
- Le pattern `supabase.from("v_dashboard_finance" as never)` retourne **404**

### 1.2 Configuration PostgREST locale

```toml
# supabase/config.toml (local)
[api]
schemas = ["api"]
```

**Conflit :** Local cible `api.*`, production sert `public.*`. Le frontend Finance est entièrement incompatible avec la production actuelle.

---

## 2. Inventaire Complet des Appels `.from()` / `.rpc()`

### 2.1 Appels via pattern `as never` (new arch — non fonctionnels en prod)

| Appel | Service | Type | PostgREST path |
|-------|---------|------|----------------|
| `supabase.from("v_dashboard_finance" as never)` | dashboardService | SELECT | `GET /rest/v1/v_dashboard_finance` |
| `supabase.from("v_finance_periods_summary" as never)` | dashboardService | SELECT | `GET /rest/v1/v_finance_periods_summary` |
| `supabase.from("v_journal_entries" as never)` | journalService | SELECT | `GET /rest/v1/v_journal_entries` |
| `supabase.from("journal_entries" as never)` | journalService | UPDATE | `PATCH /rest/v1/journal_entries` |
| `supabase.rpc("create_journal_entry" as never, {...})` | journalService | RPC | `POST /rest/v1/rpc/create_journal_entry` |
| `supabase.from("v_loans" as never)` | capitalService | SELECT | `GET /rest/v1/v_loans` |
| `supabase.rpc("create_loan" as never, {...})` | capitalService | RPC | `POST /rest/v1/rpc/create_loan` |
| `supabase.rpc("record_loan_repayment" as never, {...})` | capitalService | RPC | `POST /rest/v1/rpc/record_loan_repayment` |
| `supabase.from("v_capital_contributions" as never)` | capitalService | SELECT | `GET /rest/v1/v_capital_contributions` |
| `supabase.from("v_assets" as never)` | assetService | SELECT | `GET /rest/v1/v_assets` |
| `supabase.rpc("create_asset" as never, {...})` | assetService | RPC | `POST /rest/v1/rpc/create_asset` |
| `supabase.rpc("compute_depreciation" as never, {...})` | assetService | RPC | `POST /rest/v1/rpc/compute_depreciation` |
| `supabase.from("asset_depreciation_schedules" as never)` | assetService | SELECT | `GET /rest/v1/asset_depreciation_schedules` |
| `supabase.from("v_reserves" as never)` | reserveService | SELECT | `GET /rest/v1/v_reserves` |
| `supabase.from("allocation_rules" as never)` | reserveService | SELECT | `GET /rest/v1/allocation_rules` |
| `supabase.rpc("allocate_margin" as never, {...})` | reserveService | RPC | `POST /rest/v1/rpc/allocate_margin` |
| `supabase.from("v_treasury_reconciliations" as never)` | treasuryService | SELECT | `GET /rest/v1/v_treasury_reconciliations` |
| `supabase.from("treasury_reconciliations" as never)` | treasuryService | INSERT | `POST /rest/v1/treasury_reconciliations` |
| `supabase.from("v_momo_daily_closings" as never)` | treasuryService | SELECT | `GET /rest/v1/v_momo_daily_closings` |
| `supabase.from("financial_periods" as never)` | periodService | SELECT | `GET /rest/v1/financial_periods` |
| `supabase.rpc("close_financial_period" as never, {...})` | periodService | RPC | `POST /rest/v1/rpc/close_financial_period` |

**Total : 21 appels — tous non fonctionnels en production actuelle**

### 2.2 Appels directs sans `as never` (old arch — partiellement fonctionnels en prod)

| Appel | Composant | Type | Statut Prod |
|-------|-----------|------|-------------|
| `supabase.from("invoices").select("id, invoice_number, status, total, amount_paid, issued_at, due_date, client:client_id(...)")` | FinanceInvoices | SELECT | ❌ Cassé (colonnes manquantes: `invoice_number`, `amount_paid`, `issued_at`) |
| `supabase.from("v_invoices").select("id, invoice_number, status, total_xaf, paid_xaf, issued_at, customer_name")` | FinanceEncaissements | SELECT | ❌ Bloqué (`public.v_invoices` absente) |
| `supabase.from("v_depenses").select("id, expense_number, label, category, amount_xaf, method, has_receipt, expense_date")` | FinanceDepenses | SELECT | ⚠️ Vue présente, colonnes à vérifier |

---

## 3. Plan de Transition en 3 Étapes

### Étape 1 — Application des migrations (prerequis)

**Condition :** Migrations 20261121* + 20261126* appliquées sur la base.

Après application, les vues et RPCs `api.*` existent. Mais PostgREST ne les sert pas encore (config `schemas=["public"]`).

### Étape 2 — Transition PostgREST

Modifier le fichier `supabase/config.toml` pour staging :

```toml
[api]
schemas = ["api", "public"]
extra_search_path = ["public", "extensions"]
```

**Ce que cela permet :**
- Module Finance fonctionne via `api.*`
- Anciens modules continuent via `public.*`
- Pas de coupure pour les modules existants

**Impact :** Redémarrage du service PostgREST (~30s d'indisponibilité). À planifier en heure creuse.

### Étape 3 — Correction des 3 composants anomaliques

Avant staging, corriger les 3 composants qui utilisent l'ancienne architecture :

#### Correction FinanceInvoices.tsx

Option A (recommandée) : Créer une vue `api.v_invoices` dans new arch :
```sql
-- À ajouter dans une migration dédiée
create view api.v_invoices with (security_invoker = true) as
  select
    id, invoice_number, status, total_xaf, paid_xaf,
    issued_at, due_date, ...
  from biz.invoices;
grant select on api.v_invoices to authenticated;
```

Option B : Mapper les colonnes old arch dans le composant :
```typescript
// Mapping public.invoices → colonnes attendues
supabase.from("invoices").select("id, reference as invoice_number, status, total, paid_amount as amount_paid, invoice_date as issued_at, due_date, ...")
```

**Recommandation :** Option A (new arch). Option B est un palliatif pour staging rapide.

#### Correction FinanceEncaissements.tsx

Créer `public.v_invoices` ou `api.v_encaissements` :
```sql
-- Option staging rapide : vue public.v_invoices depuis public.invoices
create or replace view public.v_invoices as
  select
    id,
    reference as invoice_number,
    status,
    total as total_xaf,
    paid_amount as paid_xaf,
    invoice_date as issued_at,
    -- customer_name depuis JOIN public.clients
    ...
  from public.invoices;
```

#### Correction FinanceDepenses.tsx

Vérifier les colonnes de `public.v_depenses` :
```sql
-- Requête de vérification (READ-ONLY)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'v_depenses';
```

---

## 4. Configuration PostgREST Finale (Cible Long Terme)

```toml
[api]
schemas = ["api"]
extra_search_path = ["public", "extensions"]
```

**Pré-requis avant passage à `schemas=["api"]` seul :**
- Créer des vues de compatibilité `api.v_*` pour chaque table `public.*` utilisée par les modules non-Finance
- Lister tous les `supabase.from("table_name")` dans les autres modules (Caisse, MoMo, Ventes, Stock...)
- Tester que chaque module fonctionne via `api.*`

**Estimation :** ~10-15 vues de compatibilité à créer pour couvrir tous les anciens modules.

---

## 5. Vérification de Cohérence PostgREST

Après migration et transition PostgREST, vérifier :

```bash
# Test Finance (api.*)
curl -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  "$SUPABASE_URL/rest/v1/v_dashboard_finance"
# Attendu : 200 (ou 406 si aucune période ouverte)

# Test ancien module (public.*)
curl -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  "$SUPABASE_URL/rest/v1/products?select=id,name&limit=1"
# Attendu : 200

# Test RPC Finance
curl -X POST \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"p_period_id": "UUID_PERIODE_OUVERTE"}' \
  "$SUPABASE_URL/rest/v1/rpc/close_financial_period"
# Attendu : 200 avec checklist JSON
```

---

## 6. Risques Identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|-----------|
| `schemas=["api","public"]` → 404 sur appels directs public.* | Faible | Fort | Maintenir `public` dans schemas |
| RPCs `api.*` non trouvés (PostgREST ne cherche que dans `extra_search_path`) | Modérée | Fort | Vérifier que les fonctions sont dans `api` schema (confirmé par migrations) |
| Transition en production sans staging préalable | Élevée | Critique | Toujours staginer d'abord |
| `v_depenses` colonnes incompatibles | Modérée | Modéré | Vérifier colonnes avant déploiement |
| Tokens JWT expirés pendant migration | Faible | Modéré | Planifier en heure creuse |

---

## 7. Résumé

| Critère | Valeur |
|---------|--------|
| Appels `.from()` / `.rpc()` new arch (non fonctionnels en prod) | 21 |
| Appels `.from()` old arch (fonctionnels partiellement) | 3 |
| Composants à corriger avant staging | 3 |
| Vues de compatibilité à créer (long terme) | ~10-15 |
| Config PostgREST à modifier | 1 (staging + prod) |
| Downtime PostgREST lors de la transition | ~30 secondes |
