-- LOT 09/XX — Dépenses métier (charges, loyer, salaires…)

create table biz.expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_number  text unique not null,  -- DEP-YYYY-NNNNNN
  label           text not null,
  category        text not null
                  check (category in ('loyer','charges_fixes','fournitures','salaires','maintenance','marketing','transport','autre')),
  amount_xaf      bigint not null check (amount_xaf > 0),
  method          text not null
                  check (method in ('cash','mtn_momo','orange_money','transfer','cheque','other')),
  has_receipt     boolean not null default false,
  expense_date    date not null default current_date,
  notes           text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index ix_expenses_date     on biz.expenses(expense_date);
create index ix_expenses_category on biz.expenses(category);

alter table biz.expenses enable row level security;

create policy "expenses read"   on biz.expenses for select  using (app.has_permission('biz.expenses.create') or app.has_permission('biz.expenses.approve'));
create policy "expenses insert" on biz.expenses for insert  with check (app.has_permission('biz.expenses.create'));
create policy "expenses update" on biz.expenses for update  using (app.has_permission('biz.expenses.approve'));

-- Série de numérotation
insert into ops.number_series (series_code, prefix, pattern, reset_cycle, description)
values ('EXPENSE', 'DEP', 'DEP-{YYYY}-{NNNNNN}', 'yearly', 'Dépenses métier')
on conflict (series_code) do nothing;

-- Vue API
create view api.v_depenses with (security_invoker = true) as
  select
    id,
    expense_number,
    label,
    category,
    amount_xaf,
    method,
    has_receipt,
    expense_date,
    notes,
    created_at
  from biz.expenses;

grant select on api.v_depenses to authenticated;
