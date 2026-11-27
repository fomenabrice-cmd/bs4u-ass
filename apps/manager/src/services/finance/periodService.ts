import { supabase } from "../../lib/supabase";
import type { FinancialPeriod } from "./types";

export const periodService = {
  async list(): Promise<FinancialPeriod[]> {
    const { data, error } = await supabase
      .from("financial_periods" as never)
      .select("*")
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return data as FinancialPeriod[];
  },

  async getCurrent(): Promise<FinancialPeriod | null> {
    const { data, error } = await supabase
      .from("financial_periods" as never)
      .select("*")
      .eq("status", "open")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as FinancialPeriod | null;
  },

  async close(periodId: string): Promise<{ closed: boolean; issues?: string[] }> {
    const { data, error } = await supabase.rpc("close_financial_period" as never, {
      p_period_id: periodId,
    });
    if (error) throw error;
    return data as { closed: boolean; issues?: string[] };
  },
};
