import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Shield, MoreVertical, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

type OrgUser = {
  id: string;
  full_name: string;
  email: string;
  role: string | null;
  is_active: boolean | null;
  last_sign_in_at: string | null;
};

function roleLabel(role: string | null) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrateur",
    manager: "Manager",
    secretary: "Secrétaire",
    accountant: "Comptable",
    cashier: "Caissier",
    member: "Membre",
  };
  return role ? (map[role] ?? role) : "—";
}

function timeAgo(iso: string | null) {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d}j`;
  return `il y a ${Math.floor(d / 7)} sem`;
}

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const { data: users = [], isFetching, refetch, error } = useQuery<OrgUser[]>({
    queryKey: ["org-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_org_users");
      if (error) throw error;
      return data as OrgUser[];
    },
    retry: false,
  });

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function resetPassword(user: OrgUser) {
    setResetting(user.id);
    setOpenMenu(null);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    });
    setResetting(null);
    setToast({
      id: user.id,
      msg: error
        ? `Erreur : ${error.message}`
        : `Email de réinitialisation envoyé à ${user.email}`,
      ok: !error,
    });
    setTimeout(() => setToast(null), 5000);
  }

  const notAuth =
    error instanceof Error && error.message?.includes("JWT");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5" onClick={() => setOpenMenu(null)}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilisateurs</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} compte{users.length !== 1 ? "s" : ""} enregistré{users.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Synchroniser
          </button>
          <button className="flex items-center gap-2 bg-[#075B32] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#063A22] transition-colors">
            <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
        />
      </div>

      {notAuth && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
          Connexion requise — veuillez vous connecter pour voir les utilisateurs.
        </div>
      )}

      {error && !notAuth && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Erreur de chargement : {(error as Error).message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isFetching && users.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 && !error ? (
          <div className="text-center py-12 text-slate-400 text-sm">Aucun utilisateur trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Utilisateur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden md:table-cell">Rôle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 hidden lg:table-cell">Dernière connexion</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Statut</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#075B32] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.full_name}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                      <Shield className="w-3 h-3" /> {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                    {timeAgo(u.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ring-1 ${
                      u.is_active !== false
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-500 ring-slate-200"
                    }`}>
                      {u.is_active !== false ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 relative">
                    {resetting === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    ) : (
                      <>
                        <button
                          className="p-1 text-slate-400 hover:text-slate-700 rounded"
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === u.id ? null : u.id); }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenu === u.id && (
                          <div
                            className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-52"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => resetPassword(u)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <KeyRound className="w-4 h-4 text-slate-400" />
                              Réinitialiser le mot de passe
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
