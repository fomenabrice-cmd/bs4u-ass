import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, Clock, CheckCircle2, XCircle, Download, Eye, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type Devis = {
  id: string; reference: string; client: string; objet: string;
  montant: number; statut: string; date: string; expiration: string;
};

const STATUS: Record<string, { label: string; bg: string; color: string; icon: typeof Clock }> = {
  draft:    { label: "En cours",  bg: "#EFF6FF", color: "#1E40AF", icon: Clock },
  sent:     { label: "Envoyé",    bg: "#FFFBEB", color: "#92400E", icon: Clock },
  accepted: { label: "Accepté",   bg: "#E8F3EC", color: "#075B32", icon: CheckCircle2 },
  rejected: { label: "Refusé",    bg: "#FEF2F2", color: "#B91C1C", icon: XCircle },
};
const DEFAULT_S = { label: "En cours", bg: "#EFF6FF", color: "#1E40AF", icon: Clock };

export function DevisList() {
  const [data, setData] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("quotes")
      .select("id, reference, status, total, quote_date, valid_until, client:client_id(full_name, company_name, is_company), quote_lines(description)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        setData((rows ?? []).map((q: any) => ({
          id: q.id,
          reference: q.reference ?? "—",
          client: q.client
            ? (q.client.is_company ? q.client.company_name : q.client.full_name) ?? "—"
            : "—",
          objet: q.quote_lines?.[0]?.description ?? "—",
          montant: Number(q.total) || 0,
          statut: q.status ?? "draft",
          date: q.quote_date ?? "—",
          expiration: q.valid_until ?? "—",
        })));
        setLoading(false);
      });
  }, []);

  const filtered = data.filter(d =>
    d.client.toLowerCase().includes(search.toLowerCase()) ||
    d.reference.toLowerCase().includes(search.toLowerCase())
  );

  const today = new Date().toISOString().split("T")[0];
  const enCours = data.filter(d => d.statut === "draft" || d.statut === "sent").length;
  const totalMontant = data.reduce((s, d) => s + d.montant, 0);
  const accepted = data.filter(d => d.statut === "accepted").length;
  const tauxAcceptation = data.length > 0 ? Math.round(accepted / data.length * 100) : 0;
  const expires = data.filter(d => d.expiration < today && d.statut !== "accepted" && d.statut !== "rejected").length;

  const KPI = [
    { label: "Devis en cours",    value: String(enCours),                        sub: "Ce mois",           color: "#1E40AF", bg: "#EFF6FF" },
    { label: "Montant total",     value: totalMontant.toLocaleString("fr-FR"),   sub: "FCFA",               color: "#075B32", bg: "#E8F3EC" },
    { label: "Taux d'acceptation",value: `${tauxAcceptation} %`,                 sub: "30 derniers jours",  color: "#6D28D9", bg: "#F5F3FF" },
    { label: "Expirés ce mois",   value: String(expires),                        sub: "À relancer",         color: "#B91C1C", bg: "#FEF2F2" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Devis</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Propositions commerciales et acceptations</p>
        </div>
        <Link to="/devis/nouveau"
          className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouveau devis
        </Link>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI.map(({ label, value, sub, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-[#F5F7F5] text-[#17231C] focus:outline-none focus:border-[#075B32]" />
          </div>
          <span className="text-xs text-[#A0ADA5] ml-auto">{filtered.length} devis</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F7F5]">
                  {["Référence","Client","Objet","Montant","Statut","Expiration",""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-5 py-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F7F5]">
                {filtered.map((d, i) => {
                  const s = STATUS[d.statut] ?? DEFAULT_S;
                  const Icon = s.icon;
                  return (
                    <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                      className="hover:bg-[#F5F7F5] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-[#075B32] font-semibold">{d.reference}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-[#17231C]">{d.client}</td>
                      <td className="px-5 py-3.5 text-sm text-[#66736A] max-w-[200px] truncate">{d.objet}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231C]">{d.montant.toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: s.bg, color: s.color }}>
                          <Icon size={11} /> {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#A0ADA5]">{d.expiration}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-[#E8F3EC] rounded-lg transition-colors" title="Voir">
                            <Eye size={14} className="text-[#075B32]" />
                          </button>
                          <button className="p-1.5 hover:bg-[#E8F3EC] rounded-lg transition-colors" title="Télécharger PDF">
                            <Download size={14} className="text-[#075B32]" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <FileText size={32} className="mx-auto text-[#E2E8E3] mb-3" />
                <p className="text-sm text-[#A0ADA5]">Aucun devis trouvé</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
