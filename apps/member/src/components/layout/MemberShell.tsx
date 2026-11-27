import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, User, CreditCard, FileText, BookOpen, LogOut } from "lucide-react";

const NAV = [
  { to: "/tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "/profil",          icon: User,            label: "Mon profil" },
  { to: "/adhesion",        icon: CreditCard,      label: "Adhésion & Cotisations" },
  { to: "/documents",       icon: FileText,        label: "Mes documents" },
  { to: "/formation",       icon: BookOpen,        label: "Formation" },
];

export function MemberShell() {
  return (
    <div className="flex h-screen bg-[#F5F7F5]">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-[#075B32] flex flex-col">
        <div className="px-4 py-5 border-b border-[#063A22]/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#D6A52B] flex items-center justify-center">
              <span className="text-[#063A22] font-bold text-xs">BS4U</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Espace Membre</p>
              <p className="text-[#9AA79F] text-xs">Association BS4U</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {NAV.map(({ to, icon: Icon, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-[#063A22] text-white font-medium"
                        : "text-[#D6E8DC] hover:bg-[#063A22]/50 hover:text-white"
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-3 border-t border-[#063A22]/50">
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[#D6E8DC] hover:bg-[#063A22]/50 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
