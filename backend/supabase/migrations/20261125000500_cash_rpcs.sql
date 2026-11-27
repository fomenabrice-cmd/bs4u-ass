-- M-05 : RPC Caisse — open_cash_session, add_cash_movement, close_cash_session
-- Rend les 3 opérations caisse atomiques et idempotentes (Phase 2)
-- Dépend : cash_sessions, cash_movements, cash_closings, cash_registers dans public schema

-- Colonnes manquantes sur cash_closings (si tables créées hors migration)
ALTER TABLE cash_closings
  ADD COLUMN IF NOT EXISTS difference_xaf bigint,
  ADD COLUMN IF NOT EXISTS justification  text;

-- Colonne closing_time sur cash_registers (pour ALERT_ONLY frontend)
ALTER TABLE cash_registers
  ADD COLUMN IF NOT EXISTS closing_time text NOT NULL DEFAULT '17:00';

-- ─── Solde de session ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.get_cash_session_balance(p_session_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = api, public, app
AS $$
  SELECT COALESCE(SUM(amount_xaf), 0)::bigint
  FROM cash_movements
  WHERE cash_session_id = p_session_id;
$$;

GRANT EXECUTE ON FUNCTION api.get_cash_session_balance(uuid) TO authenticated;

-- ─── Ouverture atomique ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION api.open_cash_session(
  p_register_id     uuid,
  p_opening_xaf     bigint,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = api, public, app
AS $$
DECLARE
  v_org_id     uuid;
  v_session_id uuid;
  v_idem       jsonb;
BEGIN
  PERFORM app.require_permission('biz.cash.operate');

  IF p_idempotency_key IS NOT NULL THEN
    v_idem := app.idempotency_begin(p_idempotency_key, 'open_cash_session');
    IF (v_idem->>'already_done')::boolean THEN
      RETURN (v_idem->'result'->>'session_id')::uuid;
    END IF;
  END IF;

  SELECT organization_id INTO v_org_id FROM cash_registers WHERE id = p_register_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Caisse introuvable : %', p_register_id;
  END IF;

  INSERT INTO cash_sessions (organization_id, cash_register_id, cashier_id, opening_amount_xaf, status)
  VALUES (v_org_id, p_register_id, auth.uid(), p_opening_xaf, 'open')
  RETURNING id INTO v_session_id;

  INSERT INTO cash_movements (organization_id, cash_session_id, cash_register_id,
    movement_type, amount_xaf, description, performed_by)
  VALUES (v_org_id, v_session_id, p_register_id,
    'opening', p_opening_xaf, 'Fonds d''ouverture', auth.uid());

  PERFORM app.audit('cash.session.opened', 'cash.session', v_session_id,
    jsonb_build_object('opening_xaf', p_opening_xaf), auth.uid(), 'success');

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('session_id', v_session_id));
  END IF;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION api.open_cash_session(uuid, bigint, text) TO authenticated;

-- ─── Mouvement de fonds (avec vérification solde et idempotence) ────────────
CREATE OR REPLACE FUNCTION api.add_cash_movement(
  p_session_id      uuid,
  p_movement_type   text,   -- 'fund_addition' | 'fund_withdrawal'
  p_amount_xaf      bigint, -- valeur absolue positive
  p_description     text   DEFAULT NULL,
  p_idempotency_key text   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = api, public, app
AS $$
DECLARE
  v_org_id      uuid;
  v_register_id uuid;
  v_balance     bigint;
  v_stored_xaf  bigint;
  v_idem        jsonb;
BEGIN
  PERFORM app.require_permission('biz.cash.operate');

  IF p_idempotency_key IS NOT NULL THEN
    v_idem := app.idempotency_begin(p_idempotency_key, 'add_cash_movement');
    IF (v_idem->>'already_done')::boolean THEN RETURN; END IF;
  END IF;

  SELECT organization_id, cash_register_id INTO v_org_id, v_register_id
  FROM cash_sessions WHERE id = p_session_id AND status = 'open';
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Session non ouverte : %', p_session_id;
  END IF;

  IF p_movement_type = 'fund_withdrawal' THEN
    v_balance := api.get_cash_session_balance(p_session_id);
    IF v_balance < p_amount_xaf THEN
      RAISE EXCEPTION 'Solde insuffisant : % F disponible, % F demandé', v_balance, p_amount_xaf;
    END IF;
    v_stored_xaf := -p_amount_xaf;
  ELSE
    v_stored_xaf := p_amount_xaf;
  END IF;

  INSERT INTO cash_movements (organization_id, cash_session_id, cash_register_id,
    movement_type, amount_xaf, description, performed_by)
  VALUES (v_org_id, p_session_id, v_register_id, p_movement_type, v_stored_xaf,
    COALESCE(p_description,
      CASE p_movement_type WHEN 'fund_addition' THEN 'Entrée de fonds' ELSE 'Sortie de fonds' END),
    auth.uid());

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM app.idempotency_finish(p_idempotency_key, 'completed', 'null'::jsonb);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION api.add_cash_movement(uuid, text, bigint, text, text) TO authenticated;

-- ─── Clôture atomique (justification obligatoire sur écart) ─────────────────
CREATE OR REPLACE FUNCTION api.close_cash_session(
  p_session_id      uuid,
  p_counted_xaf     bigint,
  p_justification   text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = api, public, app
AS $$
DECLARE
  v_org_id      uuid;
  v_register_id uuid;
  v_theoretical bigint;
  v_diff        bigint;
  v_idem        jsonb;
BEGIN
  PERFORM app.require_permission('biz.cash.operate');

  IF p_idempotency_key IS NOT NULL THEN
    v_idem := app.idempotency_begin(p_idempotency_key, 'close_cash_session');
    IF (v_idem->>'already_done')::boolean THEN RETURN; END IF;
  END IF;

  SELECT organization_id, cash_register_id INTO v_org_id, v_register_id
  FROM cash_sessions WHERE id = p_session_id AND status = 'open';
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Session non ouverte ou déjà clôturée : %', p_session_id;
  END IF;

  v_theoretical := api.get_cash_session_balance(p_session_id);
  v_diff := p_counted_xaf - v_theoretical;

  IF v_diff <> 0 AND (p_justification IS NULL OR trim(p_justification) = '') THEN
    RAISE EXCEPTION 'Justification obligatoire pour un écart de % F', v_diff;
  END IF;

  INSERT INTO cash_closings (organization_id, cash_session_id, counted_by,
    theoretical_xaf, counted_xaf, difference_xaf, justification, status)
  VALUES (v_org_id, p_session_id, auth.uid(),
    v_theoretical, p_counted_xaf, v_diff, p_justification, 'validated');

  INSERT INTO cash_movements (organization_id, cash_session_id, cash_register_id,
    movement_type, amount_xaf, description, performed_by)
  VALUES (v_org_id, p_session_id, v_register_id, 'closing', 0,
    'Clôture · Théorique: ' || v_theoretical || ' F · Compté: ' || p_counted_xaf || ' F · Écart: ' ||
    CASE WHEN v_diff >= 0 THEN '+' ELSE '' END || v_diff || ' F' ||
    COALESCE(' · ' || NULLIF(trim(COALESCE(p_justification, '')), ''), ''),
    auth.uid());

  UPDATE cash_sessions SET status = 'closed' WHERE id = p_session_id;

  PERFORM app.audit('cash.session.closed', 'cash.session', p_session_id,
    jsonb_build_object('theoretical_xaf', v_theoretical, 'counted_xaf', p_counted_xaf,
      'difference_xaf', v_diff, 'justification', p_justification),
    auth.uid(), 'success');

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM app.idempotency_finish(p_idempotency_key, 'completed', 'null'::jsonb);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION api.close_cash_session(uuid, bigint, text, text) TO authenticated;
