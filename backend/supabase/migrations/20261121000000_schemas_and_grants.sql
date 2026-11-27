-- Migration : LOT 02 T02.01 — Création des schémas et grants de base
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- Schémas privés (jamais exposés directement à PostgREST)
-- =====================================================================
create schema if not exists core;
create schema if not exists biz;
create schema if not exists momo;
create schema if not exists asso;
create schema if not exists disc;
create schema if not exists meet;
create schema if not exists ops;
create schema if not exists audit;
create schema if not exists app;

-- =====================================================================
-- Schéma public de l'API (seul exposé à PostgREST via config.toml)
-- =====================================================================
create schema if not exists api;

-- =====================================================================
-- Grants : seul le schéma `api` est accessible aux rôles Supabase
-- =====================================================================
-- Révoquer l'accès public aux schémas privés
revoke all on schema core from anon, authenticated;
revoke all on schema biz from anon, authenticated;
revoke all on schema momo from anon, authenticated;
revoke all on schema asso from anon, authenticated;
revoke all on schema disc from anon, authenticated;
revoke all on schema meet from anon, authenticated;
revoke all on schema ops from anon, authenticated;
revoke all on schema audit from anon, authenticated;
revoke all on schema app from anon, authenticated;

-- Le schéma `api` est accessible aux utilisateurs authentifiés et anonymes
grant usage on schema api to anon, authenticated;

-- Le schéma `app` est accessible uniquement au rôle service_role (fonctions internes)
grant usage on schema app to service_role;
grant all on schema app to service_role;

-- =====================================================================
-- Extension citext pour les emails (insensible à la casse)
-- =====================================================================
create extension if not exists citext with schema extensions;

-- =====================================================================
-- Extension pour UUIDs (disponible par défaut sur Supabase)
-- =====================================================================
create extension if not exists "uuid-ossp" with schema extensions;

comment on schema core is 'Identité, accès, configuration plateforme';
comment on schema biz is 'Commerce BS4U : commandes, stock, caisse, factures, formation, projets';
comment on schema momo is 'Mobile Money : Orange Money, MTN MoMo';
comment on schema asso is 'Association BS4U : adhésions, cotisations, gouvernance';
comment on schema disc is 'Discover : profils publics, annuaire, modération';
comment on schema meet is 'Réunions IA : transcription, comptes rendus';
comment on schema ops is 'Opérations transversales : jobs, notifications, idempotence, numérotation';
comment on schema audit is 'Journal d''audit immuable';
comment on schema app is 'Fonctions internes partagées : sécurité, utils, audit';
comment on schema api is 'Schéma exposé à PostgREST : vues et RPC uniquement';
