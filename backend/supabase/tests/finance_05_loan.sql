-- Finance test 05 : Remboursement d'emprunt
-- Scénario : emprunt = 1 000 000 XAF, remboursement = 105 000 XAF
--            principal = 100 000, intérêts = 5 000, capital restant = 900 000
BEGIN;
SELECT plan(5);

-- Setup : emprunt de test
INSERT INTO biz.financial_periods (id, label, period_type, starts_at, ends_at, status)
VALUES ('00000000-0005-0005-0005-000000000001', 'TEST-05', 'monthly',
        '2026-05-01', '2026-05-31', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO biz.loans
  (id, loan_number, lender, loan_type, principal_xaf, outstanding_xaf,
   interest_rate_pct, start_date, term_months, status)
VALUES
  ('00000000-0005-0005-0005-000000000010',
   'EMR-TEST-000005', 'Banque Test', 'bank_loan',
   1000000, 1000000, 6.00, '2026-01-01', 60, 'active')
ON CONFLICT (id) DO NOTHING;

-- Remboursement : 100 000 principal + 5 000 intérêts = 105 000 total
INSERT INTO biz.loan_repayments
  (id, loan_id, repayment_number, total_xaf, principal_xaf, interest_xaf, fees_xaf,
   payment_method, paid_at, financial_period_id, idempotency_key)
VALUES
  ('00000000-0005-0005-0005-000000000020',
   '00000000-0005-0005-0005-000000000010',
   'RBR-TEST-000005', 105000, 100000, 5000, 0,
   'transfer', '2026-05-15', '00000000-0005-0005-0005-000000000001',
   'test-05-repayment-01')
ON CONFLICT (idempotency_key) DO NOTHING;

-- Mettre à jour l'encours manuellement (en prod, le RPC le fait)
UPDATE biz.loans
SET outstanding_xaf = outstanding_xaf - 100000
WHERE id = '00000000-0005-0005-0005-000000000010'
  AND outstanding_xaf = 1000000;

-- Tests
SELECT ok(
  (SELECT total_xaf FROM biz.loan_repayments
   WHERE idempotency_key = 'test-05-repayment-01') = 105000,
  'Total remboursement = 105 000 XAF'
);

SELECT ok(
  (SELECT principal_xaf FROM biz.loan_repayments
   WHERE idempotency_key = 'test-05-repayment-01') = 100000,
  'Capital remboursé = 100 000 XAF'
);

SELECT ok(
  (SELECT interest_xaf FROM biz.loan_repayments
   WHERE idempotency_key = 'test-05-repayment-01') = 5000,
  'Intérêts = 5 000 XAF'
);

SELECT ok(
  (SELECT principal_xaf + interest_xaf + fees_xaf FROM biz.loan_repayments
   WHERE idempotency_key = 'test-05-repayment-01') = 105000,
  'Contrainte somme : principal + intérêts + frais = total'
);

SELECT ok(
  (SELECT outstanding_xaf FROM biz.loans
   WHERE id = '00000000-0005-0005-0005-000000000010') = 900000,
  'Capital restant dû = 900 000 XAF'
);

SELECT * FROM finish();
ROLLBACK;
