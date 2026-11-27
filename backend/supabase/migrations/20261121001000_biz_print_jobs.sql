-- LOT 04 — File d'impression (biz.print_jobs)

create table biz.print_jobs (
  id              uuid primary key default gen_random_uuid(),
  job_ref         text unique not null,            -- IMP-YYYY-NNNNNN
  order_id        uuid references biz.service_orders(id),
  order_line_id   uuid references biz.order_lines(id),
  customer_id     uuid not null references biz.customers(id),
  status          text not null default 'pending'
                  check (status in ('pending','printing','done','error','cancelled')),
  paper_size      text not null default 'A4' check (paper_size in ('A4','A3','A5','A6')),
  color_mode      text not null default 'nb'    check (color_mode in ('nb','color')),
  sides           text not null default 'recto' check (sides in ('recto','recto-verso')),
  pages           int not null check (pages > 0),
  copies          int not null default 1 check (copies > 0),
  unit_price_xaf  bigint not null check (unit_price_xaf >= 0),
  total_xaf       bigint generated always as (
                    pages * copies * unit_price_xaf / case when sides = 'recto-verso' then 2 else 1 end
                  ) stored,
  notes           text,
  queued_at       timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  error_message   text,
  created_by      uuid references auth.users(id),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  version         int not null default 1
);

create trigger biz_print_jobs_touch
  before update on biz.print_jobs
  for each row execute function app.touch_row();

create index ix_print_jobs_status    on biz.print_jobs(status) where status in ('pending','printing');
create index ix_print_jobs_customer  on biz.print_jobs(customer_id);
create index ix_print_jobs_order     on biz.print_jobs(order_id) where order_id is not null;
create index ix_print_jobs_queued_at on biz.print_jobs(queued_at desc);

-- RLS
alter table biz.print_jobs enable row level security;

create policy "employees read print_jobs"
  on biz.print_jobs for select
  using (app.has_permission('biz.printing.view_queue'));

create policy "employees manage print_jobs"
  on biz.print_jobs for all
  using (app.has_permission('biz.printing.manage_queue'));

-- Vue API avec Realtime (pour la file en temps réel)
create view api.v_print_queue with (security_invoker = true) as
  select
    pj.id, pj.job_ref, pj.status,
    pj.paper_size, pj.color_mode, pj.sides,
    pj.pages, pj.copies, pj.total_xaf,
    pj.queued_at, pj.started_at, pj.completed_at,
    c.display_name as customer_name,
    c.customer_number
  from biz.print_jobs pj
  join biz.customers c on c.id = pj.customer_id
  where pj.status in ('pending','printing')
  order by pj.queued_at;

-- Table des règles de tarification d'impression
create table biz.print_pricing_rules (
  id              uuid primary key default gen_random_uuid(),
  paper_size      text not null check (paper_size in ('A4','A3','A5','A6')),
  color_mode      text not null check (color_mode in ('nb','color')),
  min_qty         int not null default 1,
  price_xaf       bigint not null check (price_xaf > 0),
  effective_from  date not null default current_date,
  effective_until date,
  unique (paper_size, color_mode, min_qty, effective_from)
);

-- Tarifs initiaux (en FCFA entiers)
insert into biz.print_pricing_rules (paper_size, color_mode, min_qty, price_xaf) values
  ('A4', 'nb',    1,    25),
  ('A4', 'nb',    100,  20),
  ('A4', 'color', 1,    100),
  ('A4', 'color', 50,   80),
  ('A3', 'nb',    1,    50),
  ('A3', 'color', 1,    200),
  ('A5', 'nb',    1,    15),
  ('A5', 'color', 1,    60);

-- Vue API des tarifs
create view api.v_print_pricing with (security_invoker = true) as
  select paper_size, color_mode, min_qty, price_xaf, effective_from, effective_until
  from biz.print_pricing_rules
  where (effective_until is null or effective_until >= current_date)
  order by paper_size, color_mode, min_qty;
