-- LOT 04/07 — Finance : Devis, Factures, Paiements

-- ─── Devis ──────────────────────────────────────────────────────────────────

create table biz.quotes (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text unique not null,       -- DEV-YYYY-NNNNNN
  customer_id     uuid not null references biz.customers(id),
  order_id        uuid references biz.service_orders(id),
  status          text not null default 'draft'
                  check (status in ('draft','sent','accepted','declined','expired')),
  total_xaf       bigint not null default 0,
  valid_until     date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_quotes_touch before update on biz.quotes for each row execute function app.touch_row();

-- ─── Factures ───────────────────────────────────────────────────────────────

create table biz.invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text unique not null,       -- FAC-YYYY-NNNNNN
  customer_id     uuid not null references biz.customers(id),
  order_id        uuid references biz.service_orders(id),
  status          text not null default 'draft'
                  check (status in ('draft','sent','partial','paid','overdue','void')),
  total_xaf       bigint not null default 0 check (total_xaf >= 0),
  paid_xaf        bigint not null default 0  check (paid_xaf >= 0),
  issued_at       date not null default current_date,
  due_date        date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  created_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_invoices_touch before update on biz.invoices for each row execute function app.touch_row();

-- ─── Paiements (append-only ledger) ────────────────────────────────────────

create table biz.payments (
  id              uuid primary key default gen_random_uuid(),
  payment_number  text unique not null,       -- RCU-YYYY-NNNNNN
  invoice_id      uuid not null references biz.invoices(id),
  customer_id     uuid not null references biz.customers(id),
  amount_xaf      bigint not null check (amount_xaf > 0),
  method          text not null check (method in ('cash','mtn_momo','orange_money','transfer','cheque','other')),
  reference       text,                       -- numéro de transaction MoMo ou chèque
  received_at     timestamptz not null default now(),
  received_by     uuid references auth.users(id),
  notes           text
);

-- append-only : interdit update et delete
create trigger biz_payments_forbid_update_delete
  before update or delete on biz.payments
  for each row execute function app.forbid_update_delete();

-- Mise à jour automatique de paid_xaf sur biz.invoices
create function biz.sync_invoice_paid() returns trigger language plpgsql as $$
begin
  update biz.invoices
  set paid_xaf = (select coalesce(sum(amount_xaf), 0) from biz.payments where invoice_id = new.invoice_id),
      status   = case
        when (select coalesce(sum(amount_xaf), 0) from biz.payments where invoice_id = new.invoice_id) = 0                     then 'sent'
        when (select coalesce(sum(amount_xaf), 0) from biz.payments where invoice_id = new.invoice_id) >= total_xaf            then 'paid'
        else 'partial'
      end
  where id = new.invoice_id;
  return new;
end;
$$;

create trigger biz_payments_sync_invoice
  after insert on biz.payments
  for each row execute function biz.sync_invoice_paid();

-- Index
create index ix_invoices_customer on biz.invoices(customer_id);
create index ix_invoices_status   on biz.invoices(status);
create index ix_invoices_due      on biz.invoices(due_date) where status in ('sent','partial','overdue');
create index ix_payments_invoice  on biz.payments(invoice_id);

-- RLS
alter table biz.invoices  enable row level security;
alter table biz.payments  enable row level security;
alter table biz.quotes    enable row level security;

create policy "finance read invoices"  on biz.invoices for select  using (app.has_permission('biz.finance.invoices.read'));
create policy "finance write invoices" on biz.invoices for all     using (app.has_permission('biz.finance.invoices.write'));
create policy "finance read payments"  on biz.payments for select  using (app.has_permission('biz.finance.payments.read'));
create policy "finance write payments" on biz.payments for insert  with check (app.has_permission('biz.finance.payments.write'));
create policy "biz read quotes"        on biz.quotes   for select  using (app.has_permission('biz.documents.quotes.read'));
create policy "biz write quotes"       on biz.quotes   for all     using (app.has_permission('biz.documents.quotes.write'));

-- Vues API
create view api.v_invoices with (security_invoker = true) as
  select
    i.id, i.invoice_number, i.status, i.total_xaf, i.paid_xaf,
    i.issued_at, i.due_date, i.created_at,
    c.display_name as customer_name, c.customer_number
  from biz.invoices i
  join biz.customers c on c.id = i.customer_id;

-- RPC : Enregistrer un paiement (avec idempotence)
create function api.payment_record(
  p_invoice_id      uuid,
  p_amount_xaf      bigint,
  p_method          text,
  p_reference       text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = api, biz, app, public
as $$
declare
  v_number text;
  v_id     uuid;
  v_idem   jsonb;
begin
  perform app.require_permission('biz.finance.payments.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'payment_record');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  v_number := app.next_number('RECEIPT');

  insert into biz.payments (payment_number, invoice_id, customer_id, amount_xaf, method, reference, received_by)
  select v_number, p_invoice_id, customer_id, p_amount_xaf, p_method, p_reference, auth.uid()
  from biz.invoices where id = p_invoice_id
  returning id into v_id;

  perform app.audit('payment.recorded', 'biz.invoice', p_invoice_id,
    jsonb_build_object('amount_xaf', p_amount_xaf, 'method', p_method, 'number', v_number),
    null, 'success');

  if p_idempotency_key is not null then
    perform app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('id', v_id, 'payment_number', v_number));
  end if;

  return jsonb_build_object('id', v_id, 'payment_number', v_number);
end;
$$;

grant execute on function api.payment_record to authenticated;
