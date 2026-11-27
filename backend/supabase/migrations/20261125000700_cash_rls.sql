-- M-07 : RLS sur les tables caisse (Phase 1 — sécurité immédiate)
-- Isolation par organisation via app_metadata.organization_id dans le JWT
-- Les INSERT/UPDATE directs sont autorisés durant la période de transition
-- (avant que CashSession.tsx utilise les RPCs).
-- Les RPCs (SECURITY DEFINER) contournent le RLS par conception.

-- ─── cash_sessions ─────────────────────────────────────────────────────────
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_select_org" ON cash_sessions;
CREATE POLICY "cash_sessions_select_org" ON cash_sessions
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "cash_sessions_insert_org" ON cash_sessions;
CREATE POLICY "cash_sessions_insert_org" ON cash_sessions
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "cash_sessions_update_org" ON cash_sessions;
CREATE POLICY "cash_sessions_update_org" ON cash_sessions
  FOR UPDATE TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- ─── cash_movements ────────────────────────────────────────────────────────
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_movements_select_org" ON cash_movements;
CREATE POLICY "cash_movements_select_org" ON cash_movements
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "cash_movements_insert_org" ON cash_movements;
CREATE POLICY "cash_movements_insert_org" ON cash_movements
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Pas de policy UPDATE/DELETE : cash_movements est append-only (voir M-06)

-- ─── cash_closings ─────────────────────────────────────────────────────────
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_closings_select_org" ON cash_closings;
CREATE POLICY "cash_closings_select_org" ON cash_closings
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

DROP POLICY IF EXISTS "cash_closings_insert_org" ON cash_closings;
CREATE POLICY "cash_closings_insert_org" ON cash_closings
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- ─── cash_registers (lecture seule pour les utilisateurs) ──────────────────
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_registers_select_org" ON cash_registers;
CREATE POLICY "cash_registers_select_org" ON cash_registers
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
