import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { dashboardService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

export function FinanceProfitability() {
  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ["finance", "dashboard-kpi"],
    queryFn: () => dashboardService.getKpis(),
    staleTime: 60_000,
  });

  // Simulateur: charges fixes hypothétiques (editable)
  const [fixedCosts, setFixedCosts] = useState<number>(0);

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error || !kpi) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {error ? (error as Error).message : "Données indisponibles"}
    </div>
  );

  const totalRevenue = (kpi.kpi_revenue_sales_xaf ?? 0) + (kpi.kpi_revenue_services_xaf ?? 0) + (kpi.kpi_commissions_xaf ?? 0);
  const totalExpenses = (kpi.kpi_expenses_xaf ?? 0) + (kpi.kpi_depreciation_xaf ?? 0);
  const variableCosts = Math.max(0, totalExpenses - fixedCosts);
  const marginRate = totalRevenue > 0 ? (totalRevenue - variableCosts) / totalRevenue : 0;
  const breakEven = marginRate > 0 ? fixedCosts / marginRate : 0;
  const safetyMargin = totalRevenue - breakEven;
  const achievedPct = breakEven > 0 ? Math.min(100, (totalRevenue / breakEven) * 100) : 100;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rentabilité</h1>
          <p className="text-sm text-gray-500">Seuil de rentabilité et marge de sécurité</p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-indigo-900">Simulateur — charges fixes</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 whitespace-nowrap">Charges fixes (XAF) :</label>
          <input
            type="number"
            min={0}
            value={fixedCosts}
            onChange={e => setFixedCosts(Math.max(0, parseInt(e.target.value) || 0))}
            className="border border-indigo-300 rounded-lg px-3 py-1.5 text-sm w-48 tabular-nums focus:ring-2 focus:ring-indigo-300 outline-none"
          />
        </div>
        <p className="text-xs text-gray-400">
          Ajustez les charges fixes estimées pour calculer votre seuil de rentabilité.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "CA total", value: fmt(totalRevenue) + " XAF", color: "text-blue-700" },
          { label: "Charges variables", value: fmt(variableCosts) + " XAF", color: "text-rose-600" },
          { label: "Taux de marge / contribution", value: (marginRate * 100).toFixed(1) + " %", color: "text-emerald-600" },
          { label: "Seuil de rentabilité", value: fmt(Math.round(breakEven)) + " XAF", color: "text-indigo-700" },
          { label: "Marge de sécurité", value: fmt(Math.round(safetyMargin)) + " XAF", color: safetyMargin >= 0 ? "text-emerald-600" : "text-rose-600" },
          { label: "Atteinte du seuil", value: achievedPct.toFixed(0) + " %", color: achievedPct >= 100 ? "text-emerald-600" : "text-orange-500" },
        ].map(c => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-bold tabular-nums ${c.color}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>0</span>
          <span>Seuil {fmt(Math.round(breakEven))} XAF</span>
          <span>CA {fmt(totalRevenue)} XAF</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${achievedPct}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full rounded-full ${achievedPct >= 100 ? "bg-emerald-500" : "bg-orange-400"}`}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          {achievedPct >= 100 ? "✓ Seuil de rentabilité atteint" : `Encore ${fmt(Math.round(breakEven - totalRevenue))} XAF pour atteindre le seuil`}
        </p>
      </div>
    </div>
  );
}
