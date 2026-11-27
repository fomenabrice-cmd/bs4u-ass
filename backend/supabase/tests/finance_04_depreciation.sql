-- Finance test 04 : Calcul d'amortissement linéaire
-- Scénario : coût = 100 000 XAF, résiduelle = 4 000, durée = 48 mois
--            dotation / mois = (100000 - 4000) / 48 = 2 000 XAF
BEGIN;
SELECT plan(4);

-- Setup : actif de test
INSERT INTO biz.assets
  (id, name, asset_number, asset_category, acquisition_date,
   acquisition_cost_xaf, useful_life_months, depreciation_method, residual_value_xaf, status)
VALUES
  ('00000000-0004-0004-0004-000000000001',
   'Actif test 04', 'IMM-TEST-000004', 'it_equipment',
   '2026-01-01', 100000, 48, 'linear', 4000, 'active')
ON CONFLICT (id) DO NOTHING;

-- Vérifier la dotation mensuelle attendue
SELECT ok(
  ROUND((100000 - 4000)::numeric / 48) = 2000,
  'Dotation mensuelle = 2 000 XAF ((100 000 - 4 000) / 48)'
);

-- Générer le plan d'amortissement pour cet actif (12 premières lignes)
INSERT INTO biz.asset_depreciation_schedules
  (asset_id, period_number, period_start, period_end, amount_xaf, cumulative_xaf)
SELECT
  '00000000-0004-0004-0004-000000000001',
  gs.n,
  ('2026-01-01'::date + ((gs.n - 1) * interval '1 month'))::date,
  ('2026-01-01'::date + (gs.n * interval '1 month') - interval '1 day')::date,
  2000,
  gs.n * 2000
FROM generate_series(1, 12) AS gs(n)
ON CONFLICT (asset_id, period_number) DO NOTHING;

SELECT ok(
  (SELECT COUNT(*) FROM biz.asset_depreciation_schedules
   WHERE asset_id = '00000000-0004-0004-0004-000000000001') = 12,
  '12 lignes du plan générées'
);

SELECT ok(
  (SELECT amount_xaf FROM biz.asset_depreciation_schedules
   WHERE asset_id = '00000000-0004-0004-0004-000000000001'
   AND period_number = 1) = 2000,
  'Première dotation = 2 000 XAF'
);

SELECT ok(
  (SELECT cumulative_xaf FROM biz.asset_depreciation_schedules
   WHERE asset_id = '00000000-0004-0004-0004-000000000001'
   AND period_number = 12) = 24000,
  'Cumulé après 12 mois = 24 000 XAF'
);

SELECT * FROM finish();
ROLLBACK;
