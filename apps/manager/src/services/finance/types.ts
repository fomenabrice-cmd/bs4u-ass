import { z } from "zod";

// ─── Domaine Finance ─────────────────────────────────────────────────────────

export const FinancialPeriodSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  period_type: z.enum(["monthly", "quarterly", "annual"]),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.enum(["open", "closing", "closed"]),
  closed_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type FinancialPeriod = z.infer<typeof FinancialPeriodSchema>;

export const JournalEntrySchema = z.object({
  id: z.string().uuid(),
  entry_number: z.string(),
  financial_period_id: z.string().uuid().nullable(),
  entry_date: z.string(),
  status: z.enum(["draft", "posted", "reversed"]),
  description: z.string(),
  source_type: z.string().nullable(),
  source_id: z.string().uuid().nullable(),
  total_xaf: z.number().int().nonnegative(),
  created_at: z.string(),
  period_label: z.string().nullable(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const ReserveSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  reserve_type: z.enum(["stock", "equipment", "security", "development", "other"]),
  balance_xaf: z.number().int().nonnegative(),
  target_xaf: z.number().int().positive().nullable(),
  is_active: z.boolean(),
});
export type Reserve = z.infer<typeof ReserveSchema>;

export const AllocationRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  reserve_id: z.string().uuid(),
  percentage: z.number().positive().max(100),
  source_type: z.enum(["sale_margin", "momo_commission", "manual"]),
  is_active: z.boolean(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
});
export type AllocationRule = z.infer<typeof AllocationRuleSchema>;

export const LoanSchema = z.object({
  id: z.string().uuid(),
  loan_number: z.string(),
  lender: z.string(),
  loan_type: z.enum(["bank", "personal", "supplier", "other"]),
  principal_xaf: z.number().int().positive(),
  rate_pct: z.number().nonnegative(),
  disbursed_at: z.string(),
  due_date: z.string().nullable(),
  status: z.enum(["active", "closed", "defaulted"]),
  repaid_principal_xaf: z.number().int().nonnegative(),
  outstanding_xaf: z.number().int(),
  total_interest_paid_xaf: z.number().int().nonnegative(),
});
export type Loan = z.infer<typeof LoanSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid(),
  asset_number: z.string(),
  name: z.string(),
  asset_category: z.enum(["it_equipment", "office_equipment", "furniture", "vehicle", "other"]),
  acquisition_cost_xaf: z.number().int().positive(),
  acquisition_date: z.string(),
  useful_life_months: z.number().int().positive(),
  residual_value_xaf: z.number().int().nonnegative(),
  status: z.enum(["active", "disposed", "fully_depreciated"]),
  accumulated_depreciation_xaf: z.number().int().nonnegative(),
  book_value_xaf: z.number().int(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const DashboardKpiSchema = z.object({
  period_id: z.string().uuid(),
  period_label: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  period_status: z.string(),
  kpi_revenue_sales_xaf: z.number().int(),
  kpi_revenue_services_xaf: z.number().int(),
  kpi_commissions_xaf: z.number().int(),
  kpi_total_revenue_xaf: z.number().int(),
  kpi_expenses_xaf: z.number().int(),
  kpi_depreciation_xaf: z.number().int(),
  kpi_net_result_xaf: z.number().int(),
  kpi_cash_xaf: z.number().int(),
  kpi_momo_xaf: z.number().int(),
  kpi_total_treasury_xaf: z.number().int(),
  kpi_stock_value_xaf: z.number().int(),
  kpi_reserves_xaf: z.number().int(),
  kpi_capital_xaf: z.number().int(),
  kpi_outstanding_loans_xaf: z.number().int(),
  kpi_free_funds_xaf: z.number().int(),
});
export type DashboardKpi = z.infer<typeof DashboardKpiSchema>;

// ─── Schémas de formulaire ───────────────────────────────────────────────────

export const CreateExpenseSchema = z.object({
  label: z.string().min(2).max(200),
  category: z.enum(["loyer", "charges_fixes", "fournitures", "salaires", "maintenance", "marketing", "transport", "autre"]),
  amount_xaf: z.number().int().positive(),
  method: z.enum(["cash", "mtn_momo", "orange_money", "transfer", "cheque", "other"]),
  has_receipt: z.boolean().default(false),
  expense_date: z.string().default(() => new Date().toISOString().slice(0, 10)),
  notes: z.string().optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const CreateLoanSchema = z.object({
  lender: z.string().min(2),
  loan_type: z.enum(["bank", "personal", "supplier", "other"]),
  principal_xaf: z.number().int().positive(),
  rate_pct: z.number().nonnegative().default(0),
  disbursed_at: z.string(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateLoanInput = z.infer<typeof CreateLoanSchema>;

export const RecordRepaymentSchema = z.object({
  loan_id: z.string().uuid(),
  total_xaf: z.number().int().positive(),
  principal_xaf: z.number().int().nonnegative(),
  interest_xaf: z.number().int().nonnegative().default(0),
  fees_xaf: z.number().int().nonnegative().default(0),
  method: z.enum(["cash", "transfer", "momo", "other"]),
  paid_at: z.string().default(() => new Date().toISOString().slice(0, 10)),
  idempotency_key: z.string().optional(),
});
export type RecordRepaymentInput = z.infer<typeof RecordRepaymentSchema>;

export const CreateAssetSchema = z.object({
  name: z.string().min(2),
  asset_category: z.enum(["it_equipment", "office_equipment", "furniture", "vehicle", "other"]),
  acquisition_cost_xaf: z.number().int().positive(),
  acquisition_date: z.string(),
  useful_life_months: z.number().int().min(1).max(240),
  residual_value_xaf: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
