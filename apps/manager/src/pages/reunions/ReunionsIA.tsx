import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Upload, Mic, FileText, CheckCircle2, Clock, Play, Download } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const REUNIONS: { id: string; titre: string; date: string; duree: string; participants: number; statut: string; audio: boolean }[] = [];

const STATUS: Record<string, { label: string; bg: string; color: string; icon: typeof Clock }> = {
  "transcription": { label: "Transcription…", bg: "#EFF6FF", color: "#1E40AF", icon: Clock },
  "en_revision":   { label: "PV en révision", bg: "#FFFBEB", color: "#92400E", icon: Clock },
  "pv_validé":     { label: "PV validé",       bg: "#E8F3EC", color: "#075B32", icon: CheckCircle2 },
};

export function ReunionsIA() {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Réunions IA</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Import audio · transcription · éditeur de PV · actions</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouvelle réunion
        </button>
      </motion.div>

      {/* Zone d'import audio */}
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease, delay: 0.1 }}>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); }}
          className="border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer"
          style={{ borderColor: dragging ? "#075B32" : "#E2E8E3", background: dragging ? "#E8F3EC" : "#F5F7F5" }}>
          <div className="w-14 h-14 rounded-2xl bg-white border border-[#E2E8E3] flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Upload size={22} className="text-[#075B32]" />
          </div>
          <p className="text-sm font-semibold text-[#17231C]">Déposez votre enregistrement audio ici</p>
          <p className="text-xs text-[#A0ADA5] mt-1">MP3, MP4, WAV, M4A — max 500 Mo</p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button className="flex items-center gap-2 bg-[#075B32] text-white text-xs px-4 py-2 rounded-lg font-medium hover:bg-[#063A22] transition-colors">
              <Upload size={13} /> Choisir un fichier
            </button>
            <button className="flex items-center gap-2 border border-[#E2E8E3] bg-white text-xs px-4 py-2 rounded-lg text-[#17231C] font-medium hover:bg-[#F5F7F5] transition-colors">
              <Mic size={13} /> Enregistrer maintenant
            </button>
          </div>
          <p className="text-[10px] text-[#A0ADA5] mt-3">
            L'IA ne peut pas inventer un participant, une décision ou une échéance.
            Chaque point du PV renvoie au passage audio correspondant.
          </p>
        </div>
      </motion.div>

      {/* Liste des réunions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#17231C]">Réunions récentes</h2>
        {REUNIONS.map((r, i) => {
          const s = STATUS[r.statut];
          const Icon = s.icon;
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="bg-white rounded-2xl border border-[#E2E8E3] p-5 hover:border-[#075B32]/30 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E8F3EC] flex items-center justify-center shrink-0">
                    <Mic size={18} className="text-[#075B32]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#17231C]">{r.titre}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#A0ADA5]">
                      <span>{r.date}</span>
                      <span>{r.duree}</span>
                      <span>{r.participants} participants</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.audio && (
                    <button className="p-2 hover:bg-[#E8F3EC] rounded-lg transition-colors" title="Écouter">
                      <Play size={14} className="text-[#075B32]" />
                    </button>
                  )}
                  {r.statut === "pv_validé" && (
                    <button className="p-2 hover:bg-[#E8F3EC] rounded-lg transition-colors" title="Télécharger PV PDF">
                      <Download size={14} className="text-[#075B32]" />
                    </button>
                  )}
                  <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#E2E8E3] hover:bg-[#F5F7F5] text-[#17231C] font-medium transition-colors">
                    <FileText size={12} /> Voir le PV
                  </button>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: s.bg, color: s.color }}>
                    <Icon size={11} /> {s.label}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
