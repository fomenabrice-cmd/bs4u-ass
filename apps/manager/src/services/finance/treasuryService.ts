import { supabase } from "../../lib/supabase";

export const treasuryService = {
  async listReconciliations(periodId?: string) {
    let query = supabase
      .from("v_treasury_reconciliations" as never)
      .select("*")
      .order("reconciliation_date", { ascending: false });

    if (periodId) {
      query = query.eq("financial_period_id", periodId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async createReconciliation(params: {
    accountType: string;
    accountId?: string;
    financialPeriodId?: string;
    expectedBalanceXaf: number;
    actualBalanceXaf: number;
    notes?: string;
  }) {
    const { data, error } = await supabase
      .from("treasury_reconciliations" as never)
      .insert({
        account_type: params.accountType,
        account_id: params.accountId ?? null,
        financial_period_id: params.financialPeriodId ?? null,
        expected_balance_xaf: params.expectedBalanceXaf,
        actual_balance_xaf: params.actualBalanceXaf,
        notes: params.notes ?? null,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getMomoDailyClosings(accountId?: string) {
    let query = supabase
      .from("v_momo_daily_closings" as never)
      .select("*")
      .order("closing_date", { ascending: false });
    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
};
