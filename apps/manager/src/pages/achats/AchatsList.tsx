import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Truck, CheckCircle2, Clock, AlertCircle, Loader2, XCircle, FileText } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type PO = {
  id: string; reference: string; status: string;
  total_amount: number; expected_delivery: string | null; created_at: string;
  contacts: { company_name: string | null; full_name: string | null } | null;
  purchase_order_items: { description: string; quantity: number; unit_price: number }[];
};

const STATUS: Record<string, { label: string; bg: string; color: string; icon: typeof Clock }> = {
  draft:      { label: "Brouillon",   bg: "#F5F7F5", color: "#66736A", icon: FileText },
  ordered:    { label: "Commandé",    bg: "#EFF6FF", color: "#1E40AF", icon: Clock },
  in_transit: { label: "En transit",  bg: "#FFFBEB", color: "#92400E", icon: Truck },
  received:   { label: "Reçu",        bg: "#E8F3EC", color: "#075B32", icon: CheckCircle2 },
  cancelled:  { label: "Annulé",      bg: "#F5F7F5", color: "#A0ADA5", icon: XCircle },
  dispute:    { label: "Litige",      bg: "#FEF2F2", color: "#B91C1C", icon: AlertCircle },
};

function supplierName(c: PO["contacts"]) {
  return c?.company_name ?? c?.full_name ?? "—";
}

function itemsLabel(items: PO["purchase_order_items"]) {
  if (!items?.length) return "—";
  const first = items[0].description;
  return items.length > 1 ? `${first}, +${items.length - 1}` : first;
}

export function AchatsList() {
  const [orders,  setOrders]  = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [kpi,     setKpi]     = useState({ total_month: 0, amount_month: 0, pending: 0, disputes: 0 });
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("purchase_orders")
        .select("*, contacts(company_name,full_name), purchase_order_items(description,quantity,unit_price)")
        .order("created_at", { ascending: false }),
      supabase.rpc("get_purchases_kpis"),
    ]).then(([{ data }, { data: k }]) => {
      setOrders((data ?? []) as PO[]);
      if (k) setKpi(k as typeof kpi);
      setLoading(false);
    });
  }, []);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    return !q || o.reference.toLowerCase().includes(q)
      || supplierName(o.contacts).toLowerCase().includes(q);
  });

  const KPI_CARDS = [
    { label: "Commandes ce mois",    value: String(kpi.total_month),                                   color: "#075B32", bg: "#E8F3EC" },
    { label: "Montant engagé",       value: kpi.amount_month.toLocaleString("fr-FR"), sub: "FCFA",     color: "#1E40AF", bg: "#EFF6FF" },
    { label: "En attente livraison", value: String(kpi.pending),                                       color: "#92400E", bg: "#FFFBEB" },
    { label: "Litiges",              value: String(kpi.disputes),                                      color: "#B91C1C", bg: "#FEF2F2" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Achats & Fournisseurs</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Bons de commande · réceptions · fournisseurs</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Nouveau bon de commande
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, color, bg, sub }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            {sub && <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>}
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-[#F5F7F5] text-[#17231C] focus:outline-none focus:border-[#075B32] w-48" />
          </div>
          <span className="ml-auto text-xs text-[#A0ADA5]">{filtered.length} bons de commande</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#F5F7F5]">
                {["Référence","Fournisseur","Articles","Montant","Statut","Livraison"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-5 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F7F5]">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-16 text-[#A0ADA5] text-sm">Aucun bon de commande</td></tr>
              )}
              {filtered.map((a, i) => {
                const s = STATUS[a.status] ?? STATUS.draft;
                const Icon = s.icon;
                return (
                  <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                    className="hover:bg-[#F5F7F5] transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-mono text-xs text-[#075B32] font-semibold">{a.reference}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#17231C]">{supplierName(a.contacts)}</td>
                    <td className="px-5 py-3.5 text-xs text-[#66736A] max-w-[180px] truncate">{itemsLabel(a.purchase_order_items)}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231C]">
                      {a.total_amount.toLocaleString("fr-FR")} FCFA
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: s.bg, color: s.color }}>
                        <Icon size={11} /> {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#A0ADA5]">
                      {a.expected_delivery ?? "—"}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Modal nouveau BC — simple */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[#17231C] flex items-center gap-2">
              <Truck size={18} className="text-[#075B32]" /> Nouveau bon de commande
            </h2>
            <p className="text-sm text-[#66736A]">Fonctionnalité complète à venir — remplissez les informations via la fiche fournisseur.</p>
            <button onClick={() => setShowNew(false)}
              className="w-full py-2.5 text-sm text-white bg-[#075B32] rounded-xl hover:bg-[#063A22] transition-colors">
              Fermer
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
