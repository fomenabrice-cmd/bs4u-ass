import { supabase } from "../../lib/supabase";
import type { Reserve, AllocationRule } from "./types";

export const reserveService = {
  async list(): Promise<Reserve[]> {
    const { data, error } = await supabase
      .from("v_reserves" as never)
      .select("*");
    if (error) throw error;
    return data as Reserve[];
  },

  async listRules(): Promise<AllocationRule[]> {
    const { data, error } = await supabase
      .from("allocation_rules" as never)
      .select("*")
      .order("effective_from", { ascending: false });
    if (error) throw error;
    return data as AllocationRule[];
  },

  async allocateMargin(params: {
    sourceType: string;
    sourceId: string;
    marginXaf: number;
    financialPeriodId?: string;
    idempotencyKey?: string;
  }) {
    const { data, error } = await supabase.rpc("allocate_margin" as never, {
      p_source_type: params.sourceType,
      p_source_id: params.sourceId,
      p_margin_xaf: params.marginXaf,
      p_financial_period_id: params.financialPeriodId ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
    });
    if (error) throw error;
    return data;
  },
};
