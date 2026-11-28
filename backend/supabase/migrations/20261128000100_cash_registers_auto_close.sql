-- Migration : colonnes fermeture automatique sur cash_registers
-- Requises par PreferencesPage.tsx (CaissesTab)

ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS auto_close_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_close_time     text    NOT NULL DEFAULT '00:00';
