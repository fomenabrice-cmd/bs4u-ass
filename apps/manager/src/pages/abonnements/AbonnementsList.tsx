import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type Abonnement = {
  id: string; client: string; service: string; periodicite: string;
  montant: number; prochaine: string; statut: string;
};

const STATUS: Record<string, { label: string; bg: string; color: string; icon: typeof CheckCircle2 }> = {
  active:    { label: "Actif",      bg: "#E8F3EC", color: "#075B32", icon: CheckCircle2 },
  expired:   { label: "Expiré",     bg: "#FEF2F2", color: "#B91C1C", icon: AlertTriangle },
  cancelled: { label: "Annulé",     bg: "#FEF2F2", color: "#B91C1C", icon: AlertTriangle },
  pending:   { label: "À relancer", bg: "#FFFBEB", color: "#92400E", icon: AlertTriangle },
  trial:     { label: "Essai",      bg: "#EFF6FF", color: "#1E40AF", icon: CheckCircle2 },
};
const DEFAULT_S = { label: "Actif", bg: "#E8F3EC", color: "#075B32", icon: CheckCircle2 };

function cycle(s: string) {
  if (!s) return "—";
  if (s.includes("month") || s.includes("mensuel")) return "Mensuel";
  if (s.includes("year") || s.includes("annuel")) return "Annuel";
  if (s.includes("quarter") || s.includes("trimest")) return "Trimestriel";
  return s;
}

export function AbonnementsList() {
  const [data, setData] = useState<Abonnement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("subscriptions")
      .select("id, status, start_date, end_date, auto_renew, notes, client:client_id(full_name, company_name, is_company), plan:plan_id(name, billing_cycle, price)")
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        setData((rows ?? []).map((r: any) => ({
          id: r.id,
          client: r.client
            ? (r.client.is_company ? r.client.company_name : r.client.full_name) ?? "—"
            : "—",
          service: r.plan?.name ?? r.notes ?? "—",
          periodicite: cycle(r.plan?.billing_cycle ?? ""),
          montant: Number(r.plan?.price) || 0,
          prochaine: r.end_date ?? "—",
          statut: r.status ?? "active",
        })));
        setLoading(false);
      });
  }, []);

  const filtered = data.filter(a =>
    a.client.toLowerCase().includes(search.toLowerCase()) ||
    a.service.toLowerCase().includes(search.toLowerCase())
  );

  const actifs = data.filter(d => d.statut === "active" || d.statut === "trial").length;
  const mensuel = data.filter(d => d.periodicite === "Mensuel").reduce((s, d) => s + d.montant, 0);
  const annuel = data.reduce((s, d) => {
    if (d.periodicite === "Annuel") return s + d.montant;
    if (d.periodicite === "Mensuel") return s + d.montant * 12;
    if (d.periodicite === "Trimestriel") return s + d.montant * 4;
    return s;
  }, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const renouvellements = data.filter(d => d.prochaine && d.prochaine.startsWith(thisMonth)).length;

  const KPI = [
    { label: "Abonnements actifs", value: String(actifs),                      color: "#075B32", bg: "#E8F3EC" },
    { label: "MRR",                value: mensuel.toLocaleString("fr-FR"),     color: "#1E40AF", bg: "#EFF6FF", sub: "FCFA/mois" },
    { label: "ARR",                value: annuel.toLocaleString("fr-FR"),      color: "#6D28D9", bg: "#F5F3FF", sub: "FCFA/an" },
    { label: "Renouvellements",    value: String(renouvellements),             color: "#92400E", bg: "#FFFBEB", sub: "ce mois" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Abonnements</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Hébergement · domaines · maintenance · relances de renouvellement</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouvel abonnement
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI.map(({ label, value, sub, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            {sub && <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>}
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-[#F5F7F5] text-[#17231C] focus:outline-none focus:border-[#075B32] w-48" />
          </div>
          <span className="ml-auto text-xs text-[#A0ADA5]">{filtered.length} abonnements</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F7F5]">
                  {["Client","Service","Périodicité","Montant","Prochain renouvellement","Statut"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-5 py-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F7F5]">
                {filtered.map((a, i) => {
                  const s = STATUS[a.statut] ?? DEFAULT_S;
                  const Icon = s.icon;
                  return (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                      className="hover:bg-[#F5F7F5] transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-[#17231C]">{a.client}</td>
                      <td className="px-5 py-3.5 text-xs text-[#66736A]">{a.service}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#F5F7F5] text-[#66736A] font-medium">
                          <RefreshCw size={10} />{a.periodicite}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231C]">
                        {a.montant > 0 ? `${a.montant.toLocaleString("fr-FR")} FCFA` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#17231C] font-medium">{a.prochaine}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color }}>
                          <Icon size={11} /> {s.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <RefreshCw size={32} className="mx-auto text-[#E2E8E3] mb-3" />
                <p className="text-sm text-[#A0ADA5]">Aucun abonnement enregistré</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
