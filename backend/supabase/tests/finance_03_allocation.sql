-- Finance test 03 : Allocation de marge vers les réserves
-- Scénario : marge = 20 000 XAF, 6 lignes d'allocation, total = 20 000 XAF
BEGIN;
SELECT plan(4);

-- Setup : période
INSERT INTO biz.financial_periods (id, label, period_type, starts_at, ends_at, status)
VALUES ('00000000-0003-0003-0003-000000000001', 'TEST-03', 'monthly',
        '2026-03-01', '2026-03-31', 'open')
ON CONFLICT (id) DO NOTHING;

-- Setup : réserve de test
INSERT INTO biz.reserves (id, name, reserve_type, balance_xaf, target_xaf)
VALUES ('00000000-0003-0003-0003-000000000010', 'Réserve test 03', 'security', 0, 1000000)
ON CONFLICT (id) DO NOTHING;

-- Setup : règle d'allocation 100% vers cette réserve depuis "manual"
INSERT INTO biz.allocation_rules (id, reserve_id, percentage, source_type, is_active, effective_from)
VALUES ('00000000-0003-0003-0003-000000000020',
        '00000000-0003-0003-0003-000000000010',
        100.00, 'manual', true, '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- Insérer 6 mouvements de réserve de 20 000 XAF / 6 ≈ 3 333 XAF chacun (arrondi entier)
-- On insère directement les reserve_movements pour ce test
DO $$
DECLARE
  i int;
  total_alloc bigint := 0;
BEGIN
  FOR i IN 1..6 LOOP
    INSERT INTO biz.reserve_movements
      (reserve_id, movement_type, amount_xaf, source_type, source_id,
       financial_period_id, description, idempotency_key)
    VALUES
      ('00000000-0003-0003-0003-000000000010', 'allocation',
       CASE WHEN i < 6 THEN 3333 ELSE 3335 END,  -- 5×3333 + 3335 = 20000
       'manual', '00000000-0003-0003-0003-0000000000FF',
       '00000000-0003-0003-0003-000000000001',
       'Allocation test 03 ligne ' || i,
       'test-03-alloc-' || i)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;
END $$;

-- Tests
SELECT ok(
  (SELECT COUNT(*) FROM biz.reserve_movements
   WHERE financial_period_id = '00000000-0003-0003-0003-000000000001'
     AND reserve_id = '00000000-0003-0003-0003-000000000010') = 6,
  '6 lignes d''allocation insérées'
);

SELECT ok(
  (SELECT SUM(amount_xaf) FROM biz.reserve_movements
   WHERE financial_period_id = '00000000-0003-0003-0003-000000000001'
     AND reserve_id = '00000000-0003-0003-0003-000000000010') = 20000,
  'Total allocations = 20 000 XAF'
);

SELECT ok(
  (SELECT balance_xaf FROM biz.reserves
   WHERE id = '00000000-0003-0003-0003-000000000010') = 20000,
  'Balance réserve mise à jour = 20 000 XAF (trigger sync_reserve_balance)'
);

SELECT ok(
  (SELECT COUNT(DISTINCT idempotency_key) FROM biz.reserve_movements
   WHERE financial_period_id = '00000000-0003-0003-0003-000000000001') = 6,
  'Chaque ligne a une clé d''idempotence unique'
);

SELECT * FROM finish();
ROLLBACK;
