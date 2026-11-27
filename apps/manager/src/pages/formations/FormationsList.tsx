import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, GraduationCap, Users, Calendar, Award } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  "open":       { label: "Ouvert",   bg: "#E8F3EC", color: "#075B32" },
  "full":       { label: "Complet",  bg: "#FFFBEB", color: "#92400E" },
  "ongoing":    { label: "En cours", bg: "#EFF6FF", color: "#1E40AF" },
  "completed":  { label: "Terminé",  bg: "#F5F7F5", color: "#66736A" },
  "cancelled":  { label: "Annulé",   bg: "#FEF2F2", color: "#B91C1C" },
  // Legacy values in case status uses French
  "ouvert":     { label: "Ouvert",   bg: "#E8F3EC", color: "#075B32" },
  "complet":    { label: "Complet",  bg: "#FFFBEB", color: "#92400E" },
  "en cours":   { label: "En cours", bg: "#EFF6FF", color: "#1E40AF" },
  "terminé":    { label: "Terminé",  bg: "#F5F7F5", color: "#66736A" },
};

interface Formation {
  id: string; titre: string; formateur: string; salle: string;
  debut: string; fin: string; places: number; inscrits: number;
  prix: number; statut: string;
}

export function FormationsList() {
  const [search, setSearch] = useState("");
  const [formations, setFormations] = useState<Formation[]>([]);
  const [counts, setCounts] = useState({ actives: 0, apprenants: 0 });

  useEffect(() => {
    supabase
      .from("trainings")
      .select("id, title, external_trainer, location, start_date, end_date, max_participants, price, status, training_registrations(count)")
      .is("deleted_at", null)
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const list: Formation[] = data.map((f: any) => ({
          id: f.id,
          titre: f.title ?? "—",
          formateur: f.external_trainer ?? "—",
          salle: f.location ?? "—",
          debut: f.start_date ?? "—",
          fin: f.end_date ?? "—",
          places: f.max_participants ?? 0,
          inscrits: f.training_registrations?.[0]?.count ?? 0,
          prix: Number(f.price) || 0,
          statut: f.status ?? "open",
        }));
        setFormations(list);
        const actives = list.filter(f => ["open", "ongoing", "ouvert", "en cours"].includes(f.statut)).length;
        const apprenants = list.reduce((s, f) => s + f.inscrits, 0);
        setCounts({ actives, apprenants });
      });
  }, []);

  const filtered = formations.filter(f =>
    f.titre.toLowerCase().includes(search.toLowerCase()) ||
    f.formateur.toLowerCase().includes(search.toLowerCase())
  );

  const kpi = [
    { label: "Sessions actives",   value: String(counts.actives),   color: "#075B32", bg: "#E8F3EC" },
    { label: "Apprenants ce mois", value: String(counts.apprenants),color: "#1E40AF", bg: "#EFF6FF" },
    { label: "Sessions totales",   value: String(formations.length),color: "#6D28D9", bg: "#F5F3FF" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Formations vendues</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Catalogue · sessions · inscriptions · certificats vérifiables</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouvelle session
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpi.map(({ label, value, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une formation…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-white text-[#17231C] focus:outline-none focus:border-[#075B32] w-64" />
          </div>
          <span className="text-xs text-[#A0ADA5]">{filtered.length} session{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8E3] flex flex-col items-center justify-center py-16 text-center">
            <GraduationCap size={36} className="text-[#E2E8E3] mb-3" />
            <p className="text-sm text-[#A0ADA5]">Aucune formation enregistrée</p>
            <button className="mt-3 text-xs text-[#075B32] hover:underline font-medium">
              Créer la première session
            </button>
          </div>
        ) : (
          filtered.map((f, i) => {
            const s = STATUS[f.statut] ?? STATUS.open;
            const pct = f.places > 0 ? Math.round((f.inscrits / f.places) * 100) : 0;
            return (
              <motion.div key={f.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="bg-white rounded-2xl border border-[#E2E8E3] p-5 hover:border-[#075B32]/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E8F3EC] flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap size={18} className="text-[#075B32]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#17231C]">{f.titre}</p>
                      <p className="text-xs text-[#66736A] mt-0.5">par {f.formateur} · {f.salle}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#A0ADA5]">
                        <span className="flex items-center gap-1"><Calendar size={11} />{f.debut} → {f.fin}</span>
                        <span className="flex items-center gap-1"><Users size={11} />{f.inscrits}/{f.places} apprenants</span>
                        {f.prix > 0 && <span className="flex items-center gap-1"><Award size={11} />{f.prix.toLocaleString("fr-FR")} FCFA/p.</span>}
                      </div>
                      {f.places > 0 && (
                        <div className="mt-2 w-48">
                          <div className="h-1.5 bg-[#E2E8E3] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[#075B32]" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-[#A0ADA5] mt-0.5">{pct}% rempli</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    {f.prix > 0 && (
                      <p className="text-sm font-bold text-[#17231C] tabular-nums">{(f.inscrits * f.prix).toLocaleString("fr-FR")} FCFA</p>
                    )}
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
