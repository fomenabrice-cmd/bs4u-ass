-- M-01 : Ajout organization_id et branch_id à momo.accounts (Phase 4)
-- momo.accounts n'avait ni organization_id ni branch_id — isolement multi-org absent
-- À appliquer AVANT M-08 (migration données public → momo.*)

ALTER TABLE momo.accounts
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS branch_id       uuid;

-- Index pour les requêtes par organisation
CREATE INDEX IF NOT EXISTS ix_momo_accounts_org ON momo.accounts(organization_id);

-- RLS : ajouter filtre organisation sur les politiques existantes
-- (les politiques existantes vérifient app.has_permission(), on ajoute le filtre org)
DROP POLICY IF EXISTS "momo acc read"  ON momo.accounts;
DROP POLICY IF EXISTS "momo acc write" ON momo.accounts;

CREATE POLICY "momo_accounts_select" ON momo.accounts
  FOR SELECT
  USING (
    app.has_permission('momo.accounts.read')
    AND (organization_id IS NULL
      OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "momo_accounts_write" ON momo.accounts
  FOR ALL
  USING (app.has_permission('momo.accounts.write'))
  WITH CHECK (
    app.has_permission('momo.accounts.write')
    AND (organization_id IS NULL
      OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- Mise à jour de la vue api.v_momo_accounts pour exposer organization_id
CREATE OR REPLACE VIEW api.v_momo_accounts
  WITH (security_invoker = true)
AS
  SELECT
    id, operator, phone_number, display_name, balance_xaf,
    organization_id, branch_id, is_active, is_primary,
    created_at, updated_at
  FROM momo.accounts
  WHERE is_active = true
    AND (organization_id IS NULL
      OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
