-- Fix : close_cash_session ne gérait pas la contrainte chk_early_close_reason
-- La fermeture avant expected_close_at levait une erreur 400.
-- On ajoute p_early_close_reason et on le remplit automatiquement.

DROP FUNCTION IF EXISTS public.close_cash_session(uuid, bigint, text, text);

CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id         uuid,
  p_counted_xaf        bigint,
  p_justification      text    DEFAULT NULL,
  p_idempotency_key    text    DEFAULT NULL,
  p_early_close_reason text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id        uuid;
  v_register_id   uuid;
  v_theoretical   bigint;
  v_diff          bigint;
  v_expected_close timestamptz;
BEGIN
  v_org_id := (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid;

  SELECT organization_id, cash_register_id, expected_close_at
    INTO v_org_id, v_register_id, v_expected_close
  FROM cash_sessions
  WHERE id = p_session_id
    AND organization_id = v_org_id
    AND status = 'open';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Session introuvable, déjà clôturée ou hors organisation';
  END IF;

  v_theoretical := get_cash_session_balance(p_session_id);
  v_diff := p_counted_xaf - v_theoretical;

  IF v_diff <> 0 AND (p_justification IS NULL OR trim(p_justification) = '') THEN
    RAISE EXCEPTION 'Une justification est requise lorsque le montant compté diffère du solde théorique';
  END IF;

  -- difference_xaf est GENERATED ALWAYS, on ne l'insère pas
  INSERT INTO cash_closings (
    organization_id, cash_session_id,
    counted_by, theoretical_xaf, counted_xaf,
    difference_reason
  ) VALUES (
    v_org_id, p_session_id,
    auth.uid(), v_theoretical, p_counted_xaf,
    p_justification
  );

  INSERT INTO cash_movements (
    organization_id, cash_session_id, cash_register_id,
    movement_type, amount_xaf, description, performed_by
  ) VALUES (
    v_org_id, p_session_id, v_register_id,
    'closing'::cash_movement_type, p_counted_xaf,
    'Clôture de session', auth.uid()
  );

  UPDATE cash_sessions
  SET status    = 'closed',
      closed_at = now(),
      -- Satisfait chk_early_close_reason si fermeture avant l'heure prévue
      early_close_reason = CASE
        WHEN v_expected_close IS NOT NULL AND now() < v_expected_close
        THEN COALESCE(p_early_close_reason, 'Fermeture manuelle anticipée')
        ELSE p_early_close_reason
      END
  WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, bigint, text, text, text) TO authenticated;
