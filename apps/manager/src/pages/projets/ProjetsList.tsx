import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Code2, Globe, Server, Smartphone, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

const TYPE_ICON: Record<string, typeof Code2> = {
  "Site web": Globe, "Application mobile": Smartphone, "Hébergement": Server, "Maintenance": Code2,
};
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  "planning":  { label: "Démarrage", bg: "#EFF6FF", color: "#1E40AF" },
  "active":    { label: "En cours",  bg: "#FFFBEB", color: "#92400E" },
  "on_hold":   { label: "Suspendu",  bg: "#F5F7F5", color: "#66736A" },
  "completed": { label: "Livré",     bg: "#F5F3FF", color: "#6D28D9" },
  "cancelled": { label: "Annulé",    bg: "#FEF2F2", color: "#B91C1C" },
};

interface Projet {
  id: string; nom: string; client: string; statut: string;
  montant: number; debut: string; fin: string;
}

export function ProjetsList() {
  const [search, setSearch] = useState("");
  const [projets, setProjets] = useState<Projet[]>([]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name, status, start_date, end_date, budget, client:client_id(full_name, company_name, is_company)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setProjets(data.map((p: any) => ({
          id: p.id,
          nom: p.name ?? "—",
          client: p.client
            ? (p.client.is_company ? p.client.company_name : p.client.full_name) ?? "—"
            : "—",
          statut: p.status ?? "planning",
          montant: Number(p.budget) || 0,
          debut: p.start_date ?? "—",
          fin: p.end_date ?? "—",
        })));
      });
  }, []);

  const filtered = projets.filter(p =>
    p.nom.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase())
  );

  const actifs = projets.filter(p => ["active", "planning"].includes(p.statut)).length;
  const ca = projets.reduce((s, p) => s + p.montant, 0);

  const kpi = [
    { label: "Projets actifs",  value: String(actifs), color: "#075B32", bg: "#E8F3EC" },
    { label: "CA projets",      value: ca.toLocaleString("fr-FR") + " FCFA", color: "#1E40AF", bg: "#EFF6FF" },
    { label: "Total projets",   value: String(projets.length), color: "#6D28D9", bg: "#F5F3FF" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Projets numériques</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Développement · hébergement · domaines · maintenance · abonnements</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouveau projet
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpi.map(({ label, value, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un projet…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-white text-[#17231C] focus:outline-none focus:border-[#075B32] w-64" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8E3] flex flex-col items-center justify-center py-16 text-center">
            <Code2 size={36} className="text-[#E2E8E3] mb-3" />
            <p className="text-sm text-[#A0ADA5]">Aucun projet enregistré</p>
            <button className="mt-3 text-xs text-[#075B32] hover:underline font-medium">
              Créer le premier projet
            </button>
          </div>
        ) : (
          filtered.map((p, i) => {
            const s = STATUS[p.statut] ?? STATUS.planning;
            const Icon = TYPE_ICON["Site web"];
            return (
              <motion.div key={p.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="bg-white rounded-2xl border border-[#E2E8E3] p-5 hover:border-[#075B32]/30 hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3EC] flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#075B32]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-[#17231C]">{p.nom}</p>
                        <p className="text-xs text-[#66736A] mt-0.5">{p.client}</p>
                        <p className="text-xs text-[#A0ADA5] mt-1">{p.debut} → {p.fin}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        {p.montant > 0 && (
                          <p className="text-sm font-bold text-[#17231C] tabular-nums">{p.montant.toLocaleString("fr-FR")} FCFA</p>
                        )}
                        <ChevronRight size={16} className="text-[#A0ADA5] group-hover:text-[#075B32] transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
