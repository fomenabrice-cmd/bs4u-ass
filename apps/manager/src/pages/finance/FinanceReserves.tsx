import { useQuery } from "@tanstack/react-query";
import { PiggyBank, AlertCircle, Target } from "lucide-react";
import { motion } from "framer-motion";
import { reserveService } from "../../services/finance";
import type { Reserve } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

const TYPE_LABELS: Record<string, string> = {
  stock: "Stock", equipment: "Équipements", security: "Sécurité",
  development: "Développement", other: "Autre",
};

function ReserveCard({ r }: { r: Reserve }) {
  const pct = r.target_xaf ? Math.min(100, (r.balance_xaf / r.target_xaf) * 100) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
    >
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {TYPE_LABELS[r.reserve_type] ?? r.reserve_type}
          </span>
          <h3 className="mt-2 font-semibold text-gray-900">{r.name}</h3>
        </div>
        <PiggyBank className="w-5 h-5 text-blue-500" />
      </div>

      <p className="text-2xl font-bold tabular-nums text-gray-900">
        {fmt(r.balance_xaf)} <span className="text-sm font-normal text-gray-500">XAF</span>
      </p>

      {r.target_xaf && pct !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Objectif : {fmt(r.target_xaf)} XAF</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {r.target_xaf && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Target className="w-3 h-3" />
              Manque : {fmt(Math.max(0, r.target_xaf - r.balance_xaf))} XAF
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export function FinanceReserves() {
  const { data: reserves, isLoading, error } = useQuery({
    queryKey: ["finance", "reserves"],
    queryFn: () => reserveService.list(),
    staleTime: 60_000,
  });

  const { data: rules } = useQuery({
    queryKey: ["finance", "allocation-rules"],
    queryFn: () => reserveService.listRules(),
    staleTime: 120_000,
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  const totalBalance = (reserves ?? []).reduce((s, r) => s + r.balance_xaf, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Réserves</h1>
        <p className="text-sm text-gray-500">
          Total : <strong>{fmt(totalBalance)} XAF</strong>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(reserves ?? []).filter(r => r.is_active).map(r => (
          <ReserveCard key={r.id} r={r} />
        ))}
      </div>

      {rules && rules.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Règles de ventilation actives</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Règle</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-right">%</th>
                  <th className="px-4 py-2 text-left">Depuis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(rules as AllocationRule[]).filter((r: AllocationRule) => r.is_active).map((r: AllocationRule) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-gray-500">{r.source_type}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.percentage}%</td>
                    <td className="px-4 py-2 text-gray-500">{r.effective_from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

import type { AllocationRule } from "../../services/finance";
