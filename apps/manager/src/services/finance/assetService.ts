import { supabase } from "../../lib/supabase";
import type { Asset, CreateAssetInput } from "./types";

export const assetService = {
  async list(): Promise<Asset[]> {
    const { data, error } = await supabase
      .from("v_assets" as never)
      .select("*")
      .order("acquisition_date", { ascending: false });
    if (error) throw error;
    return data as Asset[];
  },

  async create(input: CreateAssetInput): Promise<string> {
    const { data, error } = await supabase.rpc("create_asset" as never, {
      p_name:                 input.name,
      p_asset_category:       input.asset_category,
      p_acquisition_cost_xaf: input.acquisition_cost_xaf,
      p_acquisition_date:     input.acquisition_date,
      p_useful_life_months:   input.useful_life_months,
      p_residual_value_xaf:   input.residual_value_xaf ?? 0,
      p_notes:                input.notes ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async computeDepreciation(periodId: string, idempotencyKeyPrefix?: string) {
    const { data, error } = await supabase.rpc("compute_depreciation" as never, {
      p_period_id:              periodId,
      p_idempotency_key_prefix: idempotencyKeyPrefix ?? null,
    });
    if (error) throw error;
    return data as { entries_created: number; total_xaf: number };
  },

  async getSchedule(assetId: string) {
    const { data, error } = await supabase
      .from("asset_depreciation_schedules" as never)
      .select("*")
      .eq("asset_id", assetId)
      .order("period_number");
    if (error) throw error;
    return data ?? [];
  },
};
