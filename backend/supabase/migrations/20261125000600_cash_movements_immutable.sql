-- M-06 : Trigger d'immutabilité sur cash_movements (append-only)
-- Dépend : app.forbid_update_delete() (créé dans les migrations existantes)
-- S'applique après M-07 (RLS caisse)

-- cash_movements est un ledger append-only : on n'autorise jamais UPDATE ni DELETE
CREATE TRIGGER cash_movements_immutable
  BEFORE UPDATE OR DELETE ON cash_movements
  FOR EACH ROW EXECUTE FUNCTION app.forbid_update_delete();
