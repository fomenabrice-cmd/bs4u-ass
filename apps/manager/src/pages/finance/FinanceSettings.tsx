import { useQuery } from "@tanstack/react-query";
import { Settings, AlertCircle, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { reserveService } from "../../services/finance";
import type { AllocationRule } from "../../services/finance";

const SOURCE_LABELS: Record<string, string> = {
  sale_margin: "Marge vente", momo_commission: "Commission MoMo", manual: "Manuel",
};

export function FinanceSettings() {
  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ["finance", "allocation-rules"],
    queryFn: () => reserveService.listRules(),
    staleTime: 120_000,
  });

  const { data: reserves = [] } = useQuery({
    queryKey: ["finance", "reserves"],
    queryFn: () => reserveService.list(),
    staleTime: 120_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  type ReserveRow = { id: string; name: string; reserve_type: string };
  const reserveMap = Object.fromEntries((reserves as ReserveRow[]).map(r => [r.id, r.name]));

  const activeRules = (rules as AllocationRule[]).filter(r => r.is_active);
  const inactiveRules = (rules as AllocationRule[]).filter(r => !r.is_active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-gray-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres Finance</h1>
          <p className="text-sm text-gray-500">Règles d'allocation et barèmes de commission</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Percent className="w-4 h-4" /> Règles d'allocation aux réserves
        </h2>
        <p className="text-xs text-gray-400">
          Ces règles définissent quel % d'une source (marge, commission…) est automatiquement versé dans chaque réserve.
        </p>

        {activeRules.length === 0
          ? <p className="text-sm text-gray-400">Aucune règle active.</p>
          : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Réserve cible</th>
                    <th className="px-4 py-2 text-right">%</th>
                    <th className="px-4 py-2 text-left">Depuis</th>
                    <th className="px-4 py-2 text-left">Jusqu'au</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeRules.map(r => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td className="px-4 py-2">{SOURCE_LABELS[r.source_type] ?? r.source_type}</td>
                      <td className="px-4 py-2 font-medium">{reserveMap[r.reserve_id] ?? r.reserve_id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-indigo-600">{r.percentage} %</td>
                      <td className="px-4 py-2 text-gray-400">{r.effective_from}</td>
                      <td className="px-4 py-2 text-gray-400">{r.effective_to ?? "—"}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        {inactiveRules.length > 0 && (
          <details className="text-xs text-gray-400 cursor-pointer">
            <summary>{inactiveRules.length} règle(s) inactive(s)</summary>
            <ul className="mt-2 space-y-1 pl-2">
              {inactiveRules.map(r => (
                <li key={r.id}>{SOURCE_LABELS[r.source_type]} → {reserveMap[r.reserve_id] ?? r.reserve_id.slice(0, 8)} ({r.percentage}%)</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        La modification des règles d'allocation s'effectue directement dans la table{" "}
        <code className="bg-blue-100 px-1 rounded">biz.allocation_rules</code> via Supabase Studio ou une future interface d'administration.
      </div>
    </div>
  );
}
