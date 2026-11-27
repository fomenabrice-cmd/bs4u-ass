-- Migration : LOT 02 T02.10 / T02.11 — Jobs asynchrones, notifications
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- ops.jobs — file de travaux asynchrones
-- =====================================================================
create table if not exists ops.jobs (
  id            uuid primary key default gen_random_uuid(),
  job_type      text not null,
  payload       jsonb not null default '{}',
  status        text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'dead')),
  priority      integer not null default 5 check (priority between 1 and 10),
  attempts      integer not null default 0,
  max_attempts  integer not null default 3,
  scheduled_at  timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  error_detail  jsonb,
  owner_user_id uuid references auth.users(id),
  entity_type   text,
  entity_id     uuid,
  idempotency_key text unique,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index idx_jobs_pending on ops.jobs(scheduled_at)
  where status = 'pending';
create index idx_jobs_entity on ops.jobs(entity_type, entity_id) where entity_id is not null;
create index idx_jobs_type on ops.jobs(job_type);

-- Append-only sauf pour les mises à jour de statut (gérées par le worker)
alter table ops.jobs enable row level security;

create policy "jobs_select_own" on ops.jobs
  for select using (owner_user_id = auth.uid());
create policy "jobs_select_admin" on ops.jobs
  for select using (app.has_permission('platform.jobs.read'));
create policy "jobs_insert_authenticated" on ops.jobs
  for insert to authenticated with check (owner_user_id = auth.uid() or owner_user_id is null);

-- Fonction utilitaire pour enqueuer un job
create or replace function ops.enqueue_job(
  p_job_type        text,
  p_payload         jsonb,
  p_priority        integer default 5,
  p_scheduled_at    timestamptz default now(),
  p_entity_type     text default null,
  p_entity_id       uuid default null,
  p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_job_id uuid;
begin
  insert into ops.jobs (
    job_type, payload, priority, scheduled_at,
    entity_type, entity_id, idempotency_key,
    owner_user_id, created_by
  )
  values (
    p_job_type, p_payload, p_priority, p_scheduled_at,
    p_entity_type, p_entity_id, p_idempotency_key,
    auth.uid(), auth.uid()
  )
  on conflict (idempotency_key) do nothing
  returning id into v_job_id;

  return v_job_id;
end;
$$;

-- =====================================================================
-- ops.notifications — notifications in-app
-- =====================================================================
create table if not exists ops.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
    'info', 'success', 'warning', 'error',
    'order_update', 'payment_received', 'membership_update',
    'due_reminder', 'application_decision', 'solidarity_update',
    'meeting_ready', 'sync_conflict', 'system'
  )),
  title       text not null,
  body        text,
  link        text,
  entity_type text,
  entity_id   uuid,
  read_at     timestamptz,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index idx_notifications_user on ops.notifications(user_id, created_at desc);
create index idx_notifications_unread on ops.notifications(user_id, created_at desc)
  where read_at is null and archived_at is null;

alter table ops.notifications enable row level security;

create policy "notifications_own" on ops.notifications
  for all using (user_id = auth.uid());

-- Vue API des notifications
create or replace view api.v_my_notifications
  with (security_invoker = true)
as
  select id, kind, title, body, link, entity_type, entity_id,
         read_at, archived_at, created_at
  from ops.notifications
  where user_id = auth.uid()
    and archived_at is null
  order by created_at desc
  limit 100;

grant select on api.v_my_notifications to authenticated;

-- RPC : marquer comme lu
create or replace function api.notifications_mark_read(p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  update ops.notifications
  set read_at = now()
  where user_id = auth.uid()
    and id = any(p_ids)
    and read_at is null;
end;
$$;

grant execute on function api.notifications_mark_read(uuid[]) to authenticated;

comment on table ops.jobs is 'File de travaux asynchrones (PDF, transcription, notifications groupées, exports)';
comment on table ops.notifications is 'Notifications in-app des utilisateurs';
