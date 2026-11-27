-- Finance test 07 : Idempotence des allocations
-- Scénario : 2 appels avec la même idempotency_key → 1 seule écriture
BEGIN;
SELECT plan(3);

INSERT INTO biz.financial_periods (id, label, period_type, starts_at, ends_at, status)
VALUES ('00000000-0007-0007-0007-000000000001', 'TEST-07', 'monthly',
        '2026-07-01', '2026-07-31', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO biz.reserves (id, name, reserve_type, balance_xaf, target_xaf)
VALUES ('00000000-0007-0007-0007-000000000010', 'Réserve idempotence', 'security', 0, 500000)
ON CONFLICT (id) DO NOTHING;

-- Premier appel
INSERT INTO biz.reserve_movements
  (reserve_id, movement_type, amount_xaf, source_type, source_id,
   financial_period_id, description, idempotency_key)
VALUES
  ('00000000-0007-0007-0007-000000000010', 'allocation', 10000,
   'manual', '00000000-0007-0007-0007-0000000000FF',
   '00000000-0007-0007-0007-000000000001',
   'Allocation idem 07', 'test-07-idem-key-001')
ON CONFLICT (idempotency_key) DO NOTHING;

-- Deuxième appel identique — doit être ignoré par ON CONFLICT
INSERT INTO biz.reserve_movements
  (reserve_id, movement_type, amount_xaf, source_type, source_id,
   financial_period_id, description, idempotency_key)
VALUES
  ('00000000-0007-0007-0007-000000000010', 'allocation', 10000,
   'manual', '00000000-0007-0007-0007-0000000000FF',
   '00000000-0007-0007-0007-000000000001',
   'Allocation idem 07 doublon', 'test-07-idem-key-001')
ON CONFLICT (idempotency_key) DO NOTHING;

-- Tests
SELECT ok(
  (SELECT COUNT(*) FROM biz.reserve_movements
   WHERE idempotency_key = 'test-07-idem-key-001') = 1,
  'Une seule ligne créée malgré 2 appels (idempotence via UNIQUE constraint)'
);

SELECT ok(
  (SELECT balance_xaf FROM biz.reserves
   WHERE id = '00000000-0007-0007-0007-000000000010') = 10000,
  'Balance réserve = 10 000 XAF (non doublée)'
);

SELECT ok(
  (SELECT amount_xaf FROM biz.reserve_movements
   WHERE idempotency_key = 'test-07-idem-key-001') = 10000,
  'Montant unique = 10 000 XAF'
);

SELECT * FROM finish();
ROLLBACK;
