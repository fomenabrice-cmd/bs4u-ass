import { Outlet, NavLink, Link } from "react-router-dom";
import { Search, User, Menu } from "lucide-react";
import { useState } from "react";

export function DiscoverLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F7F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#E2E8E3] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#075B32] flex items-center justify-center">
              <span className="text-white font-bold text-xs">BS4U</span>
            </div>
            <span className="font-semibold text-[#17231C] text-sm">Discover</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-sm relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66736A]" />
            <input type="search" placeholder="Chercher un talent, une expertise…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#E2E8E3] rounded-full bg-[#F5F7F5] text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>

          <nav className="hidden sm:flex items-center gap-4">
            <NavLink to="/profils" className={({ isActive }) =>
              `text-sm font-medium transition-colors ${isActive ? "text-[#075B32]" : "text-[#66736A] hover:text-[#17231C]"}`
            }>
              Talents
            </NavLink>
            <Link to="/creer-mon-profil"
              className="flex items-center gap-1.5 bg-[#075B32] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#063A22] transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Créer mon profil
            </Link>
          </nav>

          <button className="sm:hidden p-1.5" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="w-5 h-5 text-[#17231C]" />
          </button>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
