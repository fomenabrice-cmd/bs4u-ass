import { supabase } from "../../lib/supabase";
import type { Loan, CreateLoanInput, RecordRepaymentInput } from "./types";

export const capitalService = {
  async listLoans(): Promise<Loan[]> {
    const { data, error } = await supabase
      .from("v_loans" as never)
      .select("*")
      .order("disbursed_at", { ascending: false });
    if (error) throw error;
    return data as Loan[];
  },

  async createLoan(input: CreateLoanInput): Promise<string> {
    const { data, error } = await supabase.rpc("create_loan" as never, {
      p_lender:         input.lender,
      p_loan_type:      input.loan_type,
      p_principal_xaf:  input.principal_xaf,
      p_rate_pct:       input.rate_pct ?? 0,
      p_disbursed_at:   input.disbursed_at,
      p_due_date:       input.due_date ?? null,
      p_notes:          input.notes ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async recordRepayment(input: RecordRepaymentInput) {
    const { data, error } = await supabase.rpc("record_loan_repayment" as never, {
      p_loan_id:          input.loan_id,
      p_total_xaf:        input.total_xaf,
      p_principal_xaf:    input.principal_xaf,
      p_interest_xaf:     input.interest_xaf ?? 0,
      p_fees_xaf:         input.fees_xaf ?? 0,
      p_method:           input.method,
      p_paid_at:          input.paid_at,
      p_idempotency_key:  input.idempotency_key ?? null,
    });
    if (error) throw error;
    return data;
  },

  async listContributions() {
    const { data, error } = await supabase
      .from("v_capital_contributions" as never)
      .select("*")
      .order("contributed_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
