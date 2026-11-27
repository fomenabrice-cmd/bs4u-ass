import { supabase } from "../../lib/supabase";
import type { DashboardKpi } from "./types";

export const dashboardService = {
  async getKpis(): Promise<DashboardKpi | null> {
    const { data, error } = await supabase
      .from("v_dashboard_finance" as never)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data as DashboardKpi | null;
  },

  async getPeriodsSummary() {
    const { data, error } = await supabase
      .from("v_finance_periods_summary" as never)
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
