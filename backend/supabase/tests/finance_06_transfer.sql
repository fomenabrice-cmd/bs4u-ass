-- Finance test 06 : Transfert interne Caisse → MoMo
-- Scénario : Caisse -50 000, MoMo +50 000, revenu = 0 (transfert neutre)
BEGIN;
SELECT plan(4);

INSERT INTO biz.financial_periods (id, label, period_type, starts_at, ends_at, status)
VALUES ('00000000-0006-0006-0006-000000000001', 'TEST-06', 'monthly',
        '2026-06-01', '2026-06-30', 'open')
ON CONFLICT (id) DO NOTHING;

-- Écriture de transfert : débit 531 (MoMo), crédit 511 (Caisse) — aucun compte de produit
INSERT INTO biz.journal_entries
  (id, entry_date, description, status, financial_period_id, entry_number, source_type, idempotency_key)
VALUES
  ('00000000-0006-0006-0006-000000000010',
   '2026-06-10', 'Transfert Caisse vers MoMo', 'draft',
   '00000000-0006-0006-0006-000000000001',
   'JNL-TEST-060001', 'transfer', 'test-06-transfer-entry')
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0006-0006-0006-000000000010', '531', 50000, 0, 'Approvisionnement MoMo'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010' AND account_code = '531'
);
INSERT INTO biz.journal_lines (journal_entry_id, account_code, debit_xaf, credit_xaf, description)
SELECT '00000000-0006-0006-0006-000000000010', '511', 0, 50000, 'Sortie caisse'
WHERE NOT EXISTS (
  SELECT 1 FROM biz.journal_lines
  WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010' AND account_code = '511'
);

-- Tests
SELECT ok(
  (SELECT SUM(debit_xaf) FROM biz.journal_lines
   WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010')
  =
  (SELECT SUM(credit_xaf) FROM biz.journal_lines
   WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010'),
  'Écriture équilibrée : total débit = total crédit = 50 000'
);

SELECT ok(
  (SELECT SUM(credit_xaf) FROM biz.journal_lines jl
   JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
   WHERE je.financial_period_id = '00000000-0006-0006-0006-000000000001'
     AND jl.account_code LIKE '7%') IS NULL
  OR
  (SELECT SUM(credit_xaf) FROM biz.journal_lines jl
   JOIN biz.journal_entries je ON je.id = jl.journal_entry_id
   WHERE je.financial_period_id = '00000000-0006-0006-0006-000000000001'
     AND jl.account_code LIKE '7%') = 0,
  'Aucun produit (classe 7) enregistré : revenu du transfert = 0'
);

SELECT ok(
  (SELECT debit_xaf FROM biz.journal_lines
   WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010'
     AND account_code = '531') = 50000,
  'MoMo (531) débité de 50 000 XAF'
);

SELECT ok(
  (SELECT credit_xaf FROM biz.journal_lines
   WHERE journal_entry_id = '00000000-0006-0006-0006-000000000010'
     AND account_code = '511') = 50000,
  'Caisse (511) créditée de 50 000 XAF'
);

SELECT * FROM finish();
ROLLBACK;
