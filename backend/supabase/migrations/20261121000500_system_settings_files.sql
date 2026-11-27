-- Migration : LOT 02 T02.08 / T02.09 — Paramètres système, feature flags, fichiers, Storage
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- core.system_settings — paramètres configurables
-- =====================================================================
create table if not exists core.system_settings (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique,
  value               jsonb not null default 'null',
  scope               text not null check (scope in ('platform', 'business', 'association', 'discover', 'ai')),
  description         text,
  is_decision_pending boolean not null default false,
  decision_ref        text,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id),
  version             integer not null default 1
);

alter table core.system_settings enable row level security;

create policy "settings_select_authenticated" on core.system_settings
  for select to authenticated using (true);
create policy "settings_manage_admin" on core.system_settings
  for all using (app.has_permission('platform.settings.manage'));

create trigger trg_settings_touch before update on core.system_settings
  for each row execute function app.touch_row();

-- Vue API
create or replace view api.v_settings
  with (security_invoker = true)
as
  select key, value, scope, description, is_decision_pending, decision_ref
  from core.system_settings;

grant select on api.v_settings to authenticated;

-- =====================================================================
-- core.feature_flags — activation de fonctionnalités par app
-- =====================================================================
create table if not exists core.feature_flags (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  enabled     boolean not null default false,
  apps        text[] not null default '{}',
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  version     integer not null default 1
);

alter table core.feature_flags enable row level security;
create policy "flags_select_authenticated" on core.feature_flags
  for select to authenticated using (true);
create policy "flags_manage_admin" on core.feature_flags
  for all using (app.has_permission('platform.flags.manage'));

create trigger trg_flags_touch before update on core.feature_flags
  for each row execute function app.touch_row();

create or replace view api.v_feature_flags
  with (security_invoker = true)
as
  select key, enabled, apps, description from core.feature_flags;

grant select on api.v_feature_flags to authenticated, anon;

-- =====================================================================
-- core.files — catalogue des fichiers (métadonnées)
-- =====================================================================
create table if not exists core.files (
  id              uuid primary key default gen_random_uuid(),
  bucket          text not null,
  object_path     text not null,
  original_name   text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  sha256          text,
  owner_user_id   uuid references auth.users(id),
  domain          text not null,
  entity_type     text,
  entity_id       uuid,
  sensitivity     text not null default 'S1' check (sensitivity in ('S0', 'S1', 'S2', 'S3', 'S4')),
  retention_until date,
  scan_status     text not null default 'pending' check (scan_status in ('pending', 'clean', 'infected', 'skipped')),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         integer not null default 1,
  unique (bucket, object_path)
);

create index idx_files_owner on core.files(owner_user_id);
create index idx_files_entity on core.files(entity_type, entity_id) where entity_id is not null;
create index idx_files_domain on core.files(domain);

alter table core.files enable row level security;

-- Un utilisateur peut lire ses propres fichiers
create policy "files_select_own" on core.files
  for select using (owner_user_id = auth.uid());

-- Les fichiers publics (S0) sont accessibles à tous
create policy "files_select_public" on core.files
  for select using (sensitivity = 'S0' and deleted_at is null);

-- Les admins peuvent tout voir
create policy "files_select_admin" on core.files
  for select using (app.has_permission('platform.settings.manage'));

create trigger trg_files_touch before update on core.files
  for each row execute function app.touch_row();

-- =====================================================================
-- core.consents — consentements RGPD/légaux (append-only)
-- =====================================================================
create table if not exists core.consents (
  id               uuid primary key default gen_random_uuid(),
  person_id        uuid not null references core.persons(id),
  consent_type     text not null check (consent_type in (
    'privacy_policy', 'public_profile', 'meeting_recording',
    'marketing', 'ai_coach', 'mentor_share', 'minor_guardian'
  )),
  version          text not null,
  granted          boolean not null,
  scope            jsonb not null default '{}',
  evidence         jsonb not null default '{}',
  granted_by_user_id uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id)
);

create index idx_consents_person on core.consents(person_id, consent_type, created_at desc);

-- Append-only
create trigger trg_consents_append_only
  before update or delete on core.consents
  for each row execute function app.forbid_update_delete();

alter table core.consents enable row level security;

create policy "consents_select_own" on core.consents
  for select using (
    person_id = app.current_person_id()
    or granted_by_user_id = auth.uid()
  );

create policy "consents_insert_own" on core.consents
  for insert with check (person_id = app.current_person_id() or granted_by_user_id = auth.uid());

-- Helpers consentement
create or replace function app.has_consent(
  p_person_id    uuid,
  p_consent_type text
) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select granted from core.consents
     where person_id = p_person_id and consent_type = p_consent_type
     order by created_at desc limit 1),
    false
  );
$$;

comment on table core.system_settings is 'Paramètres système configurables — les valeurs null bloquent l''action dépendante';
comment on table core.feature_flags is 'Activation de fonctionnalités par application';
comment on table core.files is 'Catalogue des fichiers (métadonnées) — les fichiers physiques sont dans Supabase Storage';
comment on table core.consents is 'Consentements RGPD et légaux (append-only)';
