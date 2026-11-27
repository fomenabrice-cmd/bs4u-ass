import { BookOpen, Clock, CheckCircle, ChevronRight } from "lucide-react";

const trainings = [
  { id: 1, title: "Gestion financière de la PME",    status: "completed",   progress: 100, duration: "8h",  date: "Sept. 2026", certified: true  },
  { id: 2, title: "Marketing digital pour artisans", status: "in_progress", progress: 60,  duration: "6h",  date: "Nov. 2026",  certified: false },
  { id: 3, title: "Fiscalité PME au Cameroun",       status: "upcoming",    progress: 0,   duration: "4h",  date: "Déc. 2026",  certified: false },
];

export function MemberTraining() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-[#063A22] px-6 py-8 text-white">
        <p className="text-xs text-emerald-300 uppercase tracking-wide mb-1">Formations</p>
        <h1 className="text-xl font-bold">Mon parcours</h1>
        <div className="flex gap-4 mt-4">
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-bold">1</p>
            <p className="text-xs text-emerald-300">Certifié</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-bold">3</p>
            <p className="text-xs text-emerald-300">Inscrit</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-3">
        {trainings.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                {t.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : t.status === "in_progress" ? (
                  <Clock className="w-5 h-5 text-amber-500" />
                ) : (
                  <BookOpen className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.duration} · {t.date}</p>
                {t.status !== "upcoming" && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#075B32] rounded-full" style={{ width: `${t.progress}%` }} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{t.progress}% complété</p>
                  </div>
                )}
                {t.certified && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs bg-[#E8F5EE] text-[#075B32] px-2 py-0.5 rounded-md font-medium">
                    <CheckCircle className="w-3 h-3" /> Certifié
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </div>
        ))}

        <button className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 text-sm text-[#075B32] font-medium hover:bg-emerald-50 transition-colors">
          + S'inscrire à une formation
        </button>
      </div>
    </div>
  );
}
