import { FileText, Download, AlertCircle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);

type ReportDef = { title: string; desc: string; icon: React.ReactNode };

const REPORTS: ReportDef[] = [
  { title: "Compte de résultat", desc: "Produits, charges et résultat net de la période", icon: <FileText className="w-5 h-5 text-blue-500" /> },
  { title: "Bilan comptable", desc: "Actif, passif et situation nette à la date de clôture", icon: <FileText className="w-5 h-5 text-indigo-500" /> },
  { title: "Grand livre", desc: "Toutes les écritures comptables triées par compte", icon: <FileText className="w-5 h-5 text-violet-500" /> },
  { title: "Balance des comptes", desc: "Soldes débit/crédit par compte SYSCOHADA", icon: <FileText className="w-5 h-5 text-purple-500" /> },
  { title: "Tableau de trésorerie", desc: "Flux entrants et sortants de la période", icon: <FileText className="w-5 h-5 text-cyan-500" /> },
  { title: "Tableau d'amortissement", desc: "Dotations cumulées par immobilisation", icon: <FileText className="w-5 h-5 text-orange-500" /> },
];

export function FinanceReports() {
  const { data: kpi } = useQuery({
    queryKey: ["finance", "dashboard-kpi"],
    queryFn: () => dashboardService.getKpis(),
    staleTime: 60_000,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Download className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports financiers</h1>
          <p className="text-sm text-gray-500">Export PDF / XLSX des états comptables</p>
        </div>
      </div>

      {kpi && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">Résultat net</p>
            <p className={`font-bold tabular-nums ${(kpi.kpi_net_result_xaf ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {fmt(kpi.kpi_net_result_xaf ?? 0)} XAF
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Trésorerie</p>
            <p className="font-bold tabular-nums text-blue-700">{fmt(kpi.kpi_total_treasury_xaf ?? 0)} XAF</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fonds libres</p>
            <p className="font-bold tabular-nums text-indigo-700">{fmt(kpi.kpi_free_funds_xaf ?? 0)} XAF</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map((r, i) => (
          <motion.div
            key={r.title}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
            onClick={() => alert("Export disponible après déploiement de la fonction Edge report-generator")}
          >
            <div className="shrink-0">{r.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{r.title}</p>
              <p className="text-xs text-gray-400 truncate">{r.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </motion.div>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          L'export PDF/XLSX nécessite le déploiement de la Edge Function <code className="bg-yellow-100 px-1 rounded">report-generator</code>.
          Les données sont disponibles via les vues <code className="bg-yellow-100 px-1 rounded">api.v_*</code>.
        </span>
      </div>
    </div>
  );
}
