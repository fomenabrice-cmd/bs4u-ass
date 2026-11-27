-- Migration : LOT 02 T02.03 — core.persons, user_profiles, trigger inscription
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- core.persons — identité commune (employé, client, membre, apprenant)
-- =====================================================================
create table if not exists core.persons (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users(id) on delete set null,
  first_name       text not null check (char_length(first_name) >= 1),
  last_name        text not null check (char_length(last_name) >= 1),
  display_name     text generated always as (first_name || ' ' || last_name) stored,
  gender           text check (gender in ('F', 'M', 'X')),
  date_of_birth    date,
  phone_e164       text check (phone_e164 ~ '^\\+[1-9]\\d{6,14}$'),
  email            extensions.citext,
  city             text,
  region           text,
  country_code     char(2) not null default 'CM',
  preferred_language text not null default 'fr' check (preferred_language in ('fr', 'en')),
  avatar_file_id   uuid,
  -- Colonne calculée : mineur si moins de 18 ans
  is_minor         boolean generated always as (
    date_of_birth is not null and date_of_birth > (current_date - interval '18 years')
  ) stored,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id),
  version          integer not null default 1
);

create index if not exists idx_persons_user_id on core.persons(user_id) where user_id is not null;
create index if not exists idx_persons_phone on core.persons(phone_e164) where phone_e164 is not null;
create index if not exists idx_persons_email on core.persons(email) where email is not null;

-- RLS
alter table core.persons enable row level security;

-- L'utilisateur peut lire son propre profil
create policy "persons_select_own" on core.persons
  for select using (user_id = auth.uid());

-- Les employés actifs peuvent lire les personnes (pour le secrétariat)
create policy "persons_select_employees" on core.persons
  for select using (app.has_permission('biz.customers.read'));

-- =====================================================================
-- core.user_profiles — préférences et état du compte utilisateur
-- =====================================================================
create table if not exists core.user_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  person_id            uuid not null unique references core.persons(id),
  status               text not null default 'active' check (status in ('active', 'disabled', 'locked')),
  last_login_at        timestamptz,
  theme                text default 'system' check (theme in ('light', 'dark', 'system')),
  notification_prefs   jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id),
  version              integer not null default 1
);

alter table core.user_profiles enable row level security;

create policy "user_profiles_select_own" on core.user_profiles
  for select using (user_id = auth.uid());

create policy "user_profiles_update_own" on core.user_profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Les admins peuvent lire tous les profils
create policy "user_profiles_select_admin" on core.user_profiles
  for select using (app.has_permission('platform.users.read'));

create policy "user_profiles_update_admin" on core.user_profiles
  for update using (app.has_permission('platform.users.manage'));

-- Trigger touch_row
create trigger trg_persons_touch
  before update on core.persons
  for each row execute function app.touch_row();

create trigger trg_user_profiles_touch
  before update on core.user_profiles
  for each row execute function app.touch_row();

-- =====================================================================
-- Trigger : créer automatiquement une person + user_profile à l'inscription
-- =====================================================================
create or replace function app.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_person_id uuid;
  v_first_name text;
  v_last_name text;
  v_email text;
begin
  v_email := new.email;

  -- Extraire prénom/nom des metadata si disponibles
  v_first_name := coalesce(
    (new.raw_user_meta_data->>'first_name')::text,
    split_part(coalesce(new.raw_user_meta_data->>'full_name', ''), ' ', 1),
    'Utilisateur'
  );
  v_last_name := coalesce(
    (new.raw_user_meta_data->>'last_name')::text,
    case
      when position(' ' in coalesce(new.raw_user_meta_data->>'full_name', '')) > 0
        then trim(substr(coalesce(new.raw_user_meta_data->>'full_name', ''), position(' ' in coalesce(new.raw_user_meta_data->>'full_name', '')) + 1))
      else 'BS4U'
    end
  );

  -- Créer la personne
  insert into core.persons (user_id, first_name, last_name, email)
  values (new.id, v_first_name, v_last_name, v_email::extensions.citext)
  returning id into v_person_id;

  -- Créer le profil utilisateur
  insert into core.user_profiles (user_id, person_id)
  values (new.id, v_person_id);

  return new;
end;
$$;

create or replace trigger trg_auth_users_create_profile
  after insert on auth.users
  for each row execute function app.on_auth_user_created();

comment on table core.persons is 'Identité physique unique — employé, client, membre, apprenant sont des profils sur cette table';
comment on table core.user_profiles is 'État du compte utilisateur et préférences';
