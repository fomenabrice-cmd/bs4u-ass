import { Shield, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const roles = [
  { name: "Administrateur",    domain: "platform", perms: 42, users: 2 },
  { name: "Responsable BIZ",   domain: "biz",      perms: 28, users: 3 },
  { name: "Caissier",          domain: "biz",      perms: 12, users: 4 },
  { name: "Secrétaire",        domain: "biz",      perms: 10, users: 2 },
  { name: "Gestionnaire Asso", domain: "asso",     perms: 18, users: 1 },
  { name: "Membre",            domain: "asso",     perms: 5,  users: 85 },
  { name: "Opérateur MoMo",   domain: "momo",     perms: 8,  users: 2 },
];

const domainColors: Record<string, string> = {
  platform: "bg-purple-50 text-purple-700",
  biz:      "bg-blue-50 text-blue-700",
  asso:     "bg-emerald-50 text-emerald-700",
  momo:     "bg-orange-50 text-orange-700",
};

export function RolesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rôles & Permissions</h1>
        <p className="text-sm text-slate-500 mt-1">{roles.length} rôles système définis</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {roles.map((role) => (
          <div key={role.name}>
            <button
              onClick={() => setExpanded(expanded === role.name ? null : role.name)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
            >
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">{role.name}</p>
                <p className="text-xs text-slate-500">{role.perms} permissions · {role.users} utilisateur(s)</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${domainColors[role.domain] ?? "bg-slate-100 text-slate-600"}`}>
                {role.domain}
              </span>
              {expanded === role.name
                ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              }
            </button>
            {expanded === role.name && (
              <div className="bg-slate-50 px-5 py-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Exemples de permissions :</p>
                <div className="flex flex-wrap gap-1.5">
                  {["read", "write", "delete", "manage"].slice(0, Math.min(4, Math.ceil(role.perms / 7))).map((p) => (
                    <span key={p} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                      {role.domain}.*.{p}
                    </span>
                  ))}
                  <span className="text-xs text-slate-400">+{role.perms - 4} autres…</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
