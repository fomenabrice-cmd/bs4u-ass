import { Settings, AlertCircle } from "lucide-react";

const settings = [
  { key: "asso.fee.standard_active_xaf", label: "Cotisation standard active (FCFA)", value: "15000", pending: true,  decision: "AD-001" },
  { key: "asso.fee.youth_xaf",           label: "Cotisation jeune (FCFA)",            value: "8000",  pending: true,  decision: "AD-002" },
  { key: "biz.tax.rate",                 label: "Taux TVA (%)",                        value: "0",     pending: false, decision: "BU-006" },
  { key: "biz.printing.color_a4_xaf",   label: "Impression A4 couleur (FCFA)",        value: "100",   pending: false, decision: "BU-001" },
];

export function SettingsPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres système</h1>
        <p className="text-sm text-slate-500 mt-1">Valeurs configurables de la plateforme</p>
      </div>

      {settings.some((s) => s.pending) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Décisions en attente</p>
            <p className="text-xs text-amber-700 mt-0.5">Certains paramètres nécessitent une validation par le bureau de l'association.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {settings.map((s) => (
          <div key={s.key} className="px-5 py-4 flex items-center gap-4">
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{s.label}</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{s.key}</p>
              {s.pending && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2 py-0.5 rounded-md">
                  <AlertCircle className="w-3 h-3" /> Décision {s.decision} requise
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                defaultValue={s.value}
                className="w-28 text-sm text-right border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#075B32]"
              />
              <button className="text-xs bg-[#075B32] text-white px-3 py-1.5 rounded-lg hover:bg-[#063A22] transition-colors">
                Sauver
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
