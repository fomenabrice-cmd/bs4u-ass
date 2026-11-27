-- Migration : LOT 02 T02.05 / T02.06 / T02.07 — Audit, idempotence, numérotation
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- audit.events — journal immuable (append-only)
-- =====================================================================
create table if not exists audit.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  result      text not null default 'success' check (result in ('success', 'denied', 'error')),
  ip_address  inet,
  user_agent  text,
  changes     jsonb,
  reason      text,
  session_id  text,
  app         text check (app in ('manager', 'admin', 'member', 'discover', 'system'))
);

-- Append-only : interdire UPDATE et DELETE
create trigger trg_audit_events_append_only
  before update or delete on audit.events
  for each row execute function app.forbid_update_delete();

-- Index pour les requêtes courantes
create index idx_audit_events_entity on audit.events(entity_type, entity_id);
create index idx_audit_events_user on audit.events(created_by);
create index idx_audit_events_created_at on audit.events(created_at desc);
create index idx_audit_events_action on audit.events(action);

alter table audit.events enable row level security;

-- Seuls les auditeurs et admins peuvent lire le journal
create policy "audit_events_select_auditor" on audit.events
  for select using (
    app.has_permission('audit.read.platform')
    or app.has_permission('audit.read.business')
    or app.has_permission('audit.read.association')
  );

-- Personne ne peut modifier ou supprimer (append-only via trigger)
-- Les inserts se font uniquement via app.audit() (security definer)

-- =====================================================================
-- app.audit — fonction pour journaliser un événement
-- =====================================================================
create or replace function app.audit(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid     default null,
  p_changes     jsonb    default null,
  p_reason      text     default null,
  p_result      text     default 'success'
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into audit.events (created_by, action, entity_type, entity_id, result, changes, reason)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_result, p_changes, p_reason);
end;
$$;

-- =====================================================================
-- app.audit_sensitive_read — journaliser les lectures sensibles
-- =====================================================================
create or replace function app.audit_sensitive_read(
  p_entity_type text,
  p_entity_id   uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform app.audit(
    'sensitive_read',
    p_entity_type,
    p_entity_id,
    null,
    'Lecture données sensibles',
    'success'
  );
end;
$$;

-- Mettre à jour app.require_permission pour journaliser les refus
create or replace function app.require_permission(
  p_code       text,
  p_scope_type text default 'global',
  p_scope_id   uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app.has_permission(p_code, p_scope_type, p_scope_id) then
    -- Journaliser le refus
    insert into audit.events (created_by, action, entity_type, result, changes)
    values (auth.uid(), 'permission_check', 'permission', 'denied',
            jsonb_build_object('permission', p_code, 'scope_type', p_scope_type, 'scope_id', p_scope_id));
    -- Lever l'exception
    raise exception using
      errcode = 'P0001',
      message = 'PERMISSION_DENIED',
      detail  = format('Permission requise : %s', p_code),
      hint    = p_code;
  end if;
end;
$$;

-- =====================================================================
-- ops.idempotency_keys — prévenir les doublons sur les opérations critiques
-- =====================================================================
create table if not exists ops.idempotency_keys (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  user_id       uuid references auth.users(id),
  operation     text not null,
  status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  result        jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  completed_at  timestamptz
);

create index idx_idempotency_key on ops.idempotency_keys(key);
create index idx_idempotency_expires on ops.idempotency_keys(expires_at);

alter table ops.idempotency_keys enable row level security;
create policy "idempotency_own" on ops.idempotency_keys
  for all using (user_id = auth.uid());

-- Nettoyage automatique des clés expirées (appelé par le worker)
create or replace function ops.cleanup_expired_idempotency_keys()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  delete from ops.idempotency_keys where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- app.idempotency_begin — démarrer une opération idempotente
create or replace function app.idempotency_begin(
  p_key       text,
  p_operation text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing ops.idempotency_keys;
begin
  -- Vérifier si la clé existe déjà
  select * into v_existing from ops.idempotency_keys where key = p_key;

  if found then
    if v_existing.status = 'completed' then
      -- Opération déjà réalisée : retourner le résultat précédent
      return jsonb_build_object('already_done', true, 'result', v_existing.result);
    elsif v_existing.status = 'pending' then
      perform app.raise_error('DUPLICATE_OPERATION', 'Opération en cours — réessayer dans quelques secondes');
    end if;
  end if;

  -- Insérer la clé
  insert into ops.idempotency_keys (key, user_id, operation)
  values (p_key, auth.uid(), p_operation);

  return jsonb_build_object('already_done', false);
end;
$$;

-- app.idempotency_finish — finaliser une opération idempotente
create or replace function app.idempotency_finish(
  p_key    text,
  p_status text,
  p_result jsonb default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update ops.idempotency_keys
  set status = p_status, result = p_result, completed_at = now()
  where key = p_key;
end;
$$;

-- =====================================================================
-- ops.number_series — numérotation métier sans trou
-- =====================================================================
create table if not exists ops.number_series (
  id          uuid primary key default gen_random_uuid(),
  series_code text not null unique,
  prefix      text not null,
  pattern     text not null default '{PREFIX}-{YYYY}-{NNNNNN}',
  last_number integer not null default 0,
  reset_cycle text check (reset_cycle in ('never', 'yearly', 'monthly')) default 'yearly',
  last_reset  date,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table ops.number_series enable row level security;
create policy "number_series_select_employees" on ops.number_series
  for select using (app.has_permission('biz.dashboard.read') or app.has_permission('asso.dues.read'));

-- app.next_number — générer le prochain numéro d'une série
create or replace function app.next_number(p_series_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_series   ops.number_series;
  v_num      integer;
  v_result   text;
  v_today    date := current_date;
begin
  -- Verrou pour éviter les doublons concurrents
  select * into v_series from ops.number_series
  where series_code = p_series_code
  for update;

  if not found then
    raise exception 'Série de numérotation inconnue : %', p_series_code;
  end if;

  -- Reset annuel ou mensuel
  if v_series.reset_cycle = 'yearly'
     and (v_series.last_reset is null or extract(year from v_series.last_reset) < extract(year from v_today))
  then
    v_num := 1;
    update ops.number_series set last_number = 1, last_reset = v_today, updated_at = now()
    where series_code = p_series_code;
  elsif v_series.reset_cycle = 'monthly'
     and (v_series.last_reset is null
          or extract(year from v_series.last_reset) < extract(year from v_today)
          or extract(month from v_series.last_reset) < extract(month from v_today))
  then
    v_num := 1;
    update ops.number_series set last_number = 1, last_reset = v_today, updated_at = now()
    where series_code = p_series_code;
  else
    v_num := v_series.last_number + 1;
    update ops.number_series set last_number = v_num, updated_at = now()
    where series_code = p_series_code;
  end if;

  -- Appliquer le pattern
  v_result := v_series.pattern;
  v_result := replace(v_result, '{PREFIX}', v_series.prefix);
  v_result := replace(v_result, '{YYYY}',   to_char(v_today, 'YYYY'));
  v_result := replace(v_result, '{MM}',     to_char(v_today, 'MM'));
  v_result := replace(v_result, '{NNNNNN}', lpad(v_num::text, 6, '0'));
  v_result := replace(v_result, '{NNNNN}',  lpad(v_num::text, 5, '0'));
  v_result := replace(v_result, '{NNNN}',   lpad(v_num::text, 4, '0'));
  v_result := replace(v_result, '{NNN}',    lpad(v_num::text, 3, '0'));

  return v_result;
end;
$$;

comment on table audit.events is 'Journal d''audit immuable (append-only)';
comment on table ops.idempotency_keys is 'Clés d''idempotence pour éviter les doublons sur les opérations critiques';
comment on table ops.number_series is 'Séries de numérotation sans trou pour factures, commandes, membres, etc.';
comment on function app.next_number(text) is 'Génère le prochain numéro d''une série (verrou pessimiste, sans trou)';
