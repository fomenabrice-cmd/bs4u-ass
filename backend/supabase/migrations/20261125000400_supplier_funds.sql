-- M-04 : Fonds fournisseurs — modèle DETTE intraday (PER_AGENCY_PER_OPERATOR_PER_DAY)
-- Chaque ligne enregistre une avance ou un remboursement ; le solde journalier est calculé par vue.
-- Règle validée : MULTIPLE_ACTIVE_SESSIONS_ALLOWED, pas de blocage automatique.

CREATE TABLE IF NOT EXISTS biz.supplier_funds_entries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL,
  branch_id       uuid,
  operator        text        NOT NULL CHECK (operator IN ('mtn', 'orange', 'other')),
  entry_type      text        NOT NULL CHECK (entry_type IN ('advance', 'repayment')),
  amount_xaf      bigint      NOT NULL CHECK (amount_xaf > 0),
  entry_date      date        NOT NULL DEFAULT CURRENT_DATE,
  reference       text,
  notes           text,
  performed_by    uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes journalières
CREATE INDEX IF NOT EXISTS ix_sfe_org_date     ON biz.supplier_funds_entries (organization_id, entry_date);
CREATE INDEX IF NOT EXISTS ix_sfe_branch_op    ON biz.supplier_funds_entries (branch_id, operator, entry_date);

-- Append-only : pas d'UPDATE ni DELETE sur ce ledger
CREATE TRIGGER supplier_funds_immutable
  BEFORE UPDATE OR DELETE ON biz.supplier_funds_entries
  FOR EACH ROW EXECUTE FUNCTION app.forbid_update_delete();

-- Mise à jour automatique de updated_at si jamais on ajoute la colonne plus tard
-- (non applicable ici car append-only, trigger présent pour cohérence future)

-- RLS : isolation par organisation
ALTER TABLE biz.supplier_funds_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sfe_select_org" ON biz.supplier_funds_entries
  FOR SELECT TO authenticated
  USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

CREATE POLICY "sfe_insert_org" ON biz.supplier_funds_entries
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- Vue : position journalière agrégée PER_AGENCY_PER_OPERATOR_PER_DAY
-- security_invoker pour que les filtres RLS de la table s'appliquent
CREATE OR REPLACE VIEW api.v_supplier_funds_daily
  WITH (security_invoker = true)
AS
  SELECT
    organization_id,
    branch_id,
    operator,
    entry_date,
    SUM(CASE WHEN entry_type = 'advance'    THEN amount_xaf ELSE 0 END) AS advanced_xaf,
    SUM(CASE WHEN entry_type = 'repayment'  THEN amount_xaf ELSE 0 END) AS repaid_xaf,
    SUM(CASE WHEN entry_type = 'advance'    THEN  amount_xaf
             WHEN entry_type = 'repayment'  THEN -amount_xaf END)       AS net_debt_xaf
  FROM biz.supplier_funds_entries
  GROUP BY organization_id, branch_id, operator, entry_date;

GRANT SELECT ON api.v_supplier_funds_daily TO authenticated;

-- RPC : enregistrer une avance ou un remboursement fournisseur
CREATE OR REPLACE FUNCTION api.record_supplier_fund(
  p_operator        text,
  p_entry_type      text,
  p_amount_xaf      bigint,
  p_branch_id       uuid    DEFAULT NULL,
  p_reference       text    DEFAULT NULL,
  p_notes           text    DEFAULT NULL,
  p_idempotency_key text    DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = api, public, app
AS $$
DECLARE
  v_org_id uuid;
  v_entry_id uuid;
  v_idem jsonb;
BEGIN
  PERFORM app.require_permission('biz.cash.operate');

  v_org_id := (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id manquant dans le JWT';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    v_idem := app.idempotency_begin(p_idempotency_key, 'record_supplier_fund');
    IF (v_idem ->> 'already_done')::boolean THEN
      RETURN (v_idem ->> 'result')::uuid;
    END IF;
  END IF;

  INSERT INTO biz.supplier_funds_entries (
    organization_id, branch_id, operator, entry_type,
    amount_xaf, entry_date, reference, notes, performed_by
  ) VALUES (
    v_org_id, p_branch_id, p_operator, p_entry_type,
    p_amount_xaf, CURRENT_DATE, p_reference, p_notes, auth.uid()
  )
  RETURNING id INTO v_entry_id;

  PERFORM app.audit(
    'supplier_fund.' || p_entry_type,
    'supplier_fund_entry', v_entry_id,
    jsonb_build_object('operator', p_operator, 'amount_xaf', p_amount_xaf, 'entry_type', p_entry_type),
    auth.uid(), 'success'
  );

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM app.idempotency_finish(p_idempotency_key, 'success', to_jsonb(v_entry_id));
  END IF;

  RETURN v_entry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION api.record_supplier_fund(text, text, bigint, uuid, text, text, text) TO authenticated;
