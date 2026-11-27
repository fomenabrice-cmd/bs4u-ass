import { CheckCircle, Clock, CreditCard, AlertCircle } from "lucide-react";

const dues = [
  { id: 1, year: 2026, amount: 15000, status: "paid",  due_date: "31 janv. 2026" },
  { id: 2, year: 2025, amount: 15000, status: "paid",  due_date: "31 janv. 2025" },
  { id: 3, year: 2024, amount: 12000, status: "paid",  due_date: "31 janv. 2024" },
];

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n) + " FCFA"; }

export function MemberMembership() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-gradient-to-br from-[#063A22] to-[#075B32] px-6 py-8 text-white">
        <p className="text-xs text-emerald-300 uppercase tracking-wide mb-1">Mon adhésion</p>
        <h1 className="text-xl font-bold">Membre standard</h1>
        <p className="text-emerald-200 text-sm mt-1">MBR-2026-000042</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
          <CheckCircle className="w-4 h-4 text-[#D6A52B]" />
          <span className="text-sm font-semibold text-[#D6A52B]">Actif — Cotisation 2026 réglée</span>
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Historique des cotisations</h2>
        <div className="space-y-2">
          {dues.map((due) => (
            <div key={due.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Cotisation {due.year}</p>
                  <p className="text-xs text-slate-500">Échéance : {due.due_date}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{fmt(due.amount)}</p>
                <p className="text-xs text-emerald-600 font-medium">Payée</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Régler une cotisation</h3>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#075B32]">
            <option>Cotisation 2027 — 15 000 FCFA</option>
          </select>
          <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#075B32]">
            <option>MTN Mobile Money</option>
            <option>Orange Money</option>
            <option>Cash (au bureau)</option>
          </select>
          <button className="w-full flex items-center justify-center gap-2 bg-[#075B32] text-white py-3 rounded-xl font-semibold text-sm">
            <CreditCard className="w-4 h-4" /> Payer 15 000 FCFA
          </button>
        </div>
      </div>
    </div>
  );
}
