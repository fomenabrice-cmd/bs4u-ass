-- M-08 : RPC POS — get_pos_products, create_pos_sale
-- Dépend : biz.products, biz.stock_movements, biz.pos_sales, biz.pos_sale_lines
--          public.cash_sessions, public.cash_movements (via search_path)

-- ─── Produits POS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION api.get_pos_products()
RETURNS TABLE (
  id          uuid,
  sku         text,
  name        text,
  unit_price  bigint,
  category    text,
  track_stock boolean,
  qty_stock   bigint,
  min_stock   int
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = api, biz, public, app
AS $$
  SELECT
    p.id,
    p.sku,
    p.name,
    p.price_xaf   AS unit_price,
    p.category,
    true          AS track_stock,
    COALESCE(SUM(sm.qty), 0)::bigint AS qty_stock,
    0             AS min_stock
  FROM biz.products p
  LEFT JOIN biz.stock_movements sm ON sm.product_id = p.id
  WHERE p.is_active = true
  GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION api.get_pos_products() TO authenticated;

-- ─── Vente POS atomique ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION api.create_pos_sale(
  p_items           jsonb,          -- [{product_id, name, qty, unit_price}]
  p_client_name     text    DEFAULT NULL,
  p_payment_method  text    DEFAULT 'cash',
  p_subtotal        bigint  DEFAULT 0,
  p_discount        bigint  DEFAULT 0,
  p_total           bigint  DEFAULT 0,
  p_amount_received bigint  DEFAULT 0,
  p_cash_session_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = api, biz, public, app
AS $$
DECLARE
  v_sale_id    uuid;
  v_sale_no    text;
  v_item       jsonb;
  v_pid        uuid;
  v_qty        int;
  v_price      bigint;
  v_session    public.cash_sessions%ROWTYPE;
BEGIN
  PERFORM app.require_permission('biz.cash.manage');

  -- Numéro de ticket séquentiel
  SELECT 'TK-' || to_char(now(), 'YYYYMMDD') || '-' ||
         lpad(COALESCE(
           (SELECT COUNT(*) FROM biz.pos_sales
            WHERE created_at >= current_date)::int + 1, 1
         )::text, 4, '0')
  INTO v_sale_no;

  -- Récupérer la session si fournie et ouverte
  IF p_cash_session_id IS NOT NULL THEN
    SELECT * INTO v_session
    FROM public.cash_sessions
    WHERE id = p_cash_session_id AND status = 'open';
  END IF;

  -- Créer la vente POS
  INSERT INTO biz.pos_sales (
    sale_number, session_id, total_xaf, paid_xaf, payment_method, created_by
  ) VALUES (
    v_sale_no,
    -- session_id dans biz.pos_sales est NOT NULL — on met NULL si pas de session biz
    -- shortcut: biz.pos_sales.session_id référence biz.cash_sessions, pas public.cash_sessions
    -- on le laisse NULL pour compatibilité (FK nullable non contrainte ici)
    NULL,
    p_total,
    p_amount_received,
    CASE p_payment_method
      WHEN 'Espèces'      THEN 'cash'
      WHEN 'Orange Money' THEN 'orange_money'
      WHEN 'MTN MoMo'     THEN 'mtn_momo'
      ELSE 'cash'
    END,
    auth.uid()
  )
  RETURNING id INTO v_sale_id;

  -- Lignes + mouvements de stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pid   := (v_item->>'product_id')::uuid;
    v_qty   := (v_item->>'qty')::int;
    v_price := (v_item->>'unit_price')::bigint;

    INSERT INTO biz.pos_sale_lines (sale_id, product_id, label, qty, unit_price_xaf)
    VALUES (v_sale_id, v_pid, v_item->>'name', v_qty, v_price);

    INSERT INTO biz.stock_movements (product_id, movement_type, qty, reference, created_by)
    VALUES (v_pid, 'out', -v_qty, v_sale_no, auth.uid());
  END LOOP;

  -- Mouvement de caisse si paiement espèces + session ouverte
  IF p_payment_method IN ('Espèces', 'cash') AND v_session.id IS NOT NULL THEN
    INSERT INTO public.cash_movements (
      organization_id, cash_session_id, cash_register_id,
      movement_type, amount_xaf, description,
      related_type, related_id, performed_by
    ) VALUES (
      v_session.organization_id,
      v_session.id,
      v_session.cash_register_id,
      'sale',
      p_total,
      COALESCE('Vente POS ' || v_sale_no || NULLIF(' · ' || p_client_name, ' · '), 'Vente POS ' || v_sale_no),
      'pos_sale',
      v_sale_id,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object('ticket_no', v_sale_no, 'sale_id', v_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION api.create_pos_sale(jsonb, text, text, bigint, bigint, bigint, bigint, uuid) TO authenticated;
