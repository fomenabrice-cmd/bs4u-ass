-- M-02 : Ajout organization_id + performed_by à momo.transactions (Phase 4)
-- momo.transactions manquait de traçabilité opérateur et d'isolement org

ALTER TABLE momo.transactions
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS performed_by    uuid REFERENCES auth.users(id);

-- Index pour les requêtes par organisation
CREATE INDEX IF NOT EXISTS ix_momo_transactions_org ON momo.transactions(organization_id);

-- Mise à jour de la vue api.v_momo_transactions pour inclure organization_id
CREATE OR REPLACE VIEW api.v_momo_transactions
  WITH (security_invoker = true)
AS
  SELECT
    t.id, t.tx_number, t.tx_type, t.amount_xaf, t.fee_xaf, t.net_xaf,
    t.counterpart, t.reference, t.tx_at, t.notes,
    t.organization_id, t.performed_by,
    a.operator, a.phone_number, a.display_name AS account_name,
    c.display_name AS customer_name
  FROM momo.transactions t
  JOIN momo.accounts a ON a.id = t.account_id
  LEFT JOIN biz.customers c ON c.id = t.customer_id
  WHERE (t.organization_id IS NULL
    OR t.organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
