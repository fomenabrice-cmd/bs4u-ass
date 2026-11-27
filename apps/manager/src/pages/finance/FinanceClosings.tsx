import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, CheckCircle2, XCircle, AlertCircle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { periodService, dashboardService } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;

type CloseResult = { closed: boolean; issues?: string[]; checks?: Array<{ check: string; ok: boolean; detail: string }> };

export function FinanceClosings() {
  const qc = useQueryClient();
  const [result, setResult] = useState<CloseResult | null>(null);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["finance", "periods"],
    queryFn: () => periodService.list(),
    staleTime: 60_000,
  });

  const { data: summary = [] } = useQuery({
    queryKey: ["finance", "periods-summary"],
    queryFn: () => dashboardService.getPeriodsSummary(),
    staleTime: 60_000,
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => periodService.close(id),
    onSuccess: (data) => {
      setResult(data);
      if (data.closed) {
        void qc.invalidateQueries({ queryKey: ["finance"] });
      }
    },
  });

  const openPeriod = periods.find(p => p.status === "open");

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Lock className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clôture comptable</h1>
          <p className="text-sm text-gray-500">Fermer une période pour verrouiller les écritures</p>
        </div>
      </div>

      {openPeriod && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4"
        >
          <div>
            <h2 className="font-semibold text-blue-900">Période ouverte : {openPeriod.label}</h2>
            <p className="text-sm text-blue-700">{openPeriod.starts_at} → {openPeriod.ends_at}</p>
          </div>

          <button
            onClick={() => closeMutation.mutate(openPeriod.id)}
            disabled={closeMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {closeMutation.isPending ? "Vérification…" : "Lancer la clôture"}
            <ChevronRight className="w-4 h-4" />
          </button>

          {result && (
            <div className={`rounded-lg p-4 space-y-2 ${result.closed ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.closed
                  ? <><CheckCircle2 className="w-5 h-5 text-emerald-600" /><span className="text-emerald-800">Clôture réussie</span></>
                  : <><XCircle className="w-5 h-5 text-rose-600" /><span className="text-rose-800">Clôture impossible</span></>
                }
              </div>
              {result.issues && result.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-rose-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {issue}
                </div>
              ))}
              {result.checks && (
                <ul className="space-y-1 mt-2">
                  {result.checks.map((c, i) => (
                    <li key={i} className={`flex items-center gap-2 text-xs ${c.ok ? "text-emerald-700" : "text-rose-700"}`}>
                      {c.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {c.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </motion.div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Historique des périodes</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Période</th>
                <th className="px-4 py-2 text-left">Statut</th>
                <th className="px-4 py-2 text-right">Écritures</th>
                <th className="px-4 py-2 text-right">Amortissements</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(summary as Array<{ id: string; label: string; status: string; posted_entries: number; depreciation_entries: number; closed_at: string | null }>)
                .map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.label}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        s.status === "open" ? "bg-blue-100 text-blue-700"
                        : s.status === "closed" ? "bg-gray-100 text-gray-600"
                        : "bg-yellow-100 text-yellow-700"
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.posted_entries}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.depreciation_entries}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
