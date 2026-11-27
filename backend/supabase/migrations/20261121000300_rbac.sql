-- Migration : LOT 02 T02.04 — RBAC : rôles, permissions, assignments
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- core.roles
-- =====================================================================
create table if not exists core.roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  label_fr    text not null,
  label_en    text,
  domain      text not null check (domain in ('platform', 'business', 'association', 'discover', 'learning')),
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id),
  version     integer not null default 1
);

alter table core.roles enable row level security;
create policy "roles_select_authenticated" on core.roles
  for select to authenticated using (true);
create policy "roles_manage_admin" on core.roles
  for all using (app.has_permission('platform.roles.manage'));

create trigger trg_roles_touch before update on core.roles
  for each row execute function app.touch_row();

-- =====================================================================
-- core.permissions
-- =====================================================================
create table if not exists core.permissions (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  domain         text not null,
  label_fr       text not null,
  description    text,
  is_sensitive   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1
);

alter table core.permissions enable row level security;
create policy "permissions_select_authenticated" on core.permissions
  for select to authenticated using (true);
create policy "permissions_manage_admin" on core.permissions
  for all using (app.has_permission('platform.roles.manage'));

-- =====================================================================
-- core.role_permissions
-- =====================================================================
create table if not exists core.role_permissions (
  role_id       uuid not null references core.roles(id) on delete cascade,
  permission_id uuid not null references core.permissions(id) on delete cascade,
  granted_at    timestamptz not null default now(),
  granted_by    uuid references auth.users(id),
  primary key (role_id, permission_id)
);

alter table core.role_permissions enable row level security;
create policy "role_permissions_select_authenticated" on core.role_permissions
  for select to authenticated using (true);
create policy "role_permissions_manage_admin" on core.role_permissions
  for all using (app.has_permission('platform.roles.manage'));

-- =====================================================================
-- core.user_role_assignments
-- =====================================================================
create table if not exists core.user_role_assignments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  role_id       uuid not null references core.roles(id) on delete cascade,
  scope_type    text not null default 'global' check (scope_type in ('global', 'branch', 'course', 'project')),
  scope_id      uuid,
  valid_from    timestamptz not null default now(),
  valid_until   timestamptz,
  source        text not null default 'manual' check (source in ('manual', 'mandate', 'system')),
  source_ref_id uuid,
  revoked_at    timestamptz,
  revoked_by    uuid references auth.users(id),
  revoke_reason text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  version       integer not null default 1
);

-- Unicité : un utilisateur ne peut avoir le même rôle actif dans le même périmètre
create unique index ux_user_role_active on core.user_role_assignments(user_id, role_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create index idx_ura_user_id on core.user_role_assignments(user_id);
create index idx_ura_role_id on core.user_role_assignments(role_id);

alter table core.user_role_assignments enable row level security;

-- Un utilisateur peut voir ses propres assignments
create policy "ura_select_own" on core.user_role_assignments
  for select using (user_id = auth.uid());

-- Les admins gèrent tous les assignments
create policy "ura_select_admin" on core.user_role_assignments
  for select using (app.has_permission('platform.users.read'));
create policy "ura_manage_admin" on core.user_role_assignments
  for insert with check (app.has_permission('platform.users.manage'));
create policy "ura_update_admin" on core.user_role_assignments
  for update using (app.has_permission('platform.users.manage'));

create trigger trg_ura_touch before update on core.user_role_assignments
  for each row execute function app.touch_row();

-- =====================================================================
-- app.has_permission — vérifie si l'utilisateur a une permission
-- =====================================================================
create or replace function app.has_permission(
  p_code       text,
  p_scope_type text default 'global',
  p_scope_id   uuid default null
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from core.user_role_assignments ura
    join core.role_permissions rp    on rp.role_id    = ura.role_id
    join core.permissions p           on p.id          = rp.permission_id
    join core.user_profiles up        on up.user_id    = ura.user_id
    where ura.user_id  = auth.uid()
      and p.code       = p_code
      and up.status    = 'active'
      and ura.revoked_at is null
      and now() >= ura.valid_from
      and (ura.valid_until is null or now() < ura.valid_until)
      and (
        ura.scope_type = 'global'
        or (ura.scope_type = p_scope_type and (p_scope_id is null or ura.scope_id = p_scope_id))
      )
  );
$$;

-- =====================================================================
-- app.require_permission — lève une exception si permission absente
-- =====================================================================
create or replace function app.require_permission(
  p_code       text,
  p_scope_type text default 'global',
  p_scope_id   uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_permission(p_code, p_scope_type, p_scope_id) then
    -- Journaliser le refus (le journal audit est créé à T02.05, insert conditionnel)
    perform app.raise_error(
      'PERMISSION_DENIED',
      format('Permission requise : %s', p_code)
    );
  end if;
end;
$$;

-- =====================================================================
-- Vue API : permissions effectives de l'utilisateur courant
-- =====================================================================
create or replace view api.v_my_permissions
  with (security_invoker = true)
as
  select distinct p.code, p.domain, p.label_fr, p.is_sensitive,
         ura.scope_type, ura.scope_id
  from core.user_role_assignments ura
  join core.role_permissions rp on rp.role_id = ura.role_id
  join core.permissions p on p.id = rp.permission_id
  join core.user_profiles up on up.user_id = ura.user_id
  where ura.user_id = auth.uid()
    and up.status = 'active'
    and ura.revoked_at is null
    and now() >= ura.valid_from
    and (ura.valid_until is null or now() < ura.valid_until);

grant select on api.v_my_permissions to authenticated;

comment on function app.has_permission(text,text,uuid) is 'Retourne true si l''utilisateur courant a la permission (lu en base, pas depuis le JWT)';
comment on function app.require_permission(text,text,uuid) is 'Lève PERMISSION_DENIED si la permission est absente';
