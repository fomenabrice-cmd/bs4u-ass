import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { capitalService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

const TYPE_LABELS: Record<string, string> = {
  initial: "Initial", additional: "Complémentaire", supplier_fund: "Fonds fournisseur", other: "Autre",
};
const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces", transfer: "Virement", momo: "MoMo", other: "Autre",
};

export function FinanceCapital() {
  const { data: contributions = [], isLoading, error } = useQuery({
    queryKey: ["finance", "capital-contributions"],
    queryFn: () => capitalService.listContributions(),
    staleTime: 120_000,
  });

  const total = (contributions as Array<{ amount_xaf: number }>)
    .reduce((s, c) => s + c.amount_xaf, 0);

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
        <TrendingUp className="w-6 h-6 text-emerald-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Capital & Apports</h1>
          <p className="text-sm text-gray-500">
            Capital total : <strong className="text-emerald-600">{fmt(total)} XAF</strong>
          </p>
        </div>
      </div>

      {contributions.length === 0
        ? <p className="text-sm text-gray-400">Aucun apport enregistré.</p>
        : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Numéro</th>
                  <th className="px-4 py-2 text-left">Apporteur</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Mode</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(contributions as Array<{
                  id: string; contrib_number: string; contributor: string;
                  contribution_type: string; method: string; amount_xaf: number; contributed_at: string;
                }>).map(c => (
                  <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td className="px-4 py-2 font-mono text-xs text-gray-400">{c.contrib_number}</td>
                    <td className="px-4 py-2 font-medium">{c.contributor}</td>
                    <td className="px-4 py-2 text-gray-500">{TYPE_LABELS[c.contribution_type] ?? c.contribution_type}</td>
                    <td className="px-4 py-2 text-gray-500">{METHOD_LABELS[c.method] ?? c.method}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-600">
                      {fmt(c.amount_xaf)} XAF
                    </td>
                    <td className="px-4 py-2 text-gray-400">{c.contributed_at}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
