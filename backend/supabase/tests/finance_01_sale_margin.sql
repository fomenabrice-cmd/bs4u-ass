-- Finance test 01 : Marge sur vente
-- Scénario : CA = 100 000 XAF, coût stock = 80 000 XAF → marge = 20 000 XAF
BEGIN;
SELECT plan(4);

-- Setup : période de test
INSERT INTO biz.financial_periods (id, label, period_type, starts_at, ends_at, status)
VALUES ('00000000-0001-0001-0001-000000000001', 'TEST-01', 'monthly',
        '2026-01-01', '2026-01-31', 'open')
ON CONFLICT (id) DO NOTHING;

-- Écriture comptable : vente 100 000 XAF
INSERT INTO biz.journal_entries (id, entry_date, description, status, financial_period_id,
                                  entry_number, source_type, idempotency_key)
VALUES ('00000000-0001-0001-0001-000000000010', '2026-01-15',
        'Vente produit test', 'draft',
        '00000000-0001-0001-0001-000000000001',
        'JNL-TEST-000001', 'sale', 'test-01-sale-entry')
ON CONFLICT (idempotency_key) DO NOTHING;

-- Lignes : débit 511 (caisse), crédit 701 (vente)
INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0001-0001-0001-000000000010', '511', 100000, 0, 'Encaissement'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0001-0001-0001-000000000010' AND account_code = '511'
);
INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0001-0001-0001-000000000010', '701', 0, 100000, 'Ventes produits'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0001-0001-0001-000000000010' AND account_code = '701'
);

-- Écriture coût de stock 80 000 XAF
INSERT INTO biz.journal_entries (id, entry_date, description, status, financial_period_id,
                                  entry_number, source_type, idempotency_key)
VALUES ('00000000-0001-0001-0001-000000000011', '2026-01-15',
        'Sortie stock test', 'draft',
        '00000000-0001-0001-0001-000000000001',
        'JNL-TEST-000002', 'sale', 'test-01-cogs-entry')
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0001-0001-0001-000000000011', '603', 80000, 0, 'Coût stock vendu'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0001-0001-0001-000000000011' AND account_code = '603'
);
INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0001-0001-0001-000000000011', '311', 0, 80000, 'Sortie stock'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0001-0001-0001-000000000011' AND account_code = '311'
);

-- Tests
SELECT ok(
  (SELECT SUM(credit_xaf) FROM biz.journal_lines jl
   JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
   WHERE je.financial_period_id = '00000000-0001-0001-0001-000000000001'
     AND jl.account_code LIKE '7%') = 100000,
  'Produits classe 7 = 100 000 XAF'
);

SELECT ok(
  (SELECT SUM(debit_xaf) FROM biz.journal_lines jl
   JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
   WHERE je.financial_period_id = '00000000-0001-0001-0001-000000000001'
     AND jl.account_code LIKE '6%') = 80000,
  'Charges classe 6 = 80 000 XAF'
);

SELECT ok(
  (
    (SELECT COALESCE(SUM(credit_xaf),0) FROM biz.journal_lines jl
     JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.financial_period_id = '00000000-0001-0001-0001-000000000001'
       AND jl.account_code LIKE '7%')
    -
    (SELECT COALESCE(SUM(debit_xaf),0) FROM biz.journal_lines jl
     JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.financial_period_id = '00000000-0001-0001-0001-000000000001'
       AND jl.account_code LIKE '6%')
  ) = 20000,
  'Marge brute = 20 000 XAF (100k - 80k)'
);

SELECT ok(
  (SELECT COUNT(*) FROM biz.journal_entries
   WHERE financial_period_id = '00000000-0001-0001-0001-000000000001') = 2,
  'Exactement 2 écritures pour la période test-01'
);

SELECT * FROM finish();
ROLLBACK;
