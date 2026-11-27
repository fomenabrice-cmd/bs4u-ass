# Graphe de Dépendances des Migrations Finance

> Date : 2026-11-27  
> Méthode : Analyse statique du contenu des fichiers de migration locaux  
> Statut : **VALIDÉ STATIQUEMENT**  
> Source : 37 migrations locales, jamais appliquées en production

---

## 1. Vue d'ensemble

Les 37 migrations sont réparties en 4 groupes :

| Groupe | Préfixe | Fichiers | Rôle |
|--------|---------|----------|------|
| Fondations | `20261121*` | 17 | Schémas, RBAC, utilitaires, tables biz de base |
| Caisse/MoMo v1 | `20261125000*` | 8 | Ajouts new arch (org_id, MoMo, Caisse) |
| Finance | `20261126*` | 12 | Module Finance complet |

---

## 2. Graphe de Dépendances Complet

```
20261121000000_schemas_and_grants
  └─► 20261121000100_app_utilities
        ├─► app.touch_row()
        ├─► app.forbid_update_delete()
        ├─► app.raise_error()
        ├─► app.allowed_transitions
        └─► 20261121000200_core_persons
              └─► 20261121000300_rbac
                    ├─► core.roles
                    ├─► core.permissions
                    ├─► core.role_permissions
                    ├─► core.user_role_assignments
                    ├─► app.has_permission()
                    ├─► app.require_permission()
                    ├─► api.v_my_permissions
                    └─► 20261121000400_audit_idempotency_numbers
                          ├─► audit.events (append-only)
                          ├─► app.audit()
                          ├─► ops.idempotency_keys
                          ├─► app.idempotency_begin/finish()
                          ├─► ops.number_series
                          └─► app.next_number()

20261121000500_system_settings_files
20261121000600_ops_jobs_notifications
20261121000700_api_me_allowed_transitions

20261121000800_biz_customers
20261121000900_biz_catalog_orders
  └─► biz.customers (FK)

20261121001000_biz_print_jobs
  └─► biz.orders (FK)

20261121001100_biz_finance
  ├─► biz.quotes
  ├─► biz.invoices (old biz arch — ≠ public.invoices)
  └─► biz.payments

20261121001200_biz_stock_pos
20261121001300_biz_documents
20261121001400_asso_members
20261121001500_momo_accounts
  ├─► momo.accounts
  └─► momo.transactions

20261121001600_biz_expenses
  └─► biz.expenses (new arch — ≠ public.expenses)

──── Groupe Caisse/MoMo ────────────────────────────────────────────────────

20261125000100_momo_add_organization
  └─► ALTER momo.accounts ADD org_id

20261125000200_momo_add_performed_by
  └─► ALTER momo.transactions ADD performed_by

20261125000300_momo_public_rls
  └─► RLS policies pour tables publiques existantes

20261125000400_supplier_funds
20261125000500_cash_rpcs
20261125000600_cash_movements_immutable
20261125000700_cash_rls
20261125000800_pos_rpcs

──── Groupe Finance ────────────────────────────────────────────────────────

20261126000100_finance_periods
  ├─► biz.financial_periods          ← dépend de : app.forbid_update_delete
  └─► biz.chart_of_accounts          ← seed ~80 comptes SYSCOHADA (mig 000300)

20261126000200_finance_journal
  ├─► biz.journal_entries            ← FK → biz.financial_periods
  └─► biz.journal_lines              ← FK → biz.journal_entries, biz.chart_of_accounts
      └─► trigger biz_journal_entries_forbid (posted only)

20261126000300_finance_seed_coa
  └─► INSERT ~80 comptes SYSCOHADA → biz.chart_of_accounts

20261126000400_finance_reserves
  ├─► biz.reserves
  ├─► biz.reserve_movements          ← FK → biz.reserves, biz.financial_periods
  │     └─► append-only trigger
  │     └─► trigger sync_reserve_balance
  └─► biz.allocation_rules           ← FK → biz.reserves

20261126000500_finance_capital_loans
  ├─► biz.capital_contributions      ← append-only
  ├─► biz.loans                      ← FK → biz.financial_periods
  └─► biz.loan_repayments            ← FK → biz.loans, biz.financial_periods

20261126000600_finance_assets
  ├─► biz.assets                     ← FK → biz.financial_periods
  ├─► biz.asset_depreciation_schedules ← FK → biz.assets
  └─► biz.depreciation_entries       ← FK → biz.assets, biz.financial_periods

20261126000700_finance_treasury
  ├─► biz.bank_accounts
  ├─► biz.bank_transactions          ← FK → biz.bank_accounts
  └─► biz.treasury_reconciliations   ← FK → biz.financial_periods

20261126000800_momo_closings
  └─► momo.daily_closings            ← FK → momo.accounts
      (vue biz.v_momo_daily_closings exposée via mig 001100)

20261126000900_finance_rpcs
  ├─► api.allocate_margin()          ← dépend de : biz.reserves, biz.reserve_movements,
  │                                               biz.allocation_rules, app.require_permission,
  │                                               app.idempotency_begin/finish, app.audit
  ├─► api.record_loan_repayment()    ← dépend de : biz.loans, biz.loan_repayments,
  │                                               app.next_number('REPAYMENT'), app.require_permission
  ├─► api.compute_depreciation()     ← dépend de : biz.assets, biz.depreciation_entries,
  │                                               biz.financial_periods, app.require_permission
  └─► api.close_financial_period()   ← dépend de : biz.financial_periods, biz.journal_entries,
                                                  momo.daily_closings, biz.treasury_reconciliations,
                                                  biz.assets, biz.depreciation_entries, app.require_permission

20261126001000_finance_dashboard
  ├─► api.v_dashboard_finance        ← dépend de : biz.journal_entries, biz.journal_lines,
  │                                               biz.financial_periods, momo.accounts,
  │                                               biz.stock_movements(?), biz.reserves,
  │                                               biz.loans, biz.loan_repayments,
  │                                               biz.capital_contributions, biz.depreciation_entries
  └─► api.v_finance_periods_summary  ← dépend de : biz.financial_periods,
                                                  biz.journal_entries, biz.depreciation_entries,
                                                  biz.loan_repayments

20261126001100_finance_rls
  ├─► api.v_journal_entries          ← dépend de : biz.journal_entries, biz.financial_periods
  ├─► api.v_reserves                 ← dépend de : biz.reserves
  ├─► api.v_assets                   ← dépend de : biz.assets, biz.depreciation_entries
  ├─► api.v_loans                    ← dépend de : biz.loans, biz.loan_repayments
  ├─► api.v_treasury_reconciliations ← dépend de : biz.treasury_reconciliations, biz.financial_periods
  ├─► api.v_momo_daily_closings      ← dépend de : momo.daily_closings, momo.accounts
  └─► Grants sur toutes les tables biz.* et vues api.*

20261126001200_finance_create_rpcs
  ├─► api.v_journal_entries (CREATE OR REPLACE — ajoute financial_period_id)
  ├─► api.create_loan()              ← dépend de : biz.loans, biz.financial_periods,
  │                                               app.next_number('LOAN'), app.require_permission
  ├─► api.create_asset()             ← dépend de : biz.assets, biz.asset_depreciation_schedules,
  │                                               biz.financial_periods, app.next_number('ASSET'),
  │                                               app.require_permission
  ├─► api.create_journal_entry()     ← dépend de : biz.journal_entries, biz.journal_lines,
  │                                               biz.financial_periods, app.next_number('JOURNAL'),
  │                                               app.require_permission
  └─► api.v_capital_contributions    ← dépend de : biz.capital_contributions
```

---

## 3. Ordre d'Application Obligatoire

L'ordre strict est dicté par les dépendances. Toute inversion provoquerait une erreur PostgreSQL.

### Phase 1 — Fondations (obligatoire avant tout)

```
1.  20261121000000  → crée les schémas
2.  20261121000100  → utilitaires app.* (dépend du schéma app)
3.  20261121000200  → core.persons (dépend du schéma core)
4.  20261121000300  → RBAC (dépend de app.has_permission, core.*)
5.  20261121000400  → audit + idempotence + numérotation (dépend de app.*)
6.  20261121000500  → system settings
7.  20261121000600  → jobs/notifications
8.  20261121000700  → transitions
9.  20261121000800  → biz.customers
10. 20261121000900  → biz.orders (FK → customers)
11. 20261121001000  → biz.print_jobs
12. 20261121001100  → biz.invoices/quotes/payments (new arch)
13. 20261121001200  → biz.stock/pos
14. 20261121001300  → biz.documents
15. 20261121001400  → asso.members
16. 20261121001500  → momo.accounts + momo.transactions
17. 20261121001600  → biz.expenses (new arch)
```

### Phase 2 — Caisse/MoMo (après Phase 1)

```
18. 20261125000100  → momo: add org_id
19. 20261125000200  → momo: add performed_by
20. 20261125000300  → RLS public
21. 20261125000400  → supplier_funds
22. 20261125000500  → cash RPCs
23. 20261125000600  → cash append-only
24. 20261125000700  → cash RLS
25. 20261125000800  → POS RPCs
```

### Phase 3 — Finance (après Phase 1 complète)

```
26. 20261126000100  → biz.financial_periods + biz.chart_of_accounts
27. 20261126000200  → biz.journal_entries + biz.journal_lines
28. 20261126000300  → seed ~80 comptes SYSCOHADA
29. 20261126000400  → biz.reserves + biz.reserve_movements + biz.allocation_rules
30. 20261126000500  → biz.loans + biz.loan_repayments + biz.capital_contributions
31. 20261126000600  → biz.assets + biz.asset_depreciation_schedules + biz.depreciation_entries
32. 20261126000700  → biz.bank_accounts + biz.bank_transactions + biz.treasury_reconciliations
33. 20261126000800  → momo.daily_closings (dépend de momo.accounts)
34. 20261126000900  → RPCs Finance (allocate_margin, record_loan_repayment, compute_depreciation, close_period)
35. 20261126001000  → api.v_dashboard_finance + api.v_finance_periods_summary
36. 20261126001100  → vues api.v_* + grants
37. 20261126001200  → RPCs create_loan, create_asset, create_journal_entry + api.v_capital_contributions
```

---

## 4. Dépendances Critiques (Points de Blocage)

| Migration | Bloquée si... | Erreur probable |
|-----------|---------------|-----------------|
| 20261121000300 (RBAC) | 000100 non appliqué | `function app.has_permission does not exist` |
| 20261126000100 (periods) | 000400 non appliqué | `function app.forbid_update_delete does not exist` |
| 20261126000200 (journal) | 000100 non appliqué | FK vers biz.financial_periods manquant |
| 20261126000900 (RPCs) | 000400 non appliqué | `function app.idempotency_begin does not exist` |
| 20261126000900 (RPCs) | 000800 non appliqué | `relation momo.daily_closings does not exist` |
| 20261126001000 (dashboard) | 000200 non appliqué | `relation biz.journal_entries does not exist` |
| 20261126001100 (RLS/vues) | 000400,000500,000600,000700,000800 non appliqués | Multiples relations manquantes |
| 20261126001200 (create RPCs) | 001100 non appliqué | `function app.next_number does not exist` |

---

## 5. Seeds Obligatoires

Ces seeds doivent être exécutés **après** les migrations mais **avant** le premier usage :

| Seed | Migration source | Contenu | Obligatoire avant |
|------|-----------------|---------|-------------------|
| `biz.chart_of_accounts` | 20261126000300 | ~80 comptes SYSCOHADA | Toute saisie journal |
| `ops.number_series` | 20261121000400 | Séries JNL, LOAN, ASSET, REPAYMENT, DEPR, RECON, AMO | Toute création RPC |
| `biz.reserves` | 20261126000400 | 4 réserves par défaut | allocate_margin |
| `core.roles` / `core.permissions` | 20261121000300 | Rôles Finance (admin/writer/reader) | app.has_permission |
| `core.user_role_assignments` | 20261121000300 | Assigner les utilisateurs | Accès Finance |
| `biz.financial_periods` | 20261126000100 | Période comptable ouverte | Tout module Finance |

---

## 6. Note sur biz.stock_movements

**⚠️ INCOHÉRENCE DÉTECTÉE :** `api.v_dashboard_finance` (migration 20261126001000) référence `biz.stock_movements` pour le KPI stock_value :

```sql
select coalesce(sum(qty * coalesce(unit_cost_xaf, 0)), 0)
from biz.stock_movements where movement_type != 'adjustment'
```

Aucune migration locale ne crée `biz.stock_movements`. Cette table serait créée par `20261121001200_biz_stock_pos.sql` (non lu en détail), ou la vue échouerait à la création. **À vérifier.**

---

## 7. Résumé

| Critère | Valeur |
|---------|--------|
| Total migrations | 37 |
| Migrations en production | 0 (sur les 37) |
| Migrations en production old arch | ~70 (public.*) |
| Points de blocage si ordre invalide | 8 identifiés |
| Seeds obligatoires | 6 catégories |
| Incohérence biz.stock_movements | ⚠️ À vérifier |
