import { useQuery } from "@tanstack/react-query";
import { Wallet, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { treasuryService, periodService } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

const ACCT_LABELS: Record<string, string> = {
  cash: "Caisse", momo_mtn: "MTN MoMo", momo_orange: "Orange Money", bank: "Banque", reserve: "Réserve",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  matched: "bg-emerald-100 text-emerald-700",
  discrepancy: "bg-rose-100 text-rose-700",
  resolved: "bg-gray-100 text-gray-500",
};

export function FinanceTreasury() {
  const { data: period } = useQuery({
    queryKey: ["finance", "period", "current"],
    queryFn: () => periodService.getCurrent(),
    staleTime: 60_000,
  });

  const { data: reconciliations = [], isLoading, error } = useQuery({
    queryKey: ["finance", "reconciliations", period?.id],
    queryFn: () => treasuryService.listReconciliations(period?.id),
    staleTime: 60_000,
  });

  const { data: momoClosings = [] } = useQuery({
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trésorerie</h1>
          <p className="text-sm text-gray-500">Rapprochements et clôtures MoMo</p>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Rapprochements de trésorerie</h2>
        {reconciliations.length === 0
          ? <p className="text-sm text-gray-400">Aucun rapprochement pour cette période.</p>
          : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Compte</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-right">Attendu</th>
                    <th className="px-4 py-2 text-right">Réel</th>
                    <th className="px-4 py-2 text-right">Écart</th>
                    <th className="px-4 py-2 text-left">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(reconciliations as Array<{
                    id: string; account_type: string; reconciliation_date: string;
                    expected_balance_xaf: number; actual_balance_xaf: number;
                    difference_xaf: number; status: string;
                  }>).map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">{ACCT_LABELS[r.account_type] ?? r.account_type}</td>
                      <td className="px-4 py-2 text-gray-500">{r.reconciliation_date}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(r.expected_balance_xaf)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(r.actual_balance_xaf)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${
                        r.difference_xaf === 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {r.difference_xaf > 0 ? "+" : ""}{fmt(r.difference_xaf)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Clôtures journalières MoMo (récentes)</h2>
        {momoClosings.length === 0
          ? <p className="text-sm text-gray-400">Aucune clôture enregistrée.</p>
          : (
            <div className="space-y-2">
              {(momoClosings as Array<{
                id: string; closing_date: string; account_name: string; operator: string;
                total_commissions_xaf: number; discrepancy_xaf: number; status: string;
              }>).slice(0, 10).map(c => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="text-sm font-medium">{c.account_name}</span>
                    <span className="text-xs text-gray-400 ml-2">({c.operator}) · {c.closing_date}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="tabular-nums text-blue-600">+{fmt(c.total_commissions_xaf)} commissions</span>
                    {c.discrepancy_xaf === 0
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <XCircle className="w-4 h-4 text-rose-500" />
                    }
                  </div>
                </motion.div>
              ))}
            </div>
          )
        }
      </section>
    </div>
  );
}
