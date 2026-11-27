-- Migration : LOT 02 T02.12 / T02.13 — Machine à états globale, api.me
-- BS4U Digital Ecosystem v2.0

-- =====================================================================
-- Seed des transitions autorisées par machine à états
-- (voir docs/05_STATE_MACHINES.md)
-- =====================================================================

-- Commandes BS4U (biz_order_status)
insert into app.allowed_transitions (entity, from_state, to_state) values
  ('biz_order_status', 'draft',       'confirmed'),
  ('biz_order_status', 'draft',       'cancelled'),
  ('biz_order_status', 'confirmed',   'in_production'),
  ('biz_order_status', 'confirmed',   'cancelled'),
  ('biz_order_status', 'in_production','qc'),
  ('biz_order_status', 'in_production','confirmed'),
  ('biz_order_status', 'qc',          'ready'),
  ('biz_order_status', 'qc',          'in_production'),
  ('biz_order_status', 'ready',       'delivered'),
  ('biz_order_status', 'ready',       'cancelled'),
  ('biz_order_status', 'delivered',   'closed'),
  ('biz_order_status', 'cancelled',   'confirmed')
on conflict do nothing;

-- Factures (biz_invoice_status)
insert into app.allowed_transitions (entity, from_state, to_state) values
  ('biz_invoice_status', 'draft',    'sent'),
  ('biz_invoice_status', 'draft',    'void'),
  ('biz_invoice_status', 'sent',     'partial'),
  ('biz_invoice_status', 'sent',     'paid'),
  ('biz_invoice_status', 'sent',     'overdue'),
  ('biz_invoice_status', 'sent',     'void'),
  ('biz_invoice_status', 'partial',  'paid'),
  ('biz_invoice_status', 'partial',  'overdue'),
  ('biz_invoice_status', 'overdue',  'paid'),
  ('biz_invoice_status', 'overdue',  'void'),
  ('biz_invoice_status', 'paid',     'void')
on conflict do nothing;

-- Candidatures d'adhésion (asso_application_status)
insert into app.allowed_transitions (entity, from_state, to_state) values
  ('asso_application_status', 'draft',         'submitted'),
  ('asso_application_status', 'submitted',     'under_review'),
  ('asso_application_status', 'submitted',     'returned_for_completion'),
  ('asso_application_status', 'under_review',  'approved'),
  ('asso_application_status', 'under_review',  'rejected'),
  ('asso_application_status', 'under_review',  'returned_for_completion'),
  ('asso_application_status', 'returned_for_completion', 'submitted'),
  ('asso_application_status', 'approved',      'active'),
  ('asso_application_status', 'rejected',      'submitted')
on conflict do nothing;

-- Adhésions (asso_membership_status)
insert into app.allowed_transitions (entity, from_state, to_state) values
  ('asso_membership_status', 'pending_payment', 'active'),
  ('asso_membership_status', 'active',          'suspended'),
  ('asso_membership_status', 'active',          'resigned'),
  ('asso_membership_status', 'active',          'expelled'),
  ('asso_membership_status', 'active',          'deceased'),
  ('asso_membership_status', 'active',          'expired'),
  ('asso_membership_status', 'suspended',       'active'),
  ('asso_membership_status', 'suspended',       'expelled'),
  ('asso_membership_status', 'expired',         'active')
on conflict do nothing;

-- Profils Discover (disc_profile_status)
insert into app.allowed_transitions (entity, from_state, to_state) values
  ('disc_profile_status', 'draft',       'submitted'),
  ('disc_profile_status', 'submitted',   'approved'),
  ('disc_profile_status', 'submitted',   'rejected'),
  ('disc_profile_status', 'approved',    'suspended'),
  ('disc_profile_status', 'approved',    'draft'),
  ('disc_profile_status', 'rejected',    'draft'),
  ('disc_profile_status', 'suspended',   'approved'),
  ('disc_profile_status', 'suspended',   'draft')
on conflict do nothing;

-- =====================================================================
-- Vue API : transitions autorisées (utile côté frontend)
-- =====================================================================
create or replace view api.v_allowed_transitions
  with (security_invoker = true)
as
  select entity, from_state, to_state
  from app.allowed_transitions
  order by entity, from_state, to_state;

grant select on api.v_allowed_transitions to authenticated;

-- =====================================================================
-- api.me() — profil complet de l'utilisateur courant
-- =====================================================================
create or replace function api.me()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_result  jsonb;
begin
  if v_user_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'user_id',       up.user_id,
    'status',        up.status,
    'theme',         up.theme,
    'person',        jsonb_build_object(
      'id',          p.id,
      'first_name',  p.first_name,
      'last_name',   p.last_name,
      'display_name',p.display_name,
      'email',       p.email,
      'phone',       p.phone_e164,
      'is_minor',    p.is_minor
    ),
    'permissions',   coalesce((
      select jsonb_agg(distinct perm.code)
      from core.user_role_assignments ura
      join core.role_permissions rp on rp.role_id = ura.role_id
      join core.permissions perm on perm.id = rp.permission_id
      where ura.user_id = v_user_id
        and ura.revoked_at is null
        and now() >= ura.valid_from
        and (ura.valid_until is null or now() < ura.valid_until)
    ), '[]'::jsonb),
    'roles',         coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',       r.code,
        'label_fr',   r.label_fr,
        'domain',     r.domain,
        'scope_type', ura.scope_type,
        'scope_id',   ura.scope_id
      ))
      from core.user_role_assignments ura
      join core.roles r on r.id = ura.role_id
      where ura.user_id = v_user_id
        and ura.revoked_at is null
        and now() >= ura.valid_from
        and (ura.valid_until is null or now() < ura.valid_until)
    ), '[]'::jsonb)
  ) into v_result
  from core.user_profiles up
  join core.persons p on p.id = up.person_id
  where up.user_id = v_user_id;

  return v_result;
end;
$$;

grant execute on function api.me() to authenticated;

-- Vue pratique
create or replace view api.v_me
  with (security_invoker = true)
as
  select api.me() as profile;

grant select on api.v_me to authenticated;

comment on function api.me() is 'Profil complet de l''utilisateur connecté : personne, rôles, permissions effectives';
