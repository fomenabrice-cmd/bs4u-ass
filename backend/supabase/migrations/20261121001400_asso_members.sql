-- LOT 08 — Association BS4U : Membres, Cotisations, Solidarité

-- ─── Membres de l'association ──────────────────────────────────────────────

create table asso.members (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references core.persons(id),
  member_number   text unique not null,           -- MBR-YYYY-NNNNNN
  status          text not null default 'pending'
                  check (status in ('pending','active','suspended','resigned','excluded')),
  membership_type text not null default 'standard'
                  check (membership_type in ('standard','youth','honorary','founder')),
  joined_at       date,
  suspended_at    date,
  resigned_at     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         int not null default 1,
  unique (person_id)
);

create trigger asso_members_touch
  before update on asso.members
  for each row execute function app.touch_row();

-- ─── Candidatures d'adhésion ───────────────────────────────────────────────

create table asso.applications (
  id              uuid primary key default gen_random_uuid(),
  application_number text unique not null,        -- CAN-YYYY-NNNNNN
  person_id       uuid not null references core.persons(id),
  membership_type text not null default 'standard'
                  check (membership_type in ('standard','youth','honorary','founder')),
  status          text not null default 'draft'
                  check (status in ('draft','submitted','under_review','approved','rejected','withdrawn')),
  motivation      text,
  reviewer_id     uuid references auth.users(id),
  reviewed_at     timestamptz,
  review_notes    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger asso_applications_touch
  before update on asso.applications
  for each row execute function app.touch_row();

-- ─── Cotisations (append-only ledger) ─────────────────────────────────────

create table asso.dues (
  id              uuid primary key default gen_random_uuid(),
  due_number      text unique not null,           -- COT-YYYY-NNNNNN
  member_id       uuid not null references asso.members(id),
  period_year     int  not null check (period_year between 2020 and 2100),
  period_quarter  int  check (period_quarter between 1 and 4),
  amount_xaf      bigint not null check (amount_xaf > 0),
  status          text not null default 'pending'
                  check (status in ('pending','paid','partial','overdue','waived')),
  paid_xaf        bigint not null default 0 check (paid_xaf >= 0),
  due_date        date,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- ─── Paiements de cotisations (append-only) ────────────────────────────────

create table asso.due_payments (
  id              uuid primary key default gen_random_uuid(),
  due_id          uuid not null references asso.dues(id),
  amount_xaf      bigint not null check (amount_xaf > 0),
  method          text not null check (method in ('cash','mtn_momo','orange_money','transfer')),
  reference       text,
  received_at     timestamptz not null default now(),
  received_by     uuid references auth.users(id)
);

create trigger asso_due_payments_forbid_update_delete
  before update or delete on asso.due_payments
  for each row execute function app.forbid_update_delete();

-- Mise à jour automatique de paid_xaf sur asso.dues
create function asso.sync_due_paid() returns trigger language plpgsql as $$
begin
  update asso.dues
  set paid_xaf = (select coalesce(sum(amount_xaf), 0) from asso.due_payments where due_id = new.due_id),
      status   = case
        when (select coalesce(sum(amount_xaf), 0) from asso.due_payments where due_id = new.due_id) = 0 then 'pending'
        when (select coalesce(sum(amount_xaf), 0) from asso.due_payments where due_id = new.due_id) >= amount_xaf then 'paid'
        else 'partial'
      end
  where id = new.due_id;
  return new;
end;
$$;

create trigger asso_due_payments_sync_due
  after insert on asso.due_payments
  for each row execute function asso.sync_due_paid();

-- ─── Fonds de solidarité (append-only) ────────────────────────────────────

create table asso.solidarity_entries (
  id              uuid primary key default gen_random_uuid(),
  entry_type      text not null check (entry_type in ('contribution','grant','expense','reimbursement')),
  member_id       uuid references asso.members(id),
  amount_xaf      bigint not null,               -- positif = entrée, négatif = sortie
  purpose         text not null,
  reference       text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create trigger asso_solidarity_forbid_update_delete
  before update or delete on asso.solidarity_entries
  for each row execute function app.forbid_update_delete();

-- Index
create index ix_asso_members_person   on asso.members(person_id);
create index ix_asso_members_status   on asso.members(status);
create index ix_asso_applications_person on asso.applications(person_id);
create index ix_asso_dues_member      on asso.dues(member_id);
create index ix_asso_dues_year        on asso.dues(period_year);

-- RLS
alter table asso.members              enable row level security;
alter table asso.applications         enable row level security;
alter table asso.dues                 enable row level security;
alter table asso.due_payments         enable row level security;
alter table asso.solidarity_entries   enable row level security;

-- Membres : chacun voit sa propre ligne, les gestionnaires voient tout
create policy "asso members self"   on asso.members for select
  using (person_id = app.current_person_id() or app.has_permission('asso.members.read'));
create policy "asso members write"  on asso.members for all
  using (app.has_permission('asso.members.write'));
create policy "asso app self"       on asso.applications for select
  using (person_id = app.current_person_id() or app.has_permission('asso.members.read'));
create policy "asso app write"      on asso.applications for all
  using (app.has_permission('asso.members.write'));
create policy "asso dues read"      on asso.dues for select using (app.has_permission('asso.dues.read'));
create policy "asso dues write"     on asso.dues for all   using (app.has_permission('asso.dues.write'));
create policy "asso dp read"        on asso.due_payments for select using (app.has_permission('asso.dues.read'));
create policy "asso dp write"       on asso.due_payments for insert with check (app.has_permission('asso.dues.write'));
create policy "asso sol read"       on asso.solidarity_entries for select using (app.has_permission('asso.solidarity.read'));
create policy "asso sol write"      on asso.solidarity_entries for insert with check (app.has_permission('asso.solidarity.write'));

-- Transitions membres/candidatures (complémentent celles du seed)
insert into app.allowed_transitions (entity_type, from_status, to_status) values
  ('asso.member', 'pending',    'active'),
  ('asso.member', 'active',     'suspended'),
  ('asso.member', 'active',     'resigned'),
  ('asso.member', 'suspended',  'active'),
  ('asso.member', 'suspended',  'excluded');

-- Vues API
create view api.v_asso_members with (security_invoker = true) as
  select
    m.id, m.member_number, m.status, m.membership_type,
    m.joined_at, m.created_at,
    p.full_name, p.email, p.phone
  from asso.members m
  join core.persons p on p.id = m.person_id;

create view api.v_asso_dues with (security_invoker = true) as
  select
    d.id, d.due_number, d.period_year, d.period_quarter,
    d.amount_xaf, d.paid_xaf, d.status, d.due_date, d.created_at,
    m.member_number, p.full_name
  from asso.dues d
  join asso.members m on m.id = d.member_id
  join core.persons p on p.id = m.person_id;

-- RPC : Créer une candidature d'adhésion
create function api.application_create(
  p_membership_type text    default 'standard',
  p_motivation      text    default null,
  p_idempotency_key text    default null
) returns jsonb
language plpgsql
security definer
set search_path = api, asso, app, public
as $$
declare
  v_number  text;
  v_id      uuid;
  v_person  uuid;
  v_idem    jsonb;
begin
  v_person := app.current_person_id();
  if v_person is null then
    perform app.raise_error('NO_PERSON', 'Profil personne introuvable', 400);
  end if;

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'application_create');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  v_number := app.next_number('APPLICATION');

  insert into asso.applications
    (application_number, person_id, membership_type, motivation, status)
  values
    (v_number, v_person, p_membership_type, p_motivation, 'submitted')
  returning id into v_id;

  perform app.audit('application.created', 'asso.application', v_id,
    jsonb_build_object('number', v_number, 'type', p_membership_type),
    null, 'success');

  if p_idempotency_key is not null then
    perform app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('id', v_id, 'application_number', v_number));
  end if;

  return jsonb_build_object('id', v_id, 'application_number', v_number);
end;
$$;

grant execute on function api.application_create to authenticated;

-- RPC : Enregistrer un paiement de cotisation (avec idempotence)
create function api.due_payment_record(
  p_due_id          uuid,
  p_amount_xaf      bigint,
  p_method          text,
  p_reference       text    default null,
  p_idempotency_key text    default null
) returns jsonb
language plpgsql
security definer
set search_path = api, asso, app, public
as $$
declare
  v_id    uuid;
  v_idem  jsonb;
begin
  perform app.require_permission('asso.dues.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'due_payment_record');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  insert into asso.due_payments (due_id, amount_xaf, method, reference, received_by)
  values (p_due_id, p_amount_xaf, p_method, p_reference, auth.uid())
  returning id into v_id;

  perform app.audit('due.payment.recorded', 'asso.due', p_due_id,
    jsonb_build_object('amount_xaf', p_amount_xaf, 'method', p_method),
    null, 'success');

  if p_idempotency_key is not null then
    perform app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('id', v_id));
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

grant execute on function api.due_payment_record to authenticated;
