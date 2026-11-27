import { supabase } from "../../lib/supabase";
import type { JournalEntry } from "./types";

type JournalLine = { account_code: string; debit_xaf: number; credit_xaf: number; description?: string };

export const journalService = {
  async list(periodId?: string): Promise<JournalEntry[]> {
    let query = supabase
      .from("v_journal_entries" as never)
      .select("*")
      .order("entry_date", { ascending: false });

    if (periodId) {
      query = query.eq("financial_period_id", periodId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data as JournalEntry[];
  },

  async post(entryId: string): Promise<void> {
    const { error } = await supabase
      .from("journal_entries" as never)
      .update({ status: "posted" } as never)
      .eq("id", entryId);
    if (error) throw error;
  },

  async createEntry(params: {
    description: string;
    entry_date: string;
    period_id: string;
    lines: JournalLine[];
  }): Promise<string> {
    const { data, error } = await supabase.rpc("create_journal_entry" as never, {
      p_description: params.description,
      p_entry_date:  params.entry_date,
      p_period_id:   params.period_id,
      p_lines:       params.lines,
    });
    if (error) throw error;
    return data as string;
  },
};
