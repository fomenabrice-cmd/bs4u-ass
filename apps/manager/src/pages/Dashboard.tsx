import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import {
  TrendingUp, TrendingDown, Users, ShoppingCart, Printer,
  Banknote, AlertTriangle, ArrowUpRight, Smartphone,
  FileText, RefreshCw, Activity, CreditCard, ChevronRight,
  Building2, Clock
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

function KpiCard({ title, value, unit, sub, icon: Icon, color, trend, trendDir, href }: {
  title: string; value: string; unit?: string; sub?: string;
  icon: typeof TrendingUp; color: string; bg: string;
  trend?: string; trendDir?: "up" | "down"; href?: string;
} & { bg: string }) {
  const inner = (
    <div className="bg-white rounded-2xl border border-[#E2E8E3] p-5 hover:shadow-sm hover:border-[#075B32]/20 transition-all h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "18" }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-medium"
            style={{ color: trendDir === "up" ? "#075B32" : "#B91C1C" }}>
            {trendDir === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums text-[#17231C]">{value}</p>
      {unit && <p className="text-xs font-medium mt-0.5" style={{ color }}>{unit}</p>}
      <p className="text-sm text-[#66736A] mt-1">{title}</p>
      {sub && <p className="text-xs text-[#A0ADA5] mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link to={href} className="block h-full">{inner}</Link> : inner;
}

const statusMap: Record<string, { label: string; bg: string; color: string }> = {
  draft:         { label: "Brouillon",     bg: "#F5F7F5", color: "#66736A" },
  confirmed:     { label: "Confirmée",     bg: "#EFF6FF", color: "#1E40AF" },
  in_production: { label: "En production", bg: "#FFFBEB", color: "#92400E" },
  ready:         { label: "Prête",         bg: "#E8F3EC", color: "#075B32" },
  delivered:     { label: "Livrée",        bg: "#F5F7F5", color: "#66736A" },
  cancelled:     { label: "Annulée",       bg: "#FEF2F2", color: "#B91C1C" },
};

function fmt(n: number) { return n.toLocaleString("fr-FR"); }

export function Dashboard() {
  const today = new Date().toLocaleDateString("fr-CM", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [alertesStock, setAlertesStock] = useState<any[]>([]);
  const [renouvellements, setRenouvellements] = useState<any[]>([]);
  const [commandesCount, setCommandesCount] = useState(0);
  const [renouvCount, setRenouvCount] = useState(0);
  const [agencyInfo, setAgencyInfo] = useState<{
    name: string;
    sessionOpen: boolean;
    registerName?: string;
    openedAt?: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      // Agence / org de l'utilisateur connecté
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("establishment_id")
            .eq("id", user.id)
            .single();

          let displayName = "—";
          let sessionFilter: { establishment_id?: string } = {};

          if (profile?.establishment_id) {
            const { data: estab } = await supabase
              .from("establishments")
              .select("name")
              .eq("id", profile.establishment_id)
              .single();
            displayName = estab?.name ?? "—";
            sessionFilter = { establishment_id: profile.establishment_id };
          } else {
            // Admin org sans agence : nom via la table organizations (org_id dans le JWT)
            const orgId = (user as any).app_metadata?.organization_id;
            if (orgId) {
              const { data: org } = await supabase
                .from("organizations")
                .select("name")
                .eq("id", orgId)
                .single();
              displayName = org?.name ?? "Organisation";
            }
            // sessionFilter vide → toutes les sessions de l'org (RLS limite déjà)
          }

          let sessionQuery = supabase
            .from("cash_sessions")
            .select("id, cash_register:cash_register_id(name), opened_at")
            .eq("status", "open")
            .limit(1);
          if (sessionFilter.establishment_id) {
            sessionQuery = sessionQuery.eq("establishment_id", sessionFilter.establishment_id);
          }
          const { data: session } = await sessionQuery.maybeSingle();

          setAgencyInfo({
            name: displayName,
            sessionOpen: !!session,
            registerName: (session?.cash_register as any)?.name,
            openedAt: session?.opened_at ?? undefined,
          });
        }
      } catch {
        // 403 / RLS — bandeau silencieusement absent
      }
      // Commandes récentes (5 dernières)
      const { data: orders } = await supabase
        .from("orders")
        .select("id, reference, status, total, client:client_id(full_name, company_name, is_company)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (orders) {
        setRecentOrders(orders.map((o: any) => ({
          id: o.reference || o.id.slice(0, 8).toUpperCase(),
          client: o.client
            ? (o.client.is_company ? o.client.company_name : o.client.full_name) ?? "—"
            : "—",
          status: o.status ?? "draft",
          amount: o.total ?? 0,
        })));
      }

      // Nombre de commandes à traiter
      const { count: cCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["confirmed", "in_production"])
        .is("deleted_at", null);
      setCommandesCount(cCount ?? 0);

      // Alertes stock (produits en dessous du seuil)
      const { data: inv } = await supabase
        .from("inventory")
        .select("quantity, product:product_id(name, min_stock, unit, track_stock)");
      if (inv) {
        const low = inv.filter((i: any) =>
          i.product?.track_stock && i.quantity < (i.product?.min_stock ?? 0)
        );
        setAlertesStock(low.map((i: any) => ({
          article: i.product?.name ?? "?",
          stock: i.quantity,
          seuil: i.product?.min_stock ?? 0,
          unite: i.product?.unit ?? "",
        })));
      }

      // Renouvellements dans les 30 prochains jours
      const today = new Date().toISOString().split("T")[0];
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const in30str = in30.toISOString().split("T")[0];
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("end_date, client:client_id(full_name, company_name, is_company), plan:plan_id(name)")
        .gte("end_date", today)
        .lte("end_date", in30str)
        .eq("status", "active");
      if (subs) {
        setRenouvCount(subs.length);
        setRenouvellements(subs.slice(0, 3).map((s: any) => ({
          client: s.client
            ? (s.client.is_company ? s.client.company_name : s.client.full_name) ?? "—"
            : "—",
          service: s.plan?.name ?? "—",
          echeance: s.end_date,
        })));
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Tableau de bord</h1>
          <p className="text-sm text-[#66736A] mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/commandes/nouvelle"
            className="flex items-center gap-2 bg-[#075B32] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#063A22] transition-colors shadow-sm">
            <ShoppingCart size={15} /> Nouvelle commande
          </Link>
          <Link to="/vente"
            className="flex items-center gap-2 border border-[#E2E8E3] bg-white text-[#17231C] px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F5F7F5] transition-colors">
            <Banknote size={15} /> POS / Caisse
          </Link>
        </div>
      </motion.div>

      {/* Bandeau agence */}
      {agencyInfo && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
          <div className="flex items-center gap-3 bg-white border border-[#E2E8E3] rounded-xl px-4 py-2.5">
            <Building2 size={14} className="text-[#075B32] shrink-0" />
            <span className="text-sm font-semibold text-[#17231C]">{agencyInfo.name}</span>
            <span className="text-[#E2E8E3]">|</span>
            {agencyInfo.sessionOpen ? (
              <>
                <div className="w-2 h-2 rounded-full bg-[#067647] animate-pulse shrink-0" />
                <span className="text-sm font-medium text-[#067647]">Session ouverte</span>
                {agencyInfo.registerName && (
                  <span className="text-sm text-[#A0ADA5]">— {agencyInfo.registerName}</span>
                )}
                {agencyInfo.openedAt && (
                  <span className="flex items-center gap-1 text-xs text-[#A0ADA5]">
                    <Clock size={11} />
                    depuis {new Date(agencyInfo.openedAt).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-[#A0ADA5] shrink-0" />
                <span className="text-sm text-[#A0ADA5]">Aucune session caisse ouverte</span>
              </>
            )}
            <Link to="/caisse" className="ml-auto text-xs text-[#075B32] font-medium hover:underline flex items-center gap-0.5 shrink-0">
              Ouvrir la caisse <ArrowUpRight size={11} />
            </Link>
          </div>
        </motion.div>
      )}

      {/* Row 1 — KPIs activité */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Commandes à traiter", value: String(commandesCount), sub: "En attente + production", icon: ShoppingCart, color: "#92400E", bg: "#FFFBEB", href: "/commandes" },
          { title: "Alertes stock", value: String(alertesStock.length), sub: "Produits sous le seuil", icon: AlertTriangle, color: "#B91C1C", bg: "#FEF2F2", href: "/stocks" },
          { title: "Renouvellements proches", value: String(renouvCount), sub: "30 prochains jours", icon: RefreshCw, color: "#D6A52B", bg: "#FEFCE8", href: "/abonnements" },
          { title: "File d'impression", value: "0", sub: "Travaux en attente", icon: Printer, color: "#6D28D9", bg: "#F5F3FF", href: "/impression" },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}>
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </div>

      {/* Row 2 — Finance du jour */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Ventes du jour (POS)", value: "0", unit: "FCFA", icon: Banknote, color: "#075B32", bg: "#E8F3EC", href: "/vente" },
          { title: "Caisse (solde)", value: "0", unit: "FCFA", sub: "Session en cours", icon: Banknote, color: "#1E40AF", bg: "#EFF6FF", href: "/caisse" },
          { title: "Orange Money", value: "0", unit: "FCFA", sub: "Solde disponible", icon: Smartphone, color: "#F97316", bg: "#FFF7ED", href: "/mobile-money" },
          { title: "MTN Mobile Money", value: "0", unit: "FCFA", sub: "Solde disponible", icon: Smartphone, color: "#EAB308", bg: "#FEFCE8", href: "/mobile-money" },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.28 + i * 0.07 }}>
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </div>

      {/* Row 3 — Finance du mois */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "CA facturé ce mois", value: "0", unit: "FCFA", icon: TrendingUp, color: "#075B32", bg: "#E8F3EC", href: "/finance/factures" },
          { title: "Encaissements", value: "0", unit: "FCFA", icon: CreditCard, color: "#1E40AF", bg: "#EFF6FF", href: "/finance/encaissements" },
          { title: "Dépenses", value: "0", unit: "FCFA", sub: "ce mois", icon: TrendingDown, color: "#B91C1C", bg: "#FEF2F2", href: "/finance/depenses" },
          { title: "Créances clients", value: "0", unit: "FCFA", sub: "Factures non réglées", icon: FileText, color: "#B91C1C", bg: "#FEF2F2", href: "/finance/encaissements" },
        ].map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.56 + i * 0.07 }}>
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </div>

      {/* Corps principal — 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Commandes récentes */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.5 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E3]">
            <h2 className="text-sm font-semibold text-[#17231C]">Commandes récentes</h2>
            <Link to="/commandes" className="text-xs text-[#075B32] hover:underline flex items-center gap-0.5 font-medium">
              Voir tout <ArrowUpRight size={12} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart size={32} className="text-[#E2E8E3] mb-3" />
              <p className="text-sm text-[#A0ADA5]">Aucune commande pour le moment</p>
              <Link to="/commandes/nouvelle" className="mt-3 text-xs text-[#075B32] hover:underline font-medium">
                Créer une commande
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F5F7F5]">
              {recentOrders.map((o, i) => {
                const s = statusMap[o.status] ?? statusMap.draft;
                return (
                  <motion.div key={o.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.04 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F5F7F5] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#17231C] truncate">{o.client}</p>
                      <p className="text-xs text-[#A0ADA5]">{o.id}</p>
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-[#17231C] shrink-0">
                      {fmt(o.amount)} FCFA
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Alertes stock */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.55 }}
            className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#17231C]">Alertes stock</h2>
              <Link to="/stocks" className="text-xs text-[#075B32] font-medium hover:underline flex items-center gap-0.5">
                Stocks <ChevronRight size={12} />
              </Link>
            </div>
            {alertesStock.length === 0 ? (
              <p className="text-xs text-[#A0ADA5]">Aucune alerte stock</p>
            ) : (
              alertesStock.slice(0, 4).map(a => (
                <div key={a.article} className="flex items-start gap-2 mb-2 last:mb-0">
                  <AlertTriangle size={14} className="text-[#92400E] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#17231C]">{a.article}</p>
                    <p className="text-xs text-[#A0ADA5]">{a.stock} {a.unite} — seuil {a.seuil}</p>
                  </div>
                </div>
              ))
            )}
          </motion.div>

          {/* Renouvellements */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease, delay: 0.65 }}
            className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#17231C]">Renouvellements</h2>
              <Link to="/abonnements" className="text-xs text-[#075B32] font-medium hover:underline flex items-center gap-0.5">
                Voir <ChevronRight size={12} />
              </Link>
            </div>
            {renouvellements.length === 0 ? (
              <p className="text-xs text-[#A0ADA5]">Aucun renouvellement prévu</p>
            ) : (
              renouvellements.map(r => (
                <div key={r.client + r.echeance} className="flex items-start gap-2 mb-3 last:mb-0">
                  <RefreshCw size={13} className="text-[#D6A52B] mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-[#17231C]">{r.client}</p>
                    <p className="text-xs text-[#A0ADA5]">{r.service}</p>
                    <p className="text-xs text-[#92400E] font-medium mt-0.5">{r.echeance}</p>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </div>
      </div>

      {/* Activité équipe */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.7 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={15} className="text-[#075B32]" />
          <h2 className="text-sm font-semibold text-[#17231C]">Activité de l'équipe</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity size={28} className="text-[#E2E8E3] mb-2" />
          <p className="text-sm text-[#A0ADA5]">Les statistiques d'activité apparaîtront ici</p>
          <Link to="/mon-activite" className="mt-2 text-xs text-[#075B32] hover:underline font-medium">
            Voir mon activité
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
