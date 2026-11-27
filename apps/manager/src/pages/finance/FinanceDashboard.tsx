import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Building2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { dashboardService } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n) + " XAF";
const fmtShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M XAF";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "k XAF";
  return n + " XAF";
};

function KpiCard({ label, value, icon: Icon, positive }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; positive?: boolean;
}) {
  const color = positive === undefined
    ? "text-blue-600"
    : positive ? "text-emerald-600" : "text-rose-600";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="bg-white border border-gray-200 rounded-xl p-5 flex gap-4 items-start"
    >
      <div className="p-2 bg-gray-50 rounded-lg">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${color}`}>{fmtShort(value)}</p>
      </div>
    </motion.div>
  );
}

export function FinanceDashboard() {
  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ["finance", "dashboard"],
    queryFn: () => dashboardService.getKpis(),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error || !kpi) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      {error ? (error as Error).message : "Aucune période ouverte"}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-sm text-gray-500">Période : {kpi.period_label} · {kpi.period_status}</p>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenus</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="CA Ventes" value={kpi.kpi_revenue_sales_xaf} icon={TrendingUp} positive />
          <KpiCard label="CA Prestations" value={kpi.kpi_revenue_services_xaf} icon={TrendingUp} positive />
          <KpiCard label="Commissions MoMo" value={kpi.kpi_commissions_xaf} icon={TrendingUp} positive />
          <KpiCard label="Revenu total" value={kpi.kpi_total_revenue_xaf} icon={TrendingUp} positive />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Charges & Résultat</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard label="Charges" value={kpi.kpi_expenses_xaf} icon={TrendingDown} positive={false} />
          <KpiCard label="Amortissements" value={kpi.kpi_depreciation_xaf} icon={TrendingDown} />
          <KpiCard label="Résultat net" value={kpi.kpi_net_result_xaf} icon={TrendingUp} positive={kpi.kpi_net_result_xaf >= 0} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Trésorerie</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Caisse" value={kpi.kpi_cash_xaf} icon={Wallet} />
          <KpiCard label="MoMo" value={kpi.kpi_momo_xaf} icon={Wallet} />
          <KpiCard label="Réserves" value={kpi.kpi_reserves_xaf} icon={PiggyBank} />
          <KpiCard label="Fonds libres" value={kpi.kpi_free_funds_xaf} icon={Wallet} positive={kpi.kpi_free_funds_xaf >= 0} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Patrimoine</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Valeur stock" value={kpi.kpi_stock_value_xaf} icon={Building2} />
          <KpiCard label="Capital" value={kpi.kpi_capital_xaf} icon={Building2} />
          <KpiCard label="Dettes restantes" value={kpi.kpi_outstanding_loans_xaf} icon={TrendingDown} />
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">Trésorerie totale</p>
            <p className="text-lg font-bold tabular-nums text-blue-600">{fmt(kpi.kpi_total_treasury_xaf)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
