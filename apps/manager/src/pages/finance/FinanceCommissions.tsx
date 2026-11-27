import { useQuery } from "@tanstack/react-query";
import { Zap, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { treasuryService, dashboardService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

export function FinanceCommissions() {
  const { data: kpi } = useQuery({
    queryKey: ["finance", "dashboard-kpi"],
    queryFn: () => dashboardService.getKpis(),
    staleTime: 60_000,
  });

  const { data: closings = [], isLoading, error } = useQuery({
    queryKey: ["finance", "momo-closings"],
    queryFn: () => treasuryService.getMomoDailyClosings(),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  type Closing = {
    id: string; operator: string; account_name: string; closing_date: string;
    total_commissions_xaf: number; status: string;
  };
  const rows = closings as Closing[];

  // aggregate by operator
  const byOperator = rows.reduce<Record<string, number>>((acc, c) => {
    acc[c.operator] = (acc[c.operator] ?? 0) + c.total_commissions_xaf;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions MoMo</h1>
          <p className="text-sm text-gray-500">
            Total période : <strong className="text-yellow-600">{fmt(kpi?.kpi_commissions_xaf ?? 0)} XAF</strong>
          </p>
        </div>
      </div>

      {Object.keys(byOperator).length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(byOperator).map(([op, total]) => (
            <motion.div
              key={op}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"
            >
              <p className="text-xs text-gray-500 uppercase font-medium">{op}</p>
              <p className="text-xl font-bold tabular-nums text-yellow-700 mt-1">{fmt(total)} XAF</p>
            </motion.div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-2 text-left">Compte / Opérateur</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-right">Commissions</th>
              <th className="px-4 py-2 text-left">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0
              ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                    Aucune clôture enregistrée
                  </td>
                </tr>
              )
              : rows.slice(0, 30).map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{c.account_name}</span>
                    <span className="text-xs text-gray-400 ml-1">({c.operator})</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{c.closing_date}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-yellow-600">
                    {fmt(c.total_commissions_xaf)} XAF
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === "closed" ? "bg-emerald-100 text-emerald-700"
                      : c.status === "reconciled" ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
