import { useState } from "react";
import { Search, Filter, CheckCircle, XCircle } from "lucide-react";

const events = [
  { id: 1, action: "user.login",             actor: "paul@bs4u.cm",    entity: "auth",            time: "2026-11-22 08:14", status: "success" },
  { id: 2, action: "payment.recorded",       actor: "mireil@bs4u.cm",  entity: "biz.invoice#1042",time: "2026-11-22 07:52", status: "success" },
  { id: 3, action: "user.login.failed",      actor: "unknown",         entity: "auth",            time: "2026-11-22 06:30", status: "failure" },
  { id: 4, action: "customer.created",       actor: "paul@bs4u.cm",    entity: "biz.customer#089",time: "2026-11-21 17:11", status: "success" },
  { id: 5, action: "momo.transaction.recorded",actor:"claude@bs4u.cm", entity: "momo.tx#MM1",    time: "2026-11-21 15:40", status: "success" },
  { id: 6, action: "role.permission.add",    actor: "paul@bs4u.cm",    entity: "role:caissier",   time: "2026-11-21 14:22", status: "success" },
  { id: 7, action: "document.created",       actor: "sand@bs4u.cm",    entity: "biz.document#D12",time: "2026-11-21 11:05", status: "success" },
];

export function AuditPage() {
  const [search, setSearch] = useState("");
  const filtered = events.filter(
    (e) => e.action.includes(search) || e.actor.includes(search) || e.entity.includes(search)
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Journal d'audit</h1>
        <p className="text-sm text-slate-500 mt-1">Toutes les actions système tracées</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par action, acteur ou entité…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
          />
        </div>
        <button className="flex items-center gap-2 border border-slate-300 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
          <Filter className="w-4 h-4" /> Filtres
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Acteur</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Entité</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Heure</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Résultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{e.action}</td>
                <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">{e.actor}</td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell font-mono">{e.entity}</td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{e.time}</td>
                <td className="px-4 py-3 text-center">
                  {e.status === "success"
                    ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                    : <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
