-- LOT 11 — Mobile Money : Comptes, Transactions, Limites

-- ─── Comptes MoMo ──────────────────────────────────────────────────────────

create table momo.accounts (
  id              uuid primary key default gen_random_uuid(),
  operator        text not null check (operator in ('mtn','orange')),
  phone_number    text not null,
  display_name    text not null,
  balance_xaf     bigint not null default 0,       -- solde calculé, mis à jour par trigger
  is_active       boolean not null default true,
  is_primary      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         int not null default 1,
  unique (operator, phone_number)
);

create trigger momo_accounts_touch
  before update on momo.accounts
  for each row execute function app.touch_row();

-- ─── Transactions MoMo (append-only ledger) ────────────────────────────────

create table momo.transactions (
  id              uuid primary key default gen_random_uuid(),
  tx_number       text unique not null,            -- MM-YYYY-NNNNNN
  account_id      uuid not null references momo.accounts(id),
  tx_type         text not null check (tx_type in ('deposit','withdrawal','transfer_in','transfer_out','payment_in','payment_out','fee')),
  amount_xaf      bigint not null check (amount_xaf > 0),
  fee_xaf         bigint not null default 0 check (fee_xaf >= 0),
  net_xaf         bigint generated always as (
                    case when tx_type in ('deposit','transfer_in','payment_in')
                         then amount_xaf - fee_xaf
                         else -(amount_xaf + fee_xaf)
                    end
                  ) stored,
  counterpart     text,                            -- numéro ou nom du correspondant
  reference       text,                            -- réf. opérateur
  customer_id     uuid references biz.customers(id),
  invoice_id      uuid references biz.invoices(id),
  notes           text,
  tx_at           timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- append-only : interdit update et delete
create trigger momo_transactions_forbid_update_delete
  before update or delete on momo.transactions
  for each row execute function app.forbid_update_delete();

-- Mise à jour du solde après chaque transaction
create function momo.sync_account_balance() returns trigger language plpgsql as $$
begin
  update momo.accounts
  set balance_xaf = (
    select coalesce(sum(net_xaf), 0)
    from momo.transactions
    where account_id = new.account_id
  )
  where id = new.account_id;
  return new;
end;
$$;

create trigger momo_transactions_sync_balance
  after insert on momo.transactions
  for each row execute function momo.sync_account_balance();

-- ─── Limites de transaction ────────────────────────────────────────────────

create table momo.limits (
  id              uuid primary key default gen_random_uuid(),
  operator        text not null check (operator in ('mtn','orange','all')),
  tx_type         text not null check (tx_type in ('deposit','withdrawal','transfer_out','payment_out','all')),
  min_xaf         bigint not null default 0,
  max_xaf         bigint not null,
  daily_max_xaf   bigint,
  monthly_max_xaf bigint,
  effective_from  date not null default current_date,
  effective_to    date,
  note            text
);

-- Limites MoMo Cameroun (approximatives, à ajuster)
insert into momo.limits (operator, tx_type, min_xaf, max_xaf, daily_max_xaf, monthly_max_xaf, note) values
  ('mtn',    'deposit',       100,  1000000,  2000000,   10000000, 'MTN MoMo dépôt'),
  ('mtn',    'withdrawal',    500,   500000,  1000000,    5000000, 'MTN MoMo retrait'),
  ('mtn',    'transfer_out',  100,   300000,   600000,    3000000, 'MTN MoMo transfert'),
  ('orange', 'deposit',       100,  1000000,  2000000,   10000000, 'Orange Money dépôt'),
  ('orange', 'withdrawal',    500,   500000,  1000000,    5000000, 'Orange Money retrait'),
  ('orange', 'transfer_out',  100,   300000,   600000,    3000000, 'Orange Money transfert');

-- Index
create index ix_momo_transactions_account on momo.transactions(account_id);
create index ix_momo_transactions_at      on momo.transactions(tx_at desc);
create index ix_momo_transactions_type    on momo.transactions(tx_type);

-- RLS
alter table momo.accounts      enable row level security;
alter table momo.transactions  enable row level security;
alter table momo.limits        enable row level security;

create policy "momo acc read"  on momo.accounts     for select using (app.has_permission('momo.accounts.read'));
create policy "momo acc write" on momo.accounts     for all   using (app.has_permission('momo.accounts.write'));
create policy "momo tx read"   on momo.transactions for select using (app.has_permission('momo.transactions.read'));
create policy "momo tx write"  on momo.transactions for insert with check (app.has_permission('momo.transactions.write'));
create policy "momo lim read"  on momo.limits       for select using (app.has_permission('momo.accounts.read'));

-- Vues API
create view api.v_momo_accounts with (security_invoker = true) as
  select * from momo.accounts where is_active = true;

create view api.v_momo_transactions with (security_invoker = true) as
  select
    t.id, t.tx_number, t.tx_type, t.amount_xaf, t.fee_xaf, t.net_xaf,
    t.counterpart, t.reference, t.tx_at, t.notes,
    a.operator, a.phone_number, a.display_name as account_name,
    c.display_name as customer_name
  from momo.transactions t
  join momo.accounts a on a.id = t.account_id
  left join biz.customers c on c.id = t.customer_id;

-- RPC : Enregistrer une transaction MoMo (avec idempotence)
create function api.momo_record(
  p_account_id      uuid,
  p_tx_type         text,
  p_amount_xaf      bigint,
  p_fee_xaf         bigint    default 0,
  p_counterpart     text      default null,
  p_reference       text      default null,
  p_customer_id     uuid      default null,
  p_invoice_id      uuid      default null,
  p_notes           text      default null,
  p_idempotency_key text      default null
) returns jsonb
language plpgsql
security definer
set search_path = api, momo, app, public
as $$
declare
  v_number text;
  v_id     uuid;
  v_idem   jsonb;
begin
  perform app.require_permission('momo.transactions.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'momo_record');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  v_number := app.next_number('MOMO');

  insert into momo.transactions
    (tx_number, account_id, tx_type, amount_xaf, fee_xaf,
     counterpart, reference, customer_id, invoice_id, notes, created_by)
  values
    (v_number, p_account_id, p_tx_type, p_amount_xaf, p_fee_xaf,
     p_counterpart, p_reference, p_customer_id, p_invoice_id, p_notes, auth.uid())
  returning id into v_id;

  perform app.audit('momo.transaction.recorded', 'momo.transaction', v_id,
    jsonb_build_object('type', p_tx_type, 'amount_xaf', p_amount_xaf, 'number', v_number),
    null, 'success');

  if p_idempotency_key is not null then
    perform app.idempotency_finish(p_idempotency_key, 'completed',
      jsonb_build_object('id', v_id, 'tx_number', v_number));
  end if;

  return jsonb_build_object('id', v_id, 'tx_number', v_number);
end;
$$;

grant execute on function api.momo_record to authenticated;
