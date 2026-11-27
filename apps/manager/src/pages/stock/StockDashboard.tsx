import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, AlertTriangle, TrendingUp, TrendingDown, Plus,
  ArrowDown, ArrowUp, RotateCcw, Printer, X, Search,
  ChevronDown, ChevronUp, Calendar, FileText, Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { buildStockA4 } from "../../utils/printUtils";
import { PrintPreviewModal } from "../../components/ui/PrintPreviewModal";

const ease = [0.22, 1, 0.36, 1] as const;

type StockItem = {
  id: string; sku: string | null; name: string; category: string;
  qty: number; min_qty: number; unit: string; unit_price_xaf: number; track_stock: boolean;
};

type Movement = {
  id: string; sku: string; product_name: string; created_at: string;
  movement_type: "in" | "out" | "adjustment" | "transfer" | "loss";
  quantity: number; unit_cost: number | null; notes: string | null; reference: string | null;
};

const TYPE_MAP: Record<Movement["movement_type"], { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  in:         { label: "Entrée",      bg: "bg-green-50",  text: "text-green-700",  icon: <ArrowDown size={12} /> },
  out:        { label: "Sortie",      bg: "bg-red-50",    text: "text-red-700",    icon: <ArrowUp size={12} />   },
  adjustment: { label: "Ajustement", bg: "bg-blue-50",   text: "text-blue-700",   icon: <RotateCcw size={12} /> },
  transfer:   { label: "Transfert",  bg: "bg-amber-50",  text: "text-amber-700",  icon: <RotateCcw size={12} /> },
  loss:       { label: "Perte",      bg: "bg-red-50",    text: "text-red-700",    icon: <ArrowUp size={12} />   },
};

export function StockDashboard() {
  const [items,       setItems]       = useState<StockItem[]>([]);
  const [movements,   setMovements]   = useState<Movement[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [appModal,    setAppModal]    = useState(false);
  const [adjModal,    setAdjModal]    = useState<StockItem | null>(null);
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string; paper: "80mm" | "A4" } | null>(null);

  const [detailModal, setDetailModal] = useState<StockItem | null>(null);

  const [appForm, setAppForm] = useState({ product_id: "", qty: "", unit_cost: "", notes: "", reference: "" });
  const [adjQty,  setAdjQty]  = useState("");
  const [adjMotif,setAdjMotif]= useState("");
  const [saving,  setSaving]  = useState(false);

  async function load() {
    const [{ data: prods }, { data: mvts }] = await Promise.all([
      supabase.from("products")
        .select("id, sku, name, unit, unit_price, cost_price, min_stock, track_stock, product_categories(name), inventory(quantity)")
        .eq("is_active", true)
        .order("name"),
      supabase.from("stock_movements")
        .select("id, movement_type, quantity, unit_cost, notes, reference, created_at, products(sku, name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setItems((prods ?? []).map((p: any) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.product_categories?.name ?? "—",
      qty: p.inventory?.[0]?.quantity ?? 0,
      min_qty: p.min_stock ?? 0,
      unit: p.unit ?? "unité",
      unit_price_xaf: p.unit_price ?? 0,
      track_stock: p.track_stock ?? false,
    })));

    setMovements((mvts ?? []).map((m: any) => ({
      id: m.id,
      sku: m.products?.sku ?? "—",
      product_name: m.products?.name ?? "—",
      created_at: m.created_at,
      movement_type: m.movement_type,
      quantity: m.quantity,
      unit_cost: m.unit_cost ?? null,
      notes: m.notes,
      reference: m.reference,
    })));

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered    = items.filter(it => !search || it.name.toLowerCase().includes(search.toLowerCase()) || (it.sku ?? "").toLowerCase().includes(search.toLowerCase()));
  const alertCount  = items.filter(it => it.track_stock && it.qty <= it.min_qty).length;
  const totalValeur = items.reduce((s, it) => s + it.qty * it.unit_price_xaf, 0);

  async function validerAppro() {
    const q = parseInt(appForm.qty);
    if (!appForm.product_id || !q || q <= 0) return;
    setSaving(true);
    await supabase.rpc("create_stock_appro", {
      p_product_id: appForm.product_id,
      p_quantity:   q,
      p_unit_cost:  appForm.unit_cost ? parseInt(appForm.unit_cost) : null,
      p_reference:  appForm.reference || null,
      p_notes:      appForm.notes || null,
    });
    setSaving(false);
    setAppForm({ product_id: "", qty: "", unit_cost: "", notes: "", reference: "" });
    setAppModal(false);
    load();
  }

  async function validerAjustement() {
    if (!adjModal || !adjQty) return;
    const delta = parseInt(adjQty);
    if (!delta) return;
    setSaving(true);
    await supabase.rpc("create_stock_adjustment", {
      p_product_id: adjModal.id,
      p_quantity:   delta,
      p_notes:      adjMotif || "Ajustement inventaire",
    });
    setSaving(false);
    setAdjModal(null); setAdjQty(""); setAdjMotif("");
    load();
  }

  function printStock() {
    const html = buildStockA4(items.map(it => ({
      sku: it.sku ?? "—", name: it.name, category: it.category,
      qty: it.qty, unit: it.unit, min_qty: it.min_qty, unit_price_xaf: it.unit_price_xaf,
    })));
    setPrintPreview({ html, title: "État du stock", paper: "A4" });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Gestion des stocks</h1>
          <p className="text-sm text-[#66736A] mt-0.5">
            {items.length} références · Valeur totale : {totalValeur.toLocaleString("fr-FR")} FCFA
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={printStock}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
            <Printer size={15} /> Imprimer A4
          </button>
          <button onClick={() => setAppModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#075B32] text-white text-sm font-semibold hover:bg-[#063A22] transition-colors">
            <Plus size={15} /> Approvisionnement
          </button>
        </div>
      </motion.div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Références",     value: items.length,  icon: Package,       color: "#075B32", bg: "#E8F3EC" },
          { label: "Alertes stock",  value: alertCount,    icon: AlertTriangle, color: "#D97757", bg: "#FEF3EE" },
          { label: "Entrées (mois)", value: movements.filter(m => m.movement_type === "in").length,  icon: TrendingDown, color: "#1E40AF", bg: "#EFF6FF" },
          { label: "Sorties (mois)", value: movements.filter(m => m.movement_type === "out").length, icon: TrendingUp,   color: "#6D28D9", bg: "#F5F3FF" },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease, delay: i * 0.07 }}
            className="rounded-2xl p-4 border border-black/5 shadow-sm" style={{ backgroundColor: bg }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}18` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-[#66736A] mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700"><strong>{alertCount} référence(s)</strong> sous le seuil minimum.</p>
        </div>
      )}

      {/* Tableau stock */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.3 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2E8E3]">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0CCC4]" />
            <input type="text" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 w-full text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F7F5]">
                  {["SKU","Article","Catégorie","Qté","Min","P.U. FCFA","État",""].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F7F5]">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-[#A0ADA5] text-sm">Aucun produit</td></tr>
                )}
                {filtered.map((it, idx) => {
                  const alert    = it.track_stock && it.qty <= it.min_qty;
                  const pct      = it.min_qty > 0 ? Math.min(100, Math.round((it.qty / (it.min_qty * 2)) * 100)) : 100;
                  const histMvt  = movements.filter(m => m.sku === it.sku);
                  const expanded = expandedId === it.id;
                  return (
                    <>
                      <motion.tr key={it.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`hover:bg-[#F5F7F5] transition-colors cursor-pointer ${alert ? "bg-red-50/40" : ""}`}
                        onClick={() => setDetailModal(it)}>
                        <td className="px-4 py-3.5 text-xs font-mono text-[#A0ADA5]">{it.sku ?? "—"}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-[#17231C]">{it.name}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs bg-[#F5F7F5] text-[#66736A] px-2 py-0.5 rounded-full">{it.category}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          {it.track_stock ? (
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold tabular-nums ${alert ? "text-red-600" : "text-[#17231C]"}`}>
                                {it.qty} {it.unit}
                              </span>
                              <div className="w-14 h-1.5 bg-[#E2E8E3] rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${alert ? "bg-red-500" : "bg-[#075B32]"}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ) : <span className="text-xs text-[#A0ADA5]">illimité</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-[#66736A] tabular-nums">{it.min_qty}</td>
                        <td className="px-4 py-3.5 text-sm tabular-nums text-[#17231C]">{it.unit_price_xaf.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3.5">
                          {!it.track_stock ? <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">Service</span>
                          : alert ? <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">⚠ Faible</span>
                          : <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">OK</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            {it.track_stock && (
                              <button onClick={e => { e.stopPropagation(); setAdjModal(it); }}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E2E8E3] text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
                                Ajuster
                              </button>
                            )}
                            <button onClick={e => { e.stopPropagation(); setExpandedId(expanded ? null : it.id); }}
                              className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#A0ADA5] hover:bg-[#F5F7F5] transition-colors">
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>
                        </td>
                      </motion.tr>

                      <AnimatePresence>
                        {expanded && (
                          <tr key={`hist-${it.id}`}>
                            <td colSpan={8} className="px-0 py-0 bg-[#FAFCFA]">
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease }}
                                className="overflow-hidden">
                                <div className="px-6 py-4">
                                  <p className="text-xs font-semibold text-[#66736A] uppercase tracking-widest mb-3">Historique — {it.name}</p>
                                  {histMvt.length === 0
                                    ? <p className="text-xs text-[#C0CCC4]">Aucun mouvement enregistré.</p>
                                    : (
                                      <div className="space-y-2">
                                        {histMvt.map(mv => {
                                          const st = TYPE_MAP[mv.movement_type];
                                          return (
                                            <div key={mv.id} className={`flex items-center gap-3 ${st.bg} rounded-xl px-4 py-2.5`}>
                                              <span className={`flex items-center gap-1 text-xs font-semibold ${st.text} w-20`}>{st.icon} {st.label}</span>
                                              <span className={`text-sm font-bold tabular-nums ${st.text}`}>{mv.quantity > 0 ? "+" : ""}{mv.quantity}</span>
                                              <span className="flex-1 text-xs text-[#66736A] truncate">{mv.notes ?? mv.reference ?? "—"}</span>
                                              <span className="text-xs text-[#A0ADA5] flex items-center gap-1 flex-shrink-0">
                                                <Calendar size={11} /> {new Date(mv.created_at).toLocaleDateString("fr-FR")}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Journal global */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.5 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex items-center gap-2">
          <FileText size={15} className="text-[#075B32]" />
          <h2 className="text-sm font-semibold text-[#17231C]">Journal des mouvements récents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F5F7F5]">
                {["Date","Produit","Type","Qté","Référence","Notes"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F7F5]">
              {movements.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-[#A0ADA5] text-sm">Aucun mouvement</td></tr>
              )}
              {movements.slice(0, 20).map((mv, i) => {
                const st = TYPE_MAP[mv.movement_type];
                return (
                  <motion.tr key={mv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="hover:bg-[#F5F7F5] transition-colors">
                    <td className="px-4 py-3 text-xs text-[#66736A]">{new Date(mv.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-sm text-[#17231C] font-medium max-w-[160px] truncate">{mv.product_name}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold ${st.text} ${st.bg} px-2 py-0.5 rounded-full w-fit`}>
                        {st.icon} {st.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold tabular-nums ${st.text}`}>{mv.quantity > 0 ? "+" : ""}{mv.quantity}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[#A0ADA5]">{mv.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#66736A] max-w-xs truncate">{mv.notes ?? "—"}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── MODAL Détail produit ── */}
      <AnimatePresence>
        {detailModal && (() => {
          const it = detailModal;
          const alert = it.track_stock && it.qty <= it.min_qty;
          const pct = it.min_qty > 0 ? Math.min(100, Math.round((it.qty / (it.min_qty * 2)) * 100)) : 100;
          const histMvt = movements.filter(m => m.sku === it.sku).slice(0, 10);
          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDetailModal(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 text-[#17231C] max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono text-[#A0ADA5]">{it.sku ?? "—"}</p>
                    <h3 className="font-bold text-lg leading-tight">{it.name}</h3>
                    <span className="text-xs bg-[#F5F7F5] text-[#66736A] px-2 py-0.5 rounded-full inline-block mt-1">{it.category}</span>
                  </div>
                  <button onClick={() => setDetailModal(null)} className="text-[#A0ADA5] hover:text-[#17231C] flex-shrink-0 mt-1">
                    <X size={20} />
                  </button>
                </div>

                {/* Stock info */}
                <div className="bg-[#F5F7F5] rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#66736A]">Stock actuel</span>
                    {!it.track_stock
                      ? <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-medium">Service (illimité)</span>
                      : alert
                        ? <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">⚠ Faible</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">OK</span>}
                  </div>
                  {it.track_stock ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className={`text-3xl font-bold tabular-nums ${alert ? "text-red-600" : "text-[#075B32]"}`}>{it.qty}</span>
                        <span className="text-sm text-[#66736A] mb-1">{it.unit}</span>
                        <span className="text-xs text-[#A0ADA5] mb-1 ml-auto">min. {it.min_qty} {it.unit}</span>
                      </div>
                      <div className="w-full h-2 bg-[#E2E8E3] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${alert ? "bg-red-500" : "bg-[#075B32]"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[#A0ADA5]">Suivi de stock désactivé pour ce produit.</p>
                  )}
                  <div className="flex justify-between pt-1 text-sm">
                    <span className="text-[#66736A]">Prix unitaire</span>
                    <span className="font-semibold tabular-nums">{it.unit_price_xaf.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  {it.track_stock && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#66736A]">Valeur en stock</span>
                      <span className="font-semibold tabular-nums text-[#075B32]">
                        {(it.qty * it.unit_price_xaf).toLocaleString("fr-FR")} FCFA
                      </span>
                    </div>
                  )}
                </div>

                {/* Historique */}
                <div>
                  <p className="text-xs font-semibold text-[#66736A] uppercase tracking-widest mb-3">Derniers mouvements</p>
                  {histMvt.length === 0
                    ? <p className="text-xs text-[#C0CCC4] text-center py-4">Aucun mouvement enregistré.</p>
                    : (
                      <div className="space-y-2">
                        {histMvt.map(mv => {
                          const st = TYPE_MAP[mv.movement_type];
                          return (
                            <div key={mv.id} className={`flex items-center gap-3 ${st.bg} rounded-xl px-4 py-2.5`}>
                              <span className={`flex items-center gap-1 text-xs font-semibold ${st.text} w-20 flex-shrink-0`}>{st.icon} {st.label}</span>
                              <span className={`text-sm font-bold tabular-nums ${st.text} w-10 flex-shrink-0`}>{mv.quantity > 0 ? "+" : ""}{mv.quantity}</span>
                              <span className="flex-1 text-xs text-[#66736A] truncate">{mv.notes ?? mv.reference ?? "—"}</span>
                              {mv.unit_cost != null && mv.movement_type === "in" && (
                                <span className="text-xs font-semibold text-green-700 flex-shrink-0 tabular-nums">
                                  {mv.unit_cost.toLocaleString("fr-FR")} FCFA/u
                                </span>
                              )}
                              <span className="text-xs text-[#A0ADA5] flex items-center gap-1 flex-shrink-0">
                                <Calendar size={11} /> {new Date(mv.created_at).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  {it.track_stock && (
                    <button onClick={() => { setDetailModal(null); setAppForm(f => ({ ...f, product_id: it.id })); setAppModal(true); }}
                      className="w-full py-3 rounded-xl bg-[#075B32] text-white text-sm font-semibold hover:bg-[#063A22] transition-colors flex items-center justify-center gap-2">
                      <Plus size={15} /> Réapprovisionner
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setDetailModal(null)}
                      className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
                      Fermer
                    </button>
                    {it.track_stock && (
                      <button onClick={() => { setDetailModal(null); setAdjModal(it); }}
                        className="flex-1 py-3 rounded-xl border border-[#075B32] text-[#075B32] text-sm font-semibold hover:bg-[#E8F3EC] transition-colors">
                        Ajuster le stock
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ── MODAL Approvisionnement ── */}
      <AnimatePresence>
        {appModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Nouvel approvisionnement</h3>
                <button onClick={() => setAppModal(false)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Article *</label>
                  <select value={appForm.product_id} onChange={e => setAppForm(f => ({ ...f, product_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30">
                    <option value="">— Choisir un article —</option>
                    {items.filter(it => it.track_stock).map(it => <option key={it.id} value={it.id}>{it.name} ({it.sku ?? "—"})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Quantité *</label>
                    <input type="number" min={1} value={appForm.qty} onChange={e => setAppForm(f => ({ ...f, qty: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">N° BC / Référence</label>
                    <input type="text" value={appForm.reference} onChange={e => setAppForm(f => ({ ...f, reference: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">
                    Prix d'achat unitaire (FCFA) <span className="text-[#A0ADA5] normal-case font-normal">— pour la comptabilité</span>
                  </label>
                  <input type="number" min={0} value={appForm.unit_cost} onChange={e => setAppForm(f => ({ ...f, unit_cost: e.target.value }))}
                    placeholder="ex. 1500"
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                  {appForm.unit_cost && appForm.qty && (
                    <p className="text-xs text-[#66736A] mt-1">
                      Total achat : <strong>{(parseInt(appForm.unit_cost) * parseInt(appForm.qty) || 0).toLocaleString("fr-FR")} FCFA</strong>
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Notes</label>
                  <textarea value={appForm.notes} rows={2} onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Fournisseur, remarques…"
                    className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAppModal(false)} className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">Annuler</button>
                <button onClick={validerAppro} disabled={!appForm.product_id || !appForm.qty || saving}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold hover:bg-[#063A22] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Valider l'entrée
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL Ajustement ── */}
      <AnimatePresence>
        {adjModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Ajustement de stock</h3>
                <button onClick={() => setAdjModal(null)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>
              <div className="bg-[#F5F7F5] rounded-xl p-3">
                <p className="text-xs text-[#66736A]">{adjModal.name}</p>
                <p className="text-sm font-semibold mt-0.5">Stock actuel : <span className="text-[#075B32]">{adjModal.qty} {adjModal.unit}</span></p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Variation (ex. +5 ou -3)</label>
                <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="ex. -2 ou +10"
                  className="w-full px-4 py-3 border border-[#E2E8E3] rounded-xl text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                {adjQty && (
                  <p className="text-xs text-[#66736A] mt-1 text-center">
                    Nouveau stock : <strong>{Math.max(0, adjModal.qty + (parseInt(adjQty) || 0))} {adjModal.unit}</strong>
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736A] uppercase tracking-wide mb-1 block">Motif *</label>
                <input type="text" value={adjMotif} onChange={e => setAdjMotif(e.target.value)} placeholder="ex. Inventaire physique, casse…"
                  className="w-full px-3 py-2.5 border border-[#E2E8E3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setAdjModal(null)} className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">Annuler</button>
                <button onClick={validerAjustement} disabled={!adjQty || !adjMotif || saving}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold hover:bg-[#063A22] transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {printPreview && (
          <PrintPreviewModal html={printPreview.html} title={printPreview.title} paper={printPreview.paper} onClose={() => setPrintPreview(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
