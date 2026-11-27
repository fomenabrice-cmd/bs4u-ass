import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { dashboardService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="tabular-nums font-medium">{fmt(value)} XAF</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export function FinanceMargins() {
  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ["finance", "dashboard-kpi"],
    queryFn: () => dashboardService.getKpis(),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error || !kpi) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {error ? (error as Error).message : "Données indisponibles"}
    </div>
  );

  const totalRevenue = (kpi.kpi_revenue_sales_xaf ?? 0) + (kpi.kpi_revenue_services_xaf ?? 0);
  const grossMargin = totalRevenue - (kpi.kpi_expenses_xaf ?? 0);
  const marginRate = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

  const cards = [
    { label: "Chiffre d'affaires", value: totalRevenue, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    { label: "Charges directes", value: kpi.kpi_expenses_xaf ?? 0, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    { label: "Marge brute", value: grossMargin, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { label: "Taux de marge", value: marginRate, pct: true, color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marges</h1>
          <p className="text-sm text-gray-500">Marge brute = CA − Charges de la période courante</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-xl border p-4 ${c.bg}`}
          >
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold tabular-nums ${c.color}`}>
              {c.pct ? `${marginRate.toFixed(1)} %` : `${fmt(c.value)} XAF`}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Répartition du chiffre d'affaires</h2>
        <Bar label="Ventes produits" value={kpi.kpi_revenue_sales_xaf ?? 0} max={totalRevenue} color="bg-blue-500" />
        <Bar label="Prestations services" value={kpi.kpi_revenue_services_xaf ?? 0} max={totalRevenue} color="bg-indigo-400" />
        <Bar label="Commissions MoMo" value={kpi.kpi_commissions_xaf ?? 0} max={totalRevenue} color="bg-violet-400" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Résultat net estimé</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Résultat net</span>
          <span className={`text-lg font-bold tabular-nums ${(kpi.kpi_net_result_xaf ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {fmt(kpi.kpi_net_result_xaf ?? 0)} XAF
          </span>
        </div>
        <p className="text-xs text-gray-400">Inclut amortissements et charges indirectes</p>
      </div>
    </div>
  );
}
