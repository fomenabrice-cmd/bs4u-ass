-- Migration : LOT 02 T02.02 — Fonctions utilitaires (schéma app)
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- Trigger : mettre à jour updated_at, updated_by, version
-- =====================================================================
create or replace function app.touch_row()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.version    := old.version + 1;
  return new;
end;
$$;

-- =====================================================================
-- Trigger : interdire UPDATE et DELETE sur les tables append-only
-- =====================================================================
create or replace function app.forbid_update_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Cette table est en append-only. Correction = contre-écriture.'
    using errcode = '23000', hint = 'append_only_violation';
end;
$$;

-- =====================================================================
-- Erreur standard JSON (format uniforme pour les RPC)
-- Usage : select app.raise_error('PERMISSION_DENIED', 'Accès refusé', '{}')
-- =====================================================================
create or replace function app.raise_error(
  p_code    text,
  p_message text,
  p_data    jsonb default '{}'
) returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception using
    errcode = 'P0001',
    message = p_code,
    detail  = p_message,
    hint    = p_data::text;
end;
$$;

-- =====================================================================
-- Helpers d'identité (réutilisés partout dans les RLS et RPC)
-- =====================================================================

create or replace function app.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from core.persons p
  where p.user_id = auth.uid()
  limit 1;
$$;

create or replace function app.current_employee_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select e.id
  from core.employees e
  join core.persons p on p.id = e.person_id
  where p.user_id = auth.uid()
    and e.is_active = true
  limit 1;
$$;

create or replace function app.current_member_profile_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select mp.id
  from asso.member_profiles mp
  join core.persons p on p.id = mp.person_id
  where p.user_id = auth.uid()
  limit 1;
$$;

create or replace function app.current_learner_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select lr.id
  from biz.learners lr
  join core.persons p on p.id = lr.person_id
  where p.user_id = auth.uid()
  limit 1;
$$;

create or replace function app.current_customer_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id
  from biz.customers c
  where c.portal_user_id = auth.uid();
$$;

-- =====================================================================
-- Vérification de transitions d'état autorisées
-- Utilisée par les machine à états
-- =====================================================================
create table if not exists app.allowed_transitions (
  id         uuid primary key default gen_random_uuid(),
  entity     text not null,  -- ex. 'biz_order_status'
  from_state text not null,
  to_state   text not null,
  unique (entity, from_state, to_state)
);

create or replace function app.assert_transition(
  p_entity     text,
  p_from_state text,
  p_to_state   text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from app.allowed_transitions
    where entity = p_entity
      and from_state = p_from_state
      and to_state = p_to_state
  ) then
    perform app.raise_error(
      'INVALID_TRANSITION',
      format('Transition %s → %s non autorisée pour %s', p_from_state, p_to_state, p_entity)
    );
  end if;
end;
$$;

comment on function app.touch_row() is 'Trigger : met à jour updated_at, updated_by, version';
comment on function app.forbid_update_delete() is 'Trigger : table append-only — refuse UPDATE/DELETE';
comment on function app.assert_transition(text,text,text) is 'Vérifie qu''une transition d''état est autorisée';
