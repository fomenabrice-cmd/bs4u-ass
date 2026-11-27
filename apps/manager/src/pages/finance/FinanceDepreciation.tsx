import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { assetService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

export function FinanceDepreciation() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["finance", "assets"],
    queryFn: () => assetService.list(),
    staleTime: 120_000,
  });

  const { data: schedule = [], isFetching: schedFetching } = useQuery({
    queryKey: ["finance", "depreciation-schedule", selectedId],
    queryFn: () => assetService.getSchedule(selectedId!),
    enabled: !!selectedId,
    staleTime: 120_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;

  const selected = assets.find(a => a.id === selectedId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans d'amortissement</h1>
          <p className="text-sm text-gray-500">Tableau de dotation par actif</p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Sélectionner un actif</label>
        <select
          value={selectedId ?? ""}
          onChange={e => setSelectedId(e.target.value || null)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:ring-2 focus:ring-orange-300 outline-none"
        >
          <option value="">— choisir —</option>
          {assets.map(a => (
            <option key={a.id} value={a.id}>{a.name} ({a.asset_number})</option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Coût acquisition</p>
            <p className="font-mono font-medium">{fmt(selected.acquisition_cost_xaf)} XAF</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Durée</p>
            <p className="font-medium">{selected.useful_life_months} mois</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Dotation / mois</p>
            <p className="font-mono font-medium">
              {fmt(Math.round((selected.acquisition_cost_xaf - (selected.residual_value_xaf ?? 0)) / selected.useful_life_months))} XAF
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Valeur résiduelle</p>
            <p className="font-mono font-medium">{fmt(selected.residual_value_xaf ?? 0)} XAF</p>
          </div>
        </div>
      )}

      {selectedId && !schedFetching && (schedule as Array<unknown>).length === 0 && (
        <p className="text-sm text-gray-400">Aucune ligne générée pour cet actif. Lancez le calcul d'amortissement.</p>
      )}

      {(schedule as Array<unknown>).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Période N°</th>
                <th className="px-4 py-2 text-left">Début</th>
                <th className="px-4 py-2 text-left">Fin</th>
                <th className="px-4 py-2 text-right">Dotation</th>
                <th className="px-4 py-2 text-right">Cumulé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(schedule as Array<{
                id: string; period_number: number; period_start: string;
                period_end: string; amount_xaf: number; cumulative_xaf: number;
              }>).map(r => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td className="px-4 py-2 text-center tabular-nums">{r.period_number}</td>
                  <td className="px-4 py-2 text-gray-500">{r.period_start}</td>
                  <td className="px-4 py-2 text-gray-500">{r.period_end}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.amount_xaf)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{fmt(r.cumulative_xaf)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
