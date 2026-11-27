-- LOT 05 — Secrétariat : Modèles et Documents

-- ─── Modèles de documents ──────────────────────────────────────────────────

create table biz.document_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  category        text not null check (category in (
                    'contract','quote_template','invoice_template',
                    'letter','certificate','report','other')),
  content_html    text not null default '',
  variables       jsonb not null default '[]',   -- [{name, label, type}]
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_document_templates_touch
  before update on biz.document_templates
  for each row execute function app.touch_row();

-- ─── Documents générés ─────────────────────────────────────────────────────

create table biz.documents (
  id              uuid primary key default gen_random_uuid(),
  document_number text unique not null,          -- DOC-YYYY-NNNNNN
  template_id     uuid references biz.document_templates(id),
  customer_id     uuid references biz.customers(id),
  order_id        uuid references biz.service_orders(id),
  title           text not null,
  content_html    text not null default '',
  variables_data  jsonb not null default '{}',
  status          text not null default 'draft'
                  check (status in ('draft','review','approved','sent','archived')),
  file_id         uuid,                          -- core.files FK (réf. stockage)
  signed_at       timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_documents_touch
  before update on biz.documents
  for each row execute function app.touch_row();

-- Index
create index ix_documents_customer  on biz.documents(customer_id);
create index ix_documents_status    on biz.documents(status);
create index ix_documents_created   on biz.documents(created_at desc);

-- RLS
alter table biz.document_templates enable row level security;
alter table biz.documents           enable row level security;

create policy "doc_tpl read"  on biz.document_templates for select using (app.has_permission('biz.documents.read'));
create policy "doc_tpl write" on biz.document_templates for all   using (app.has_permission('biz.documents.write'));
create policy "doc read"      on biz.documents for select          using (app.has_permission('biz.documents.read'));
create policy "doc write"     on biz.documents for all             using (app.has_permission('biz.documents.write'));

-- Transitions autorisées pour les documents
insert into app.allowed_transitions (entity_type, from_status, to_status) values
  ('biz.document', 'draft',   'review'),
  ('biz.document', 'draft',   'approved'),
  ('biz.document', 'review',  'approved'),
  ('biz.document', 'review',  'draft'),
  ('biz.document', 'approved','sent'),
  ('biz.document', 'approved','archived'),
  ('biz.document', 'sent',    'archived');

-- Vues API
create view api.v_documents with (security_invoker = true) as
  select
    d.id, d.document_number, d.title, d.status,
    d.created_at, d.updated_at, d.sent_at, d.signed_at,
    t.name   as template_name, t.category as template_category,
    c.display_name as customer_name, c.customer_number
  from biz.documents d
  left join biz.document_templates t on t.id = d.template_id
  left join biz.customers c on c.id = d.customer_id;

create view api.v_document_templates with (security_invoker = true) as
  select * from biz.document_templates where is_active = true;

-- RPC : Créer un document depuis un modèle
create function api.document_create(
  p_template_id     uuid,
  p_title           text,
  p_customer_id     uuid    default null,
  p_order_id        uuid    default null,
  p_variables_data  jsonb   default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = api, biz, app, public
as $$
declare
  v_number  text;
  v_id      uuid;
  v_content text;
begin
  perform app.require_permission('biz.documents.write');

  -- Nombre de série DOC (utilise INVOICE pour l'instant, à créer séparément si besoin)
  v_number := 'DOC-' || to_char(now(), 'YYYY') || '-' || lpad(
    (select coalesce(max(substr(document_number, 10)::int), 0) + 1
     from biz.documents
     where document_number like 'DOC-' || to_char(now(), 'YYYY') || '-%')::text,
    6, '0');

  select content_html into v_content
  from biz.document_templates where id = p_template_id;

  insert into biz.documents
    (document_number, template_id, customer_id, order_id, title, content_html, variables_data, created_by)
  values
    (v_number, p_template_id, p_customer_id, p_order_id, p_title,
     coalesce(v_content, ''), p_variables_data, auth.uid())
  returning id into v_id;

  perform app.audit('document.created', 'biz.document', v_id,
    jsonb_build_object('number', v_number, 'template_id', p_template_id),
    null, 'success');

  return jsonb_build_object('id', v_id, 'document_number', v_number);
end;
$$;

grant execute on function api.document_create to authenticated;

-- RPC : Changer le statut d'un document
create function api.document_transition(
  p_document_id uuid,
  p_new_status  text
) returns void
language plpgsql
security definer
set search_path = api, biz, app, public
as $$
declare
  v_current text;
begin
  perform app.require_permission('biz.documents.write');
  select status into v_current from biz.documents where id = p_document_id;
  perform app.assert_transition('biz.document', v_current, p_new_status);
  update biz.documents
  set status = p_new_status,
      sent_at = case when p_new_status = 'sent' then now() else sent_at end
  where id = p_document_id;
  perform app.audit('document.transition', 'biz.document', p_document_id,
    jsonb_build_object('from', v_current, 'to', p_new_status), null, 'success');
end;
$$;

grant execute on function api.document_transition to authenticated;

-- Données de départ : modèles d'exemple
insert into biz.document_templates (name, category, content_html, variables) values
  ('Contrat de prestation', 'contract',
   '<h1>CONTRAT DE PRESTATION DE SERVICES</h1><p>Entre BS4U et {{client_name}}</p><p>Pour la somme de {{amount}} FCFA</p>',
   '[{"name":"client_name","label":"Nom du client","type":"text"},{"name":"amount","label":"Montant FCFA","type":"number"}]'),
  ('Certificat de formation', 'certificate',
   '<h1>CERTIFICAT DE FORMATION</h1><p>Délivré à {{participant_name}} le {{date}}</p><p>Formation : {{training_name}}</p>',
   '[{"name":"participant_name","label":"Nom du participant","type":"text"},{"name":"date","label":"Date","type":"date"},{"name":"training_name","label":"Formation","type":"text"}]'),
  ('Lettre officielle', 'letter',
   '<p>Yaoundé, le {{date}}</p><p>Objet : {{subject}}</p><p>{{body}}</p><p>La Direction de BS4U</p>',
   '[{"name":"date","label":"Date","type":"date"},{"name":"subject","label":"Objet","type":"text"},{"name":"body","label":"Corps du message","type":"textarea"}]');
