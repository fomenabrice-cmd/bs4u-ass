-- Finance F5/F9 — Clôtures journalières MoMo, événements opérateur, barèmes de commission
-- Prérequis : momo.accounts (20261121001500), biz.financial_periods (20261126000100)

-- ─── Clôtures journalières MoMo ─────────────────────────────────────────────

create table momo.daily_closings (
  id                      uuid primary key default gen_random_uuid(),
  account_id              uuid not null references momo.accounts(id),
  closing_date            date not null,
  opening_balance_xaf     bigint not null default 0,
  total_deposits_xaf      bigint not null default 0 check (total_deposits_xaf >= 0),
  total_withdrawals_xaf   bigint not null default 0 check (total_withdrawals_xaf >= 0),
  total_commissions_xaf   bigint not null default 0 check (total_commissions_xaf >= 0),
  closing_balance_xaf     bigint not null,
  discrepancy_xaf         bigint generated always as (
    opening_balance_xaf + total_deposits_xaf - total_withdrawals_xaf - closing_balance_xaf
  ) stored,
  status                  text not null default 'open'
                          check (status in ('open','closed','reconciled')),
  financial_period_id     uuid references biz.financial_periods(id),
  closed_by               uuid references auth.users(id),
  closed_at               timestamptz,
  created_at              timestamptz not null default now(),
  unique (account_id, closing_date)
);

-- ─── Événements opérateur (import relevé, correction, notification) ──────────

create table momo.provider_events (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references momo.accounts(id),
  event_type      text not null
                  check (event_type in (
                    'balance_check','statement_import','manual_correction','operator_notification'
                  )),
  event_data      jsonb,
  source          text not null default 'manual'
                  check (source in ('manual','api_webhook','import','system')),
  processed_at    timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- ─── Barèmes de commission BS4U (calcul côté serveur) ───────────────────────

create table momo.commission_rules (
  id                  uuid primary key default gen_random_uuid(),
  operator            text not null check (operator in ('mtn','orange','all')),
  tx_type             text not null check (tx_type in ('deposit','withdrawal','transfer_out','payment_out','all')),
  commission_type     text not null check (commission_type in ('fixed','percentage','tiered')),
  fixed_xaf           bigint,
  percentage_rate     numeric(5,4),
  tiers               jsonb,              -- [{min_xaf, max_xaf, rate_pct}]
  min_commission_xaf  bigint,
  max_commission_xaf  bigint,
  effective_from      date not null default current_date,
  effective_to        date,
  note                text
);

-- RPC : calculer la commission BS4U pour une transaction
create function api.momo_calculate_commission(
  p_operator  text,
  p_tx_type   text,
  p_amount_xaf bigint
) returns bigint
language plpgsql stable security definer
set search_path = api, momo, public
as $$
declare
  v_rule  momo.commission_rules;
  v_comm  bigint := 0;
  v_tier  jsonb;
begin
  -- Règle la plus précise (opérateur exact > 'all')
  select * into v_rule
  from momo.commission_rules
  where (operator = p_operator or operator = 'all')
    and (tx_type = p_tx_type or tx_type = 'all')
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date)
  order by (operator = p_operator) desc, (tx_type = p_tx_type) desc
  limit 1;

  if not found then return 0; end if;

  case v_rule.commission_type
    when 'fixed' then
      v_comm := coalesce(v_rule.fixed_xaf, 0);
    when 'percentage' then
      v_comm := round(p_amount_xaf * coalesce(v_rule.percentage_rate, 0));
    when 'tiered' then
      for v_tier in select * from jsonb_array_elements(v_rule.tiers) loop
        if p_amount_xaf >= (v_tier->>'min_xaf')::bigint
           and (v_tier->>'max_xaf' is null or p_amount_xaf <= (v_tier->>'max_xaf')::bigint)
        then
          v_comm := round(p_amount_xaf * (v_tier->>'rate_pct')::numeric / 100);
          exit;
        end if;
      end loop;
  end case;

  -- Clamp min/max
  if v_rule.min_commission_xaf is not null then
    v_comm := greatest(v_comm, v_rule.min_commission_xaf);
  end if;
  if v_rule.max_commission_xaf is not null then
    v_comm := least(v_comm, v_rule.max_commission_xaf);
  end if;

  return v_comm;
end;
$$;

grant execute on function api.momo_calculate_commission to authenticated;

-- Indexes
create index ix_momo_daily_closings_date on momo.daily_closings(closing_date desc);
create index ix_momo_daily_closings_acc  on momo.daily_closings(account_id);
create index ix_momo_provider_events_acc on momo.provider_events(account_id);

-- RLS
alter table momo.daily_closings   enable row level security;
alter table momo.provider_events  enable row level security;
alter table momo.commission_rules enable row level security;

create policy "momo dc read"  on momo.daily_closings
  for select using (app.has_permission('momo.accounts.read'));
create policy "momo dc write" on momo.daily_closings
  for all using (app.has_permission('momo.accounts.write'));
create policy "momo pe read"  on momo.provider_events
  for select using (app.has_permission('momo.accounts.read'));
create policy "momo pe write" on momo.provider_events
  for insert with check (app.has_permission('momo.accounts.write'));
create policy "momo cr read"  on momo.commission_rules
  for select using (app.has_permission('momo.accounts.read'));
create policy "momo cr write" on momo.commission_rules
  for all using (app.has_permission('momo.accounts.write'));
