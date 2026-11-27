import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, ShoppingCart, Printer, Store,
  Banknote, Smartphone, TrendingUp, GraduationCap, Code2,
  VideoIcon, BarChart3, Menu, X, LogOut, Search, Plus,
  ChevronDown, ChevronRight, Wifi, WifiOff, Settings, UserCircle, Truck, History,
  FileText, PiggyBank, Building2, Calendar, BookOpen, Lock, Download, Target, Zap, Wallet,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationPanel } from "../ui/NotificationPanel";

type NavLeaf = { to: string; icon: LucideIcon; label: string; perm?: string };
type NavSubGroup = { subGroup: string; items: NavLeaf[] };

interface NavItem {
  group: string;
  items: (NavLeaf | NavSubGroup)[];
}

function isSubGroup(x: NavLeaf | NavSubGroup): x is NavSubGroup {
  return "subGroup" in x;
}

const NAV: NavItem[] = [
  {
    group: "Pilotage",
    items: [
      { to: "/",             icon: LayoutDashboard, label: "Tableau de bord" },
      { to: "/mon-activite", icon: TrendingUp,      label: "Mon activité" },
    ],
  },
  {
    group: "Clients & Commandes",
    items: [
      { to: "/clients",      icon: Users,        label: "Clients",      perm: "contacts.read" },
      { to: "/fournisseurs", icon: Truck,        label: "Fournisseurs", perm: "contacts.read" },
      { to: "/commandes",    icon: ShoppingCart, label: "Commandes",    perm: "orders.read" },
      { to: "/devis",        icon: BarChart3,    label: "Devis",        perm: "orders.write" },
    ],
  },
  {
    group: "Production",
    items: [
      { to: "/impression", icon: Printer, label: "Impression",  perm: "orders.write" },
      { to: "/secretariat",icon: Code2,   label: "Secrétariat", perm: "orders.read" },
    ],
  },
  {
    group: "Ventes & Stocks",
    items: [
      { to: "/vente",              icon: Store,        label: "Point de vente",    perm: "orders.write" },
      { to: "/produits",           icon: ShoppingCart, label: "Produits",          perm: "products.read" },
      { to: "/stocks",             icon: BarChart3,    label: "Stocks",            perm: "products.read" },
      { to: "/historique-ventes",  icon: History,      label: "Historique ventes", perm: "orders.read" },
    ],
  },
  {
    group: "Mobile Money",
    items: [
      { to: "/mobile-money",       icon: Smartphone, label: "Mobile Money",     perm: "momo.read" },
      { to: "/caisse",             icon: Banknote,   label: "Caisse",           perm: "cash.write" },
      { to: "/caisse/historique",  icon: History,    label: "Historique caisse",perm: "cash.read" },
      { to: "/comptes",            icon: TrendingUp, label: "Comptes",          perm: "cash.read" },
    ],
  },
  {
    group: "Finance",
    items: [
      { to: "/finance", icon: BarChart3, label: "Vue d'ensemble" },
      {
        subGroup: "Pilotage",
        items: [
          { to: "/finance/marges",             icon: TrendingUp, label: "Marges" },
          { to: "/finance/commissions",        icon: Zap,        label: "Commissions" },
          { to: "/finance/rentabilite",        icon: Target,     label: "Rentabilité" },
          { to: "/finance/rapports-financiers",icon: Download,   label: "Rapports" },
        ],
      },
      {
        subGroup: "Trésorerie",
        items: [
          { to: "/finance/tresorerie",   icon: Wallet,    label: "Trésorerie & comptes" },
          { to: "/finance/depenses",     icon: Banknote,  label: "Dépenses",        perm: "expenses.write" },
          { to: "/finance/encaissements",icon: TrendingUp,label: "Encaissements",   perm: "cash.write" },
          { to: "/finance/factures",     icon: FileText,  label: "Factures",        perm: "invoices.read" },
          { to: "/finance/journal",      icon: BookOpen,  label: "Journal comptable" },
          { to: "/finance/cloture",      icon: Lock,      label: "Clôtures" },
        ],
      },
      {
        subGroup: "Capital & actifs",
        items: [
          { to: "/finance/capital",        icon: TrendingUp, label: "Capital" },
          { to: "/finance/reserves",       icon: PiggyBank,  label: "Réserves" },
          { to: "/finance/immobilisations",icon: Building2,  label: "Immobilisations" },
          { to: "/finance/amortissements", icon: Calendar,   label: "Amortissements" },
          { to: "/finance/emprunts",       icon: Banknote,   label: "Emprunts" },
        ],
      },
      {
        subGroup: "Config",
        items: [
          { to: "/finance/parametres-finance", icon: Settings, label: "Paramètres", perm: "settings.write" },
        ],
      },
    ],
  },
  {
    group: "Formation",
    items: [
      { to: "/formations", icon: GraduationCap, label: "Formations", perm: "trainings.read" },
    ],
  },
  {
    group: "Projets",
    items: [
      { to: "/projets",    icon: Code2,    label: "Projets numériques", perm: "projects.read" },
      { to: "/abonnements",icon: Banknote, label: "Abonnements",        perm: "orders.write" },
    ],
  },
  {
    group: "Réunions IA",
    items: [
      { to: "/reunions", icon: VideoIcon, label: "Réunions" },
    ],
  },
  {
    group: "Rapports",
    items: [
      { to: "/rapports", icon: BarChart3, label: "Rapports", perm: "reports.read" },
    ],
  },
];

const NEW_ITEMS = [
  { label: "Commande",              icon: ShoppingCart, to: "/commandes/nouvelle" },
  { label: "Vente rapide",          icon: Store,        to: "/vente" },
  { label: "Opération Mobile Money",icon: Smartphone,   to: "/mobile-money/nouvelle" },
  { label: "Document",              icon: FileText,     to: "/secretariat" },
  { label: "Client",                icon: Users,        to: "/clients" },
];

function NavSubGroupSection({
  sg, perms, sidebarOpen, defaultOpen,
}: {
  sg: NavSubGroup; perms: Set<string> | null; sidebarOpen: boolean; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = sg.items.filter(item => !item.perm || perms === null || perms.has(item.perm));
  if (!visible.length) return null;
  if (!sidebarOpen) {
    return (
      <>
        {visible.map(item => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => `relative flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
              isActive ? "bg-[#075B32]/90 text-white font-semibold shadow-sm" : "text-[#9AA79F] hover:text-white hover:bg-white/8"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
          </NavLink>
        ))}
      </>
    );
  }
  return (
    <div className="mb-0.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center w-full px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#4d7a60] hover:text-[#9AA79F] transition-colors"
      >
        <span className="flex-1 text-left">{sg.subGroup}</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && visible.map(item => (
        <NavLink key={item.to} to={item.to}
          className={({ isActive }) => `relative flex items-center gap-3 pl-6 pr-4 py-1.5 mx-2 rounded-lg text-sm transition-colors ${
            isActive ? "bg-[#075B32]/90 text-white font-semibold shadow-sm" : "text-[#9AA79F] hover:text-white hover:bg-white/8"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [searchOpen, setSearchOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // null = show all (before load or demo mode); Set = filtered by RBAC
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { session, demoUser } = useAuth();
  const { notifications, unreadCount, loading: notifLoading, markAsRead, markAllAsRead } = useNotifications();

  // Réseau : réactif aux événements réels
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Ctrl+K → ouvrir recherche ; Échap → fermer tout
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); setNewMenuOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus auto sur l'input de recherche à l'ouverture
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);

  // Permissions RBAC : charge depuis api.v_my_permissions (null = show all)
  useEffect(() => {
    if (demoUser) return;
    supabase.from("v_my_permissions").select("code").then(({ data }) => {
      // empty = no perms configured → show all (null)
      if (data?.length) setPerms(new Set(data.map((r: { code: string }) => r.code)));
    });
  }, [demoUser]);

  // Fermer le menu + Nouveau au clic extérieur
  useEffect(() => {
    if (!newMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [newMenuOpen]);

  const handleLogout = async () => {
    if (demoUser) {
      const { clearDemoSession } = await import("../../hooks/useAuth");
      clearDemoSession();
    } else {
      await supabase.auth.signOut();
    }
    navigate("/connexion");
  };

  const displayName = demoUser?.name
    ?? (session?.user?.user_metadata?.["first_name"]
      ? `${session.user.user_metadata["first_name"]} ${session.user.user_metadata["last_name"] ?? ""}`.trim()
      : session?.user?.email ?? "Utilisateur");

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F7F5]">
      {/* ===== MODAL DE RECHERCHE ===== */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-24"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8E3]">
              <Search className="w-5 h-5 text-[#66736A] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher un client, commande, facture, produit…"
                className="flex-1 text-sm outline-none text-[#17231C] placeholder-[#66736A]"
              />
              <kbd className="text-xs bg-[#F5F7F5] border border-[#E2E8E3] rounded px-1.5 py-0.5">Échap</kbd>
            </div>
            <p className="px-4 py-6 text-sm text-[#66736A] text-center">
              Tapez pour rechercher — résultats en cours de développement.
            </p>
          </div>
        </div>
      )}

      {/* ===== SIDEBAR ===== */}
      <aside
        className={`flex flex-col h-full bg-[#063A22] transition-all duration-200 shrink-0 ${
          sidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between p-4 border-b border-[#0a4f2d]">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#D6A52B] flex items-center justify-center text-xs font-bold text-[#063A22]">
                BS
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-none">BS4U</p>
                <p className="text-[#9AA79F] text-xs">Manager</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#9AA79F] hover:text-white p-1 rounded"
            aria-label={sidebarOpen ? "Réduire le menu" : "Étendre le menu"}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Navigation principale">
          {NAV.map((group) => {
            // Collect all visible leaves to decide if we render the group at all
            const allLeaves: NavLeaf[] = group.items.flatMap(item =>
              isSubGroup(item) ? item.items : [item]
            );
            const anyVisible = allLeaves.some(item => !item.perm || perms === null || perms.has(item.perm));
            if (!anyVisible) return null;

            const isFinanceActive = location.pathname.startsWith("/finance");

            return (
              <div key={group.group} className="mb-1">
                {sidebarOpen && (
                  <p className="text-[#66736A] text-[10px] font-semibold uppercase tracking-wider px-4 py-1">
                    {group.group}
                  </p>
                )}
                {group.items.map((item, idx) => {
                  if (isSubGroup(item)) {
                    return (
                      <NavSubGroupSection
                        key={item.subGroup}
                        sg={item}
                        perms={perms}
                        sidebarOpen={sidebarOpen}
                        defaultOpen={isFinanceActive && idx <= 2}
                      />
                    );
                  }
                  const leaf = item;
                  if (leaf.perm && perms !== null && !perms.has(leaf.perm)) return null;
                  return (
                    <NavLink
                      key={leaf.to}
                      to={leaf.to}
                      end={leaf.to === "/"}
                      className={({ isActive }) =>
                        `relative flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-[#075B32]/90 text-white font-semibold shadow-sm"
                            : "text-[#9AA79F] hover:text-white hover:bg-white/8"
                        }`
                      }
                    >
                      <leaf.icon className="w-4 h-4 shrink-0" />
                      {sidebarOpen && <span>{leaf.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Pied de sidebar */}
        <div className="border-t border-[#0a4f2d] p-3 space-y-1">
          <button
            onClick={() => navigate("/profil")}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-[#9AA79F] hover:text-white hover:bg-[#0a4f2d] text-sm transition-colors"
          >
            <UserCircle className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Mon Profil</span>}
          </button>
          <button
            onClick={() => navigate("/parametres-locaux")}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-[#9AA79F] hover:text-[#D6A52B] hover:bg-[#0a4f2d] text-sm transition-colors"
          >
            <Settings className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Préférences</span>}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-[#9AA79F] hover:text-red-400 hover:bg-[#0a4f2d] text-sm transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ===== ZONE PRINCIPALE ===== */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-[#E2E8E3] flex items-center justify-between px-4 shrink-0 shadow-xs">
          {/* Recherche globale */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 text-sm text-[#66736A] bg-[#F5F7F5] border border-[#E2E8E3] rounded-lg px-3 py-2 hover:bg-[#E8F3EC] transition-colors min-w-[220px]"
            aria-label="Rechercher (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span>Rechercher…</span>
            <kbd className="ml-auto text-xs bg-white border border-[#E2E8E3] rounded px-1">Ctrl+K</kbd>
          </button>

          {/* Actions header */}
          <div className="flex items-center gap-3">
            {/* Bouton + Nouveau avec dropdown */}
            <div ref={newMenuRef} className="relative">
              <button
                onClick={() => setNewMenuOpen(!newMenuOpen)}
                className="flex items-center gap-1 bg-[#075B32] text-white text-sm px-3 py-2 rounded-lg hover:bg-[#063A22] transition-colors"
                aria-expanded={newMenuOpen}
                aria-haspopup="menu"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${newMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {newMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-[#E2E8E3] py-1 z-40"
                >
                  {NEW_ITEMS.map(item => (
                    <button
                      key={item.to}
                      role="menuitem"
                      onClick={() => { navigate(item.to); setNewMenuOpen(false); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#17231C] hover:bg-[#F5F7F5] transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-[#075B32] shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Indicateur réseau réactif */}
            <div
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                isOnline ? "text-[#067647] bg-[#E8F3EC]" : "text-[#B54708] bg-orange-50"
              }`}
              role="status"
              aria-label={isOnline ? "Connecté" : "Hors ligne"}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isOnline ? "En ligne" : "Hors ligne"}</span>
            </div>

            {/* Notifications */}
            <NotificationPanel
              open={notifOpen}
              onToggle={() => setNotifOpen(v => !v)}
              onClose={() => setNotifOpen(false)}
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notifLoading}
              markAsRead={markAsRead}
              markAllAsRead={markAllAsRead}
            />

            {/* Profil */}
            <button onClick={() => navigate("/profil")} className="flex items-center gap-2 text-sm text-[#17231C] hover:bg-[#F5F7F5] rounded-lg px-2 py-1 transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#075B32] text-white flex items-center justify-center text-xs font-semibold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:block max-w-[120px] truncate">{displayName}</span>
              <ChevronDown className="w-3 h-3 text-[#66736A]" />
            </button>
          </div>
        </header>

        {/* Bandeau mode démo */}
        {demoUser && (
          <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-between gap-2 flex-shrink-0">
            <span>⚠ Mode démonstration — vous voyez une interface fictive. Les données Supabase ne sont pas accessibles. Déconnectez-vous et reconnectez-vous avec votre vrai compte.</span>
            <button onClick={handleLogout} className="underline whitespace-nowrap hover:no-underline">Se déconnecter →</button>
          </div>
        )}

        {/* Contenu principal */}
        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
