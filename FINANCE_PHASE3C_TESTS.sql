-- ============================================================
-- FINANCE_PHASE3C_TESTS
-- 20 scénarios de test exécutables
-- Phase 3C — Généré le 2026-11-27
--
-- Prérequis :
--   - Supabase preview (ou environnement de développement local)
--   - Migrations 053B_FINAL + 054_FINAL appliquées
--   - Données de test créées (voir SECTION 0)
--
-- Chaque test est dans une transaction annulée (ROLLBACK)
-- sauf indication contraire, pour préserver l'état de test.
-- ============================================================

-- ============================================================
-- SECTION 0 : Données de test
-- À exécuter une seule fois sur l'environnement de test
-- ============================================================

DO $$
DECLARE
  v_org_a uuid := '00000000-0000-0000-0000-000000000001';
  v_org_b uuid := '00000000-0000-0000-0000-000000000002';
  v_user_a uuid := '00000000-0000-0000-0000-000000000011';
  v_user_b uuid := '00000000-0000-0000-0000-000000000012';
  v_period_id uuid;
  v_account_id uuid;
BEGIN
  -- Vérifier si les données de test existent déjà
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_a) THEN
    RAISE NOTICE 'Test data already exists, skipping setup';
    RETURN;
  END IF;

  -- Organisations de test
  INSERT INTO public.organizations(id, name, slug, type, country)
  VALUES
    (v_org_a, 'Org Test A', 'org-test-a', 'test', 'CM'),
    (v_org_b, 'Org Test B', 'org-test-b', 'test', 'CM')
  ON CONFLICT (id) DO NOTHING;

  -- Période financière ouverte pour org A
  INSERT INTO public.financial_periods(id, organization_id, label, period_type, starts_at, ends_at, status)
  VALUES (
    gen_random_uuid(), v_org_a, 'Exercice 2026', 'annual',
    '2026-01-01', '2026-12-31', 'open'
  )
  ON CONFLICT DO NOTHING;

  -- Période fermée pour org A (pour test T17)
  INSERT INTO public.financial_periods(id, organization_id, label, period_type, starts_at, ends_at, status)
  VALUES (
    gen_random_uuid(), v_org_a, 'Exercice 2025', 'annual',
    '2025-01-01', '2025-12-31', 'closed'
  )
  ON CONFLICT DO NOTHING;

  -- Compte du plan comptable pour org A
  INSERT INTO public.chart_of_accounts(id, organization_id, code, name, type, is_active)
  VALUES
    ('00000000-0000-0000-0001-000000000001'::uuid, v_org_a, '5110', 'Caisse principale', 'asset', true),
    ('00000000-0000-0000-0001-000000000002'::uuid, v_org_a, '1010', 'Capital social', 'equity', true),
    ('00000000-0000-0000-0001-000000000003'::uuid, v_org_a, '6111', 'Fournitures', 'expense', true),
    ('00000000-0000-0000-0002-000000000001'::uuid, v_org_b, '5110', 'Caisse B', 'asset', true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Test data created successfully';
END;
$$;

-- ============================================================
-- TEST 1 : P0 — Helpers non appelables par rôle non autorisé
-- Vérifie que PUBLIC ne peut plus appeler get_my_org_id()
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'TEST 1: Vérification REVOKE PUBLIC sur get_my_org_id';
  -- Vérifier que PUBLIC n'a plus le grant
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'get_my_org_id'
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE WARNING 'ÉCHEC T1 : get_my_org_id encore granted à PUBLIC';
  ELSE
    RAISE NOTICE 'SUCCÈS T1 : get_my_org_id REVOKE PUBLIC confirmé';
  END IF;
END;
$$;

-- ============================================================
-- TEST 2 : P0 — set_momo_capital non accessible à anon
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'TEST 2: Vérification REVOKE PUBLIC sur set_momo_capital';
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'set_momo_capital'
      AND grantee = 'PUBLIC'
  ) THEN
    RAISE WARNING 'ÉCHEC T2 : set_momo_capital encore granted à PUBLIC';
  ELSE
    RAISE NOTICE 'SUCCÈS T2 : set_momo_capital REVOKE PUBLIC confirmé';
  END IF;
END;
$$;

-- ============================================================
-- TEST 3 : P1 — Idempotence record_loan_repayment
-- Deux appels avec la même clé retournent le même ID
-- ============================================================

DO $$
DECLARE
  v_loan_id uuid;
  v_rep1_id uuid;
  v_rep2_id uuid;
  v_key text := 'test-idem-key-' || gen_random_uuid()::text;
BEGIN
  RAISE NOTICE 'TEST 3: Idempotence record_loan_repayment';

  -- Créer un prêt de test (org A, service_role bypass RLS)
  INSERT INTO public.loans(organization_id, lender_name, principal_xaf, outstanding_principal_xaf, start_date)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Banque Test', 1000000, 1000000, CURRENT_DATE)
  RETURNING id INTO v_loan_id;

  -- Simuler l'appel RPC avec JWT org A
  -- (en test direct, on utilise service_role qui bypass RLS)
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated","user_metadata":{"org_id":"00000000-0000-0000-0000-000000000001"}}';

  -- Premier appel
  SELECT record_loan_repayment(v_loan_id, 100000, 80000, 15000, 5000, CURRENT_DATE, 'Test', v_key)
  INTO v_rep1_id;

  -- Deuxième appel avec même clé
  SELECT record_loan_repayment(v_loan_id, 100000, 80000, 15000, 5000, CURRENT_DATE, 'Test', v_key)
  INTO v_rep2_id;

  IF v_rep1_id = v_rep2_id THEN
    RAISE NOTICE 'SUCCÈS T3 : IDs identiques % = %', v_rep1_id, v_rep2_id;
  ELSE
    RAISE WARNING 'ÉCHEC T3 : IDs différents % != %', v_rep1_id, v_rep2_id;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 4 : P1 — Remboursement > outstanding rejeté
-- ============================================================

DO $$
DECLARE
  v_loan_id uuid;
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 4: Remboursement > outstanding rejeté';

  INSERT INTO public.loans(organization_id, lender_name, principal_xaf, outstanding_principal_xaf, start_date)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Banque Test', 100000, 50000, CURRENT_DATE)
  RETURNING id INTO v_loan_id;

  BEGIN
    PERFORM record_loan_repayment(v_loan_id, 60000, 60000, 0, 0, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%exceeds outstanding%' THEN
      RAISE NOTICE 'SUCCÈS T4 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T4 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T4 : Aucune exception levée pour remboursement > outstanding';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 5 : P1 — Prêt avec statut non-active rejeté
-- ============================================================

DO $$
DECLARE
  v_loan_id uuid;
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 5: Remboursement sur prêt paid_off rejeté';

  INSERT INTO public.loans(organization_id, lender_name, principal_xaf, outstanding_principal_xaf, start_date, status)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Banque Test', 100000, 0, CURRENT_DATE, 'paid_off')
  RETURNING id INTO v_loan_id;

  BEGIN
    PERFORM record_loan_repayment(v_loan_id, 10000, 10000, 0, 0, CURRENT_DATE);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%not active%' THEN
      RAISE NOTICE 'SUCCÈS T5 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T5 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T5 : Aucune exception levée pour prêt paid_off';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 6 : P1 — INSERT direct reserve_movements bloqué
-- ============================================================

DO $$
DECLARE
  v_reserve_id uuid;
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 6: INSERT direct sur reserve_movements bloqué par RLS';

  -- Créer réserve de test
  INSERT INTO public.reserves(organization_id, name, reserve_type)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Réserve Test', 'legal')
  RETURNING id INTO v_reserve_id;

  -- Simuler rôle authenticated
  SET LOCAL role TO 'authenticated';
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}';

  BEGIN
    INSERT INTO public.reserve_movements(reserve_id, movement_type, amount_xaf, movement_date, reason)
    VALUES (v_reserve_id, 'allocation', 50000, CURRENT_DATE, 'Test direct');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%violates%' THEN
      RAISE NOTICE 'SUCCÈS T6 : INSERT direct bloqué — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T6 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T6 : INSERT direct non bloqué';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 7 : P1 — Solde réserve insuffisant rejeté
-- ============================================================

DO $$
DECLARE
  v_reserve_id uuid;
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 7: Usage réserve > solde rejeté';

  INSERT INTO public.reserves(organization_id, name, reserve_type, current_balance_xaf)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Réserve Test', 'legal', 10000)
  RETURNING id INTO v_reserve_id;

  BEGIN
    PERFORM create_reserve_movement(v_reserve_id, 'usage', 50000, CURRENT_DATE, 'Test dépassement');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Insufficient reserve balance%' THEN
      RAISE NOTICE 'SUCCÈS T7 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T7 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T7 : Aucune exception pour usage > solde';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 8 : P2 — Contrainte UNIQUE sur asset_depreciation_schedules
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE 'TEST 8: Contrainte UNIQUE (asset_id, period_number)';

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.asset_depreciation_schedules'::regclass
      AND contype = 'u'
      AND conname = 'ads_asset_period_unique'
  ) THEN
    RAISE NOTICE 'SUCCÈS T8 : Contrainte ads_asset_period_unique présente';
  ELSE
    RAISE WARNING 'ÉCHEC T8 : Contrainte ads_asset_period_unique ABSENTE';
  END IF;
END;
$$;

-- ============================================================
-- TEST 9 : P2 — compute_depreciation SUM = purchase_price - residual
-- ============================================================

DO $$
DECLARE
  v_asset_id uuid;
  v_total bigint;
  v_expected bigint := 1000000;  -- 1000000 - 0
BEGIN
  RAISE NOTICE 'TEST 9: SUM amortissements = valeur amortissable';

  SELECT create_asset(
    'Ordinateur Test', 'informatique', 1000000, 36,
    '2026-01-01', 0
  ) INTO v_asset_id;

  PERFORM compute_depreciation(v_asset_id);

  SELECT SUM(amount_xaf) INTO v_total
  FROM public.asset_depreciation_schedules
  WHERE asset_id = v_asset_id;

  IF v_total = v_expected THEN
    RAISE NOTICE 'SUCCÈS T9 : SUM = % XAF (attendu %)', v_total, v_expected;
  ELSE
    RAISE WARNING 'ÉCHEC T9 : SUM = % XAF (attendu %)', v_total, v_expected;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 10 : P2 — compute_depreciation préserve les posted
-- ============================================================

DO $$
DECLARE
  v_asset_id uuid;
  v_posted_count integer;
  v_draft_count integer;
BEGIN
  RAISE NOTICE 'TEST 10: compute_depreciation préserve les periods posted';

  SELECT create_asset('Véhicule Test', 'vehicule', 3600000, 36, '2026-01-01', 0)
  INTO v_asset_id;

  -- Premier calcul
  PERFORM compute_depreciation(v_asset_id);

  -- Simuler quelques périodes postées
  UPDATE public.asset_depreciation_schedules
  SET status = 'posted'
  WHERE asset_id = v_asset_id AND period_number <= 3;

  -- Recalcul
  PERFORM compute_depreciation(v_asset_id);

  SELECT COUNT(*) INTO v_posted_count
  FROM public.asset_depreciation_schedules
  WHERE asset_id = v_asset_id AND status = 'posted';

  SELECT COUNT(*) INTO v_draft_count
  FROM public.asset_depreciation_schedules
  WHERE asset_id = v_asset_id AND status = 'draft';

  IF v_posted_count = 3 AND v_draft_count = 33 THEN
    RAISE NOTICE 'SUCCÈS T10 : % posted + % draft (attendu 3 + 33)', v_posted_count, v_draft_count;
  ELSE
    RAISE WARNING 'ÉCHEC T10 : % posted + % draft (attendu 3 + 33)', v_posted_count, v_draft_count;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 11 : P3 — create_journal_entry < 2 lignes rejeté
-- ============================================================

DO $$
DECLARE
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 11: Écriture avec 1 seule ligne rejetée';

  BEGIN
    PERFORM create_journal_entry(
      CURRENT_DATE,
      'Test une ligne',
      '[{"account_id":"00000000-0000-0000-0001-000000000001","debit":1000,"credit":1000}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%at least 2 lines%' THEN
      RAISE NOTICE 'SUCCÈS T11 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T11 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T11 : Écriture à 1 ligne non rejetée';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 12 : P3 — create_journal_entry tableau vide rejeté
-- ============================================================

DO $$
DECLARE
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 12: Écriture avec tableau vide rejetée';

  BEGIN
    PERFORM create_journal_entry(CURRENT_DATE, 'Test vide', '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%at least 2 lines%' THEN
      RAISE NOTICE 'SUCCÈS T12 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T12 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T12 : Tableau vide non rejeté';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 13 : P3 — Écriture déséquilibrée rejetée (exact, sans ROUND)
-- Différence exacte (non arrondie)
-- ============================================================

DO $$
DECLARE
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 13: Écriture déséquilibrée rejetée (exact numeric)';

  BEGIN
    PERFORM create_journal_entry(
      CURRENT_DATE,
      'Test déséquilibre',
      '[
        {"account_id":"00000000-0000-0000-0001-000000000001","debit":1000.1,"credit":0,"description":"Débit"},
        {"account_id":"00000000-0000-0000-0001-000000000002","debit":0,"credit":1000.0,"description":"Crédit"}
      ]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Unbalanced entry%' THEN
      RAISE NOTICE 'SUCCÈS T13 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T13 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T13 : Écriture déséquilibrée non rejetée';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 14 : P3 — account_id autre org rejeté
-- ============================================================

DO $$
DECLARE
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 14: account_id appartenant à org B rejeté pour user org A';

  -- account B : '00000000-0000-0000-0002-000000000001' appartient à org B
  -- Simuler JWT org A
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}';

  BEGIN
    PERFORM create_journal_entry(
      CURRENT_DATE,
      'Test compte autre org',
      '[
        {"account_id":"00000000-0000-0000-0001-000000000001","debit":1000,"credit":0},
        {"account_id":"00000000-0000-0000-0002-000000000001","debit":0,"credit":1000}
      ]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Invalid or inactive account_id%' THEN
      RAISE NOTICE 'SUCCÈS T14 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T14 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T14 : Compte autre org non rejeté';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 15 : P3 — Écriture sur période clôturée rejetée
-- ============================================================

DO $$
DECLARE
  v_error_caught boolean := false;
BEGIN
  RAISE NOTICE 'TEST 15: Écriture sur période clôturée rejetée';

  BEGIN
    PERFORM create_journal_entry(
      '2025-06-15'::date,  -- date dans la période 2025 (closed)
      'Test période clôturée',
      '[
        {"account_id":"00000000-0000-0000-0001-000000000001","debit":1000,"credit":0},
        {"account_id":"00000000-0000-0000-0001-000000000002","debit":0,"credit":1000}
      ]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%No open financial period%' THEN
      RAISE NOTICE 'SUCCÈS T15 : Exception correcte — %', SQLERRM;
      v_error_caught := true;
    ELSE
      RAISE WARNING 'ÉCHEC T15 : Mauvaise exception — %', SQLERRM;
    END IF;
  END;

  IF NOT v_error_caught THEN
    RAISE WARNING 'ÉCHEC T15 : Écriture sur période clôturée non rejetée';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 16 : P3 — Écriture équilibrée acceptée
-- ============================================================

DO $$
DECLARE
  v_entry_id uuid;
BEGIN
  RAISE NOTICE 'TEST 16: Écriture équilibrée acceptée';

  SELECT create_journal_entry(
    '2026-06-15'::date,
    'Test écriture valide',
    '[
      {"account_id":"00000000-0000-0000-0001-000000000001","debit":50000,"credit":0,"description":"Entrée caisse"},
      {"account_id":"00000000-0000-0000-0001-000000000002","debit":0,"credit":50000,"description":"Apport capital"}
    ]'::jsonb
  ) INTO v_entry_id;

  IF v_entry_id IS NOT NULL THEN
    RAISE NOTICE 'SUCCÈS T16 : Écriture créée avec ID %', v_entry_id;
  ELSE
    RAISE WARNING 'ÉCHEC T16 : Aucun ID retourné';
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 17 : P4 — RLS isolation inter-organisation sur loans
-- ============================================================

DO $$
DECLARE
  v_loan_id uuid;
  v_count integer;
BEGIN
  RAISE NOTICE 'TEST 17: RLS isolation inter-org sur loans';

  -- Créer un prêt dans org B
  INSERT INTO public.loans(organization_id, lender_name, principal_xaf, outstanding_principal_xaf, start_date)
  VALUES ('00000000-0000-0000-0000-000000000002', 'Banque B', 500000, 500000, CURRENT_DATE)
  RETURNING id INTO v_loan_id;

  -- Simuler rôle authenticated pour org A
  SET LOCAL role TO 'authenticated';
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}';

  -- Un user de org A ne devrait pas voir les prêts de org B
  SELECT COUNT(*) INTO v_count
  FROM public.loans
  WHERE id = v_loan_id;

  SET LOCAL role TO 'postgres';

  IF v_count = 0 THEN
    RAISE NOTICE 'SUCCÈS T17 : Prêt org B invisible pour user org A';
  ELSE
    RAISE WARNING 'ÉCHEC T17 : Prêt org B VISIBLE pour user org A (%)', v_count;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 18 : P4 — RLS isolation sur reserves
-- ============================================================

DO $$
DECLARE
  v_reserve_id uuid;
  v_count integer;
BEGIN
  RAISE NOTICE 'TEST 18: RLS isolation inter-org sur reserves';

  INSERT INTO public.reserves(organization_id, name, reserve_type)
  VALUES ('00000000-0000-0000-0000-000000000002', 'Réserve Org B', 'legal')
  RETURNING id INTO v_reserve_id;

  SET LOCAL role TO 'authenticated';
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}';

  SELECT COUNT(*) INTO v_count
  FROM public.reserves
  WHERE id = v_reserve_id;

  SET LOCAL role TO 'postgres';

  IF v_count = 0 THEN
    RAISE NOTICE 'SUCCÈS T18 : Réserve org B invisible pour user org A';
  ELSE
    RAISE WARNING 'ÉCHEC T18 : Réserve org B VISIBLE pour user org A (%)', v_count;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 19 : P4 — asset_depreciation_schedules org isolation
-- ============================================================

DO $$
DECLARE
  v_ads_id uuid;
  v_count integer;
BEGIN
  RAISE NOTICE 'TEST 19: RLS isolation asset_depreciation_schedules';

  -- Insérer une ligne ADS pour org B
  INSERT INTO public.asset_depreciation_schedules(
    asset_id, organization_id, period_number, period_date, amount_xaf
  ) VALUES (
    gen_random_uuid(),  -- asset fictif
    '00000000-0000-0000-0000-000000000002',  -- org B
    1,
    CURRENT_DATE,
    10000
  ) RETURNING id INTO v_ads_id;

  SET LOCAL role TO 'authenticated';
  SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}';

  SELECT COUNT(*) INTO v_count
  FROM public.asset_depreciation_schedules
  WHERE id = v_ads_id;

  SET LOCAL role TO 'postgres';

  IF v_count = 0 THEN
    RAISE NOTICE 'SUCCÈS T19 : ADS org B invisible pour user org A';
  ELSE
    RAISE WARNING 'ÉCHEC T19 : ADS org B VISIBLE pour user org A (%)', v_count;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- TEST 20 : P2 — compute_depreciation avec residual value
-- ============================================================

DO $$
DECLARE
  v_asset_id uuid;
  v_total bigint;
  v_expected bigint := 900000;  -- 1000000 - 100000 = 900000
BEGIN
  RAISE NOTICE 'TEST 20: SUM amortissements avec valeur résiduelle';

  SELECT create_asset(
    'Machine Test Résiduelle', 'machine', 1000000, 12,
    '2026-01-01', 100000  -- residual = 100000
  ) INTO v_asset_id;

  PERFORM compute_depreciation(v_asset_id);

  SELECT SUM(amount_xaf) INTO v_total
  FROM public.asset_depreciation_schedules
  WHERE asset_id = v_asset_id;

  IF v_total = v_expected THEN
    RAISE NOTICE 'SUCCÈS T20 : SUM = % XAF (attendu % = purchase - residual)', v_total, v_expected;
  ELSE
    RAISE WARNING 'ÉCHEC T20 : SUM = % XAF (attendu %)', v_total, v_expected;
  END IF;

  ROLLBACK;
END;
$$;

-- ============================================================
-- RÉSUMÉ
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== FINANCE_PHASE3C_TESTS terminés ===';
  RAISE NOTICE 'Vérifier les messages SUCCÈS/ÉCHEC/WARNING ci-dessus';
  RAISE NOTICE 'Tous les tests utilisent ROLLBACK — aucune donnée permanente créée';
END;
$$;
