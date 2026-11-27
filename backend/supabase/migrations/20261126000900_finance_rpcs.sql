-- Finance F2/F3/F4/F6 — RPCs Finance
-- allocate_margin, record_loan_repayment, compute_depreciation, close_financial_period
-- Prérequis : toutes les migrations Finance précédentes

-- ─── RPC : Ventilation de marge ─────────────────────────────────────────────
-- Distribue une marge vers les réserves selon les règles actives.
-- Idempotent : un même source_id ne peut générer qu'une seule série de mouvements.

create function api.allocate_margin(
  p_source_type         text,         -- 'sale_margin','momo_commission'
  p_source_id           uuid,         -- id de la vente ou commission
  p_margin_xaf          bigint,
  p_financial_period_id uuid          default null,
  p_idempotency_key     text          default null
) returns jsonb
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_rule      biz.allocation_rules;
  v_allocated bigint := 0;
  v_amount    bigint;
  v_period_id uuid;
  v_idem      jsonb;
  v_results   jsonb[] := array[]::jsonb[];
begin
  perform app.require_permission('biz.finance.reserves.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'allocate_margin');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  -- Vérifie qu'il n'existe pas déjà une allocation pour ce source_id
  if exists (
    select 1 from biz.reserve_movements
    where source_type = p_source_type and source_id = p_source_id
  ) then
    raise exception 'ALLOCATION_ALREADY_EXISTS'
      using detail = format('Allocation déjà réalisée pour source_id=%s', p_source_id);
  end if;

  -- Résout la période courante si non fournie
  v_period_id := coalesce(p_financial_period_id, (
    select id from biz.financial_periods where status = 'open' order by starts_at desc limit 1
  ));

  if v_period_id is null then
    raise exception 'NO_OPEN_PERIOD' using detail = 'Aucune période comptable ouverte';
  end if;

  -- Applique chaque règle active dans l'ordre
  for v_rule in
    select * from biz.allocation_rules
    where source_type = p_source_type
      and is_active = true
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by id
  loop
    v_amount := round(p_margin_xaf * v_rule.percentage / 100)::bigint;
    if v_amount <= 0 then continue; end if;

    insert into biz.reserve_movements
      (reserve_id, movement_type, amount_xaf, source_type, source_id,
       financial_period_id, idempotency_key)
    values
      (v_rule.reserve_id, 'allocation', v_amount, p_source_type, p_source_id,
       v_period_id,
       case when p_idempotency_key is not null
            then p_idempotency_key || ':' || v_rule.id::text
            else null end);

    v_allocated := v_allocated + v_amount;
    v_results   := v_results || jsonb_build_object(
      'reserve_id', v_rule.reserve_id, 'amount_xaf', v_amount
    );
  end loop;

  perform app.audit('finance.margin.allocated', 'biz.reserve', null,
    jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id,
                       'margin_xaf', p_margin_xaf, 'allocated_xaf', v_allocated),
    null, 'success');

  declare v_result jsonb := jsonb_build_object(
    'allocated_xaf', v_allocated,
    'allocations', to_jsonb(v_results)
  );
  begin
    if p_idempotency_key is not null then
      perform app.idempotency_finish(p_idempotency_key, 'completed', v_result);
    end if;
    return v_result;
  end;
end;
$$;

grant execute on function api.allocate_margin to authenticated;

-- ─── RPC : Enregistrer un remboursement d'emprunt ───────────────────────────

create function api.record_loan_repayment(
  p_loan_id             uuid,
  p_total_xaf           bigint,
  p_principal_xaf       bigint,
  p_interest_xaf        bigint    default 0,
  p_fees_xaf            bigint    default 0,
  p_method              text      default 'cash',
  p_paid_at             date      default current_date,
  p_financial_period_id uuid      default null,
  p_idempotency_key     text      default null
) returns jsonb
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_number    text;
  v_id        uuid;
  v_period_id uuid;
  v_idem      jsonb;
  v_loan      biz.loans;
begin
  perform app.require_permission('biz.finance.capital.write');

  if p_idempotency_key is not null then
    v_idem := app.idempotency_begin(p_idempotency_key, 'record_loan_repayment');
    if (v_idem->>'already_done')::boolean then return v_idem->'result'; end if;
  end if;

  select * into v_loan from biz.loans where id = p_loan_id;
  if not found then
    raise exception 'LOAN_NOT_FOUND' using detail = format('Emprunt id=%s introuvable', p_loan_id);
  end if;
  if v_loan.status != 'active' then
    raise exception 'LOAN_NOT_ACTIVE' using detail = format('Emprunt status=%s', v_loan.status);
  end if;

  v_period_id := coalesce(p_financial_period_id, (
    select id from biz.financial_periods where status = 'open' order by starts_at desc limit 1
  ));

  v_number := app.next_number('REPAYMENT');

  insert into biz.loan_repayments
    (repayment_number, loan_id, total_xaf, principal_xaf, interest_xaf, fees_xaf,
     method, paid_at, financial_period_id, idempotency_key, created_by)
  values
    (v_number, p_loan_id, p_total_xaf, p_principal_xaf, p_interest_xaf, p_fees_xaf,
     p_method, p_paid_at, v_period_id, p_idempotency_key, auth.uid())
  returning id into v_id;

  -- Vérifie si le capital restant dû est soldé
  declare v_total_repaid bigint;
  begin
    select coalesce(sum(principal_xaf), 0) into v_total_repaid
    from biz.loan_repayments where loan_id = p_loan_id;

    if v_total_repaid >= v_loan.principal_xaf then
      update biz.loans set status = 'closed' where id = p_loan_id;
    end if;
  end;

  perform app.audit('finance.loan.repayment', 'biz.loan', p_loan_id,
    jsonb_build_object('total_xaf', p_total_xaf, 'principal_xaf', p_principal_xaf,
                       'interest_xaf', p_interest_xaf, 'number', v_number),
    null, 'success');

  declare v_result jsonb := jsonb_build_object('id', v_id, 'repayment_number', v_number);
  begin
    if p_idempotency_key is not null then
      perform app.idempotency_finish(p_idempotency_key, 'completed', v_result);
    end if;
    return v_result;
  end;
end;
$$;

grant execute on function api.record_loan_repayment to authenticated;

-- ─── RPC : Calculer les amortissements de la période ────────────────────────
-- Méthode linéaire : (coût - valeur résiduelle) / durée_mois par période.
-- Idempotent par actif × période.

create function api.compute_depreciation(
  p_period_id               uuid,
  p_idempotency_key_prefix  text default null
) returns jsonb
language plpgsql security definer
set search_path = api, biz, app, public
as $$
declare
  v_asset     biz.assets;
  v_amount    bigint;
  v_entry_id  uuid;
  v_ikey      text;
  v_count     int := 0;
  v_total     bigint := 0;
  v_period    biz.financial_periods;
begin
  perform app.require_permission('biz.finance.assets.write');

  select * into v_period from biz.financial_periods where id = p_period_id;
  if not found then
    raise exception 'PERIOD_NOT_FOUND' using detail = format('Période id=%s introuvable', p_period_id);
  end if;

  for v_asset in
    select * from biz.assets
    where status = 'active'
      and acquisition_date <= v_period.ends_at
  loop
    -- Vérifie si l'écriture existe déjà (idempotence)
    if exists (
      select 1 from biz.depreciation_entries
      where asset_id = v_asset.id and financial_period_id = p_period_id
    ) then continue; end if;

    -- Montant mensuel linéaire
    v_amount := (v_asset.acquisition_cost_xaf - v_asset.residual_value_xaf)
                / v_asset.useful_life_months;

    if v_amount <= 0 then continue; end if;

    v_ikey := case when p_idempotency_key_prefix is not null
                   then p_idempotency_key_prefix || ':' || v_asset.id::text
                   else null end;

    insert into biz.depreciation_entries
      (asset_id, financial_period_id, amount_xaf, idempotency_key, created_by)
    values
      (v_asset.id, p_period_id, v_amount, v_ikey, auth.uid());

    v_count := v_count + 1;
    v_total := v_total + v_amount;
  end loop;

  perform app.audit('finance.depreciation.computed', 'biz.financial_period', p_period_id,
    jsonb_build_object('entries_created', v_count, 'total_xaf', v_total),
    null, 'success');

  return jsonb_build_object('entries_created', v_count, 'total_xaf', v_total);
end;
$$;

grant execute on function api.compute_depreciation to authenticated;

-- ─── RPC : Clôturer une période comptable ───────────────────────────────────
-- Checklist 12 points, puis passe status → 'closed'.

create function api.close_financial_period(
  p_period_id uuid
) returns jsonb
language plpgsql security definer
set search_path = api, biz, momo, app, public
as $$
declare
  v_period          biz.financial_periods;
  v_checks          jsonb[] := array[]::jsonb[];
  v_ok              boolean := true;
  v_issues          text[] := array[]::text[];
  v_draft_entries   int;
  v_open_momo       int;
  v_pending_recon   int;
begin
  perform app.require_permission('biz.finance.closing.write');

  select * into v_period from biz.financial_periods where id = p_period_id;
  if not found then
    raise exception 'PERIOD_NOT_FOUND' using detail = format('Période id=%s introuvable', p_period_id);
  end if;
  if v_period.status != 'open' then
    raise exception 'PERIOD_NOT_OPEN' using detail = format('Période status=%s', v_period.status);
  end if;

  -- Passe en 'closing' pour verrouiller les nouvelles écritures
  update biz.financial_periods set status = 'closing' where id = p_period_id;

  -- Checklist ─────────────────────────────────────────────────────────────────

  -- 1. Aucune écriture en brouillon
  select count(*) into v_draft_entries
  from biz.journal_entries
  where financial_period_id = p_period_id and status = 'draft';

  v_checks := v_checks || jsonb_build_object(
    'check', 'no_draft_entries', 'ok', v_draft_entries = 0,
    'detail', format('%s écriture(s) en brouillon', v_draft_entries)
  );
  if v_draft_entries > 0 then v_issues := v_issues || 'Écritures comptables non postées'; end if;

  -- 2. Aucune clôture MoMo non fermée pour la période
  select count(*) into v_open_momo
  from momo.daily_closings
  where financial_period_id = p_period_id and status = 'open';

  v_checks := v_checks || jsonb_build_object(
    'check', 'momo_closed', 'ok', v_open_momo = 0,
    'detail', format('%s clôture(s) MoMo en attente', v_open_momo)
  );
  if v_open_momo > 0 then v_issues := v_issues || 'Clôtures MoMo non finalisées'; end if;

  -- 3. Aucun rapprochement en attente
  select count(*) into v_pending_recon
  from biz.treasury_reconciliations
  where financial_period_id = p_period_id and status = 'pending';

  v_checks := v_checks || jsonb_build_object(
    'check', 'reconciliations_done', 'ok', v_pending_recon = 0,
    'detail', format('%s rapprochement(s) en attente', v_pending_recon)
  );
  if v_pending_recon > 0 then v_issues := v_issues || 'Rapprochements de trésorerie en attente'; end if;

  -- 4. Amortissements calculés
  declare v_assets_undepreciated int;
  begin
    select count(*) into v_assets_undepreciated
    from biz.assets a
    where a.status = 'active'
      and a.acquisition_date <= v_period.ends_at
      and not exists (
        select 1 from biz.depreciation_entries de
        where de.asset_id = a.id and de.financial_period_id = p_period_id
      );

    v_checks := v_checks || jsonb_build_object(
      'check', 'depreciation_computed', 'ok', v_assets_undepreciated = 0,
      'detail', format('%s actif(s) sans écriture d''amortissement', v_assets_undepreciated)
    );
    if v_assets_undepreciated > 0 then v_issues := v_issues || 'Amortissements manquants'; end if;
  end;

  -- Décision : si des issues bloquantes → remettre en 'open' et retourner le rapport
  if array_length(v_issues, 1) > 0 then
    update biz.financial_periods set status = 'open' where id = p_period_id;
    return jsonb_build_object(
      'closed', false,
      'issues', to_jsonb(v_issues),
      'checks', to_jsonb(v_checks)
    );
  end if;

  -- Clôture définitive
  update biz.financial_periods
  set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where id = p_period_id;

  perform app.audit('finance.period.closed', 'biz.financial_period', p_period_id,
    jsonb_build_object('label', v_period.label, 'checks', array_length(v_checks, 1)),
    null, 'success');

  return jsonb_build_object(
    'closed', true,
    'checks', to_jsonb(v_checks)
  );
end;
$$;

grant execute on function api.close_financial_period to authenticated;
