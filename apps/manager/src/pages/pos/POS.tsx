import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone,
  Search, X, User, Tag, Printer, CheckCircle, Clock, PauseCircle,
  PlayCircle, Scan, Receipt, Loader2, AlertTriangle,
} from "lucide-react";
import { buildTicketHTML } from "../../utils/printUtils";
import { PrintPreviewModal } from "../../components/ui/PrintPreviewModal";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type Product = {
  id: string; sku: string; name: string; unit_price: number;
  category: string; track_stock: boolean; qty_stock: number; min_stock: number;
};
type CartItem = { id: string; sku: string; name: string; price_xaf: number; qty: number };
type HeldSale = { id: string; items: CartItem[]; client: string; heldAt: string };

const MODES = ["Espèces", "Orange Money", "MTN MoMo", "Chèque", "Virement"] as const;

export function POS() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loadingProd, setLoadingProd] = useState(true);
  const [cart,      setCart]      = useState<CartItem[]>([]);
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("Tous");
  const [client,    setClient]    = useState("");
  const [remise,    setRemise]    = useState(0);
  const [held,      setHeld]      = useState<HeldSale[]>([]);
  const [payModal,  setPayModal]  = useState(false);
  const [holdModal, setHoldModal] = useState(false);
  const [receipt,   setReceipt]   = useState<{ ticketNo: string; mode: string; recu: number; breakdown?: Record<string, number> } | null>(null);
  const [isMixte,   setIsMixte]   = useState(false);
  const [mixteAmounts, setMixteAmounts] = useState<Partial<Record<typeof MODES[number], number>>>({});
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null);
  const [mode,      setMode]      = useState<typeof MODES[number]>("Espèces");
  const [recu,      setRecu]      = useState(0);
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Charger les produits et la session de caisse ouverte en parallèle
    Promise.all([
      supabase.rpc("get_pos_products"),
      supabase.from("cash_sessions")
        .select("id")
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: prods }, { data: sess }]) => {
      setProducts((prods ?? []) as Product[]);
      setCashSessionId(sess?.id ?? null);
      setLoadingProd(false);
    });
  }, []);

  const categories = ["Tous", ...Array.from(new Set(products.map(p => p.category)))];
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        && (catFilter === "Tous" || p.category === catFilter);
  });

  const total    = cart.reduce((s, i) => s + i.price_xaf * i.qty, 0);
  const totalNet = total - remise;
  const monnaie  = mode === "Espèces" ? Math.max(0, recu - totalNet) : 0;
  const mixteTotal   = Object.values(mixteAmounts).reduce((s, v) => s + (v ?? 0), 0);
  const mixteRestant = totalNet - mixteTotal;

  function addProduit(p: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, sku: p.sku, name: p.name, price_xaf: p.unit_price, qty: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  }

  function setQty(id: string, v: number) {
    if (v < 1) return;
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: v } : i));
  }

  function clearCart() { setCart([]); setClient(""); setRemise(0); setIsMixte(false); setMixteAmounts({}); }

  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const val = e.currentTarget.value.trim();
    const found = products.find(p => p.sku === val);
    if (found) addProduit(found);
    e.currentTarget.value = "";
  }

  function holdSale() {
    if (!cart.length) return;
    setHeld(prev => [...prev, { id: Date.now().toString(), items: [...cart], client, heldAt: new Date().toLocaleTimeString("fr-CM") }]);
    clearCart();
    setHoldModal(false);
  }

  function restoreSale(id: string) {
    const sale = held.find(s => s.id === id);
    if (!sale) return;
    setCart(sale.items);
    setClient(sale.client);
    setHeld(prev => prev.filter(s => s.id !== id));
    setHoldModal(false);
  }

  async function validerPaiement() {
    if (!isMixte && mode === "Espèces" && recu < totalNet) return;
    if (isMixte && mixteRestant !== 0) return;

    const needsSession = isMixte ? (mixteAmounts["Espèces"] ?? 0) > 0 : mode === "Espèces";
    let sessionId = cashSessionId;
    if (needsSession && !sessionId) {
      const { data: sess } = await supabase.from("cash_sessions").select("id").eq("status", "open").order("opened_at", { ascending: false }).limit(1).maybeSingle();
      sessionId = sess?.id ?? null;
      if (sessionId) setCashSessionId(sessionId);
    }

    const breakdown = isMixte
      ? Object.fromEntries(Object.entries(mixteAmounts).filter(([, v]) => (v ?? 0) > 0) as [string, number][])
      : null;
    const payMode = isMixte ? "Mixte" : mode;
    const amtReceived = isMixte ? totalNet : (mode === "Espèces" ? recu : totalNet);

    const items = cart.map(i => ({ product_id: i.id, name: i.name, qty: i.qty, unit_price: i.price_xaf }));
    const { data, error } = await supabase.rpc("create_pos_sale", {
      p_items: items,
      p_client_name: client || null,
      p_payment_method: payMode,
      p_subtotal: total,
      p_discount: remise,
      p_total: totalNet,
      p_amount_received: amtReceived,
      p_cash_session_id: needsSession ? sessionId : null,
      p_payment_breakdown: breakdown,
    });
    if (error) console.error("create_pos_sale error:", error);
    const ticketNo = data?.ticket_no ?? `TK-${Date.now()}`;
    setPayModal(false);
    setReceipt({ ticketNo, mode: payMode, recu: amtReceived, breakdown: breakdown ?? undefined });
    supabase.rpc("get_pos_products").then(({ data: d }) => setProducts((d ?? []) as Product[]));
  }

  function printTicket(ticketNo: string, m: string, r: number) {
    const html = buildTicketHTML({
      ticketNo,
      items: cart.map(i => ({ name: i.name, qty: i.qty, prixUnit: i.price_xaf })),
      total, remise, modeReglement: m, montantRecu: r,
      client: client || undefined,
    });
    setPrintPreview({ html, title: `Ticket ${ticketNo}` });
  }

  function terminerVente(ticketNo: string, m: string, r: number) {
    printTicket(ticketNo, m, r);
    clearCart();
    setReceipt(null);
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#F5F7F5]">

      {/* ── Catalogue ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 bg-white border-b border-[#E2E8E3] space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <Scan size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
              <input ref={scanRef} type="text" placeholder="Code-barres…" onKeyDown={onScan}
                className="pl-9 pr-3 py-2 text-xs border border-[#E2E8E3] rounded-xl w-36 focus:outline-none focus:ring-2 focus:ring-[#075B32]/30 bg-white" />
            </div>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
              <input type="text" placeholder="Rechercher un article…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-xs border border-[#E2E8E3] rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-[#075B32]/30 bg-white" />
            </div>
            <button onClick={() => setHoldModal(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8E3] text-xs text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
              <PauseCircle size={15} />
              {held.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {held.length}
                </span>
              )}
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${catFilter === cat ? "bg-[#075B32] text-white" : "bg-[#F5F7F5] text-[#66736A] hover:bg-[#E8F3EC]"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
          {loadingProd && (
            <div className="col-span-4 flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#075B32]" />
            </div>
          )}
          {filtered.map((p, i) => {
            const lowStock = p.track_stock && p.qty_stock <= p.min_stock;
            const outOfStock = p.track_stock && p.qty_stock <= 0;
            return (
              <motion.button key={p.id} onClick={() => !outOfStock && addProduit(p)}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, delay: i * 0.025 }}
                disabled={outOfStock}
                className={`bg-white rounded-2xl p-4 text-left border transition-all active:scale-95 ${
                  outOfStock ? "opacity-50 cursor-not-allowed border-[#E2E8E3]"
                  : "border-[#E2E8E3] hover:border-[#075B32]/40 hover:shadow-md"
                }`}>
                <div className="text-[10px] font-mono text-[#C0CCC4] mb-1">{p.sku}</div>
                <div className="text-sm font-medium text-[#17231C] leading-tight mb-2 line-clamp-2">{p.name}</div>
                <div className="text-base font-bold text-[#075B32] tabular-nums">
                  {p.unit_price.toLocaleString("fr-FR")}<span className="text-xs font-normal text-[#A0ADA5] ml-1">FCFA</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-[#A0ADA5] bg-[#F5F7F5] rounded-lg px-2 py-0.5">{p.category}</span>
                  {p.track_stock && (
                    <span className={`text-[10px] font-semibold rounded-lg px-2 py-0.5 flex items-center gap-1 ${
                      outOfStock ? "bg-red-100 text-red-600"
                      : lowStock  ? "bg-amber-100 text-amber-700"
                      :             "bg-[#E8F3EC] text-[#075B32]"
                    }`}>
                      {lowStock && !outOfStock && <AlertTriangle size={9} />}
                      {outOfStock ? "Rupture" : `Stock: ${p.qty_stock}`}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Panier ── */}
      <div className="w-80 bg-white border-l border-[#E2E8E3] flex flex-col shadow-xl">
        <div className="p-4 border-b border-[#E2E8E3] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#17231C] flex items-center gap-2 text-sm">
              <ShoppingCart size={15} className="text-[#075B32]" />
              Panier · {cart.reduce((s, i) => s + i.qty, 0)} art.
            </h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 transition-colors">Vider</button>
            )}
          </div>
          <div className="relative">
            <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0CCC4]" />
            <input type="text" placeholder="Nom du client (optionnel)" value={client}
              onChange={e => setClient(e.target.value)}
              className="pl-8 pr-3 py-2 w-full text-xs border border-[#E2E8E3] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <AnimatePresence>
            {cart.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center py-14 text-[#C0CCC4]">
                <ShoppingCart size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Cliquez sur un article</p>
              </motion.div>
            )}
            {cart.map(item => (
              <motion.div key={item.id} layout
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="bg-[#F5F7F5] rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium text-[#17231C] flex-1 leading-tight">{item.name}</span>
                  <button onClick={() => setCart(c => c.filter(i => i.id !== item.id))} className="text-red-300 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(item.id, -1)}
                      className="w-6 h-6 rounded-lg bg-white border border-[#E2E8E3] flex items-center justify-center hover:bg-[#E8F3EC] transition-colors">
                      <Minus size={11} />
                    </button>
                    <input type="number" value={item.qty} min={1}
                      onChange={e => setQty(item.id, parseInt(e.target.value) || 1)}
                      className="w-10 text-center text-xs font-bold border border-[#E2E8E3] rounded-lg py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#075B32]/30" />
                    <button onClick={() => changeQty(item.id, 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-[#E2E8E3] flex items-center justify-center hover:bg-[#E8F3EC] transition-colors">
                      <Plus size={11} />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-[#075B32] tabular-nums">
                    {(item.price_xaf * item.qty).toLocaleString("fr-FR")}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-[#E2E8E3] space-y-3">
          <div className="flex items-center gap-2">
            <Tag size={13} className="text-[#C0CCC4] flex-shrink-0" />
            <input type="number" placeholder="Remise (FCFA)" value={remise || ""}
              min={0} max={total}
              onChange={e => setRemise(Math.min(parseInt(e.target.value) || 0, total))}
              className="flex-1 text-xs border border-[#E2E8E3] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
          </div>
          {remise > 0 && (
            <div className="flex justify-between text-xs text-[#66736A]">
              <span>Sous-total</span>
              <span className="tabular-nums">{total.toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-semibold text-[#17231C]">Total</span>
            <span className="text-xl font-bold text-[#075B32] tabular-nums">
              {totalNet.toLocaleString("fr-FR")}<span className="text-xs font-normal text-[#A0ADA5] ml-1">FCFA</span>
            </span>
          </div>
          <motion.button onClick={() => { setRecu(totalNet); setIsMixte(false); setMixteAmounts({}); setPayModal(true); }} disabled={cart.length === 0}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-2xl bg-[#075B32] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <CreditCard size={16} /> Encaisser
          </motion.button>
        </div>
      </div>

      {/* ── MODAL paiement ── */}
      <AnimatePresence>
        {payModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#17231C] text-lg">Encaissement</h3>
                <button onClick={() => setPayModal(false)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>

              <div className="bg-[#F5F7F5] rounded-2xl p-4 text-center">
                <p className="text-xs text-[#66736A] mb-1">Montant à encaisser</p>
                <p className="text-4xl font-bold text-[#075B32] tabular-nums">{totalNet.toLocaleString("fr-FR")}</p>
                <p className="text-sm text-[#A0ADA5]">FCFA</p>
                {client && <p className="text-xs text-[#66736A] mt-1.5">Client : <strong>{client}</strong></p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-[#66736A] uppercase tracking-widest">Mode de règlement</p>
                  <button onClick={() => { setIsMixte(m => !m); setMixteAmounts({}); }}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${isMixte ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32]" : "border-[#E2E8E3] text-[#66736A] hover:bg-[#F5F7F5]"}`}>
                    Mixte
                  </button>
                </div>

                {!isMixte && (
                  <div className="space-y-2">
                    {MODES.map(m => (
                      <button key={m} onClick={() => setMode(m)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${mode === m ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32]" : "border-[#E2E8E3] text-[#66736A] hover:bg-[#F5F7F5]"}`}>
                        {m === "Espèces" && <Banknote size={16} />}
                        {(m === "Orange Money" || m === "MTN MoMo") && <Smartphone size={16} />}
                        {(m === "Chèque" || m === "Virement") && <CreditCard size={16} />}
                        {m}
                        {mode === m && <CheckCircle size={15} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}

                {isMixte && (
                  <div className="space-y-2">
                    {MODES.map(m => (
                      <div key={m} className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-sm text-[#17231C] w-32 flex-shrink-0">
                          {m === "Espèces" && <Banknote size={14} className="text-[#075B32]" />}
                          {(m === "Orange Money" || m === "MTN MoMo") && <Smartphone size={14} className="text-[#075B32]" />}
                          {(m === "Chèque" || m === "Virement") && <CreditCard size={14} className="text-[#075B32]" />}
                          <span className="truncate text-xs">{m}</span>
                        </span>
                        <input type="number" min={0} placeholder="0"
                          value={mixteAmounts[m] || ""}
                          onChange={e => setMixteAmounts(prev => ({ ...prev, [m]: parseInt(e.target.value) || 0 }))}
                          className="flex-1 px-3 py-2 border border-[#E2E8E3] rounded-xl text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                      </div>
                    ))}
                    <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-sm font-semibold ${mixteRestant === 0 ? "bg-[#E8F3EC] text-[#075B32]" : mixteRestant < 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      <span>Restant</span>
                      <span className="tabular-nums">{mixteRestant.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  </div>
                )}
              </div>

              {!isMixte && mode === "Espèces" && (
                <div>
                  <p className="text-xs font-semibold text-[#66736A] uppercase tracking-widest mb-2">Montant reçu</p>
                  <input type="number" value={recu || ""} min={totalNet}
                    onChange={e => setRecu(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-[#E2E8E3] rounded-xl text-2xl font-bold text-center text-[#17231C] focus:outline-none focus:ring-2 focus:ring-[#075B32]/30" />
                  {recu >= totalNet && (
                    <div className="mt-2 flex justify-between items-center bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <span className="text-sm font-medium text-amber-800">Monnaie à rendre</span>
                      <span className="text-xl font-bold text-amber-800 tabular-nums">{monnaie.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  )}
                </div>
              )}

              <button onClick={validerPaiement}
                disabled={isMixte ? mixteRestant !== 0 : (mode === "Espèces" && recu < totalNet)}
                className="w-full py-4 rounded-2xl bg-[#075B32] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                <CheckCircle size={18} /> Valider le paiement
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL ticket ── */}
      <AnimatePresence>
        {receipt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 space-y-4 text-[#17231C]">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#E8F3EC] rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-[#075B32]" />
                </div>
                <h3 className="font-bold text-[#17231C]">Paiement validé !</h3>
                <p className="text-xs text-[#A0ADA5] mt-0.5">{receipt.ticketNo}</p>
              </div>

              <div className="bg-[#F5F7F5] rounded-2xl p-4 font-mono text-xs space-y-1">
                <div className="text-center font-bold text-sm border-b border-dashed border-[#D0D8D2] pb-2 mb-2">BS4U Manager</div>
                {cart.map(i => (
                  <div key={i.id} className="flex justify-between gap-2">
                    <span className="truncate flex-1 text-[#66736A]">{i.name} ×{i.qty}</span>
                    <span className="tabular-nums text-[#17231C]">{(i.price_xaf * i.qty).toLocaleString("fr-FR")}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-[#D0D8D2] pt-2 mt-2 flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span className="text-[#075B32]">{totalNet.toLocaleString("fr-FR")} FCFA</span>
                </div>
                {receipt.breakdown
                  ? Object.entries(receipt.breakdown).map(([m, v]) => (
                      <div key={m} className="text-[#66736A] flex justify-between">
                        <span>{m}</span>
                        <span className="tabular-nums">{v.toLocaleString("fr-FR")}</span>
                      </div>
                    ))
                  : (
                      <div className="text-[#66736A] flex justify-between">
                        <span>{receipt.mode}</span>
                        {receipt.mode === "Espèces" && monnaie > 0 && (
                          <span className="text-amber-700 font-bold">Monnaie : {monnaie.toLocaleString("fr-FR")}</span>
                        )}
                      </div>
                    )
                }
              </div>

              <div className="flex gap-3">
                <button onClick={() => printTicket(receipt.ticketNo, receipt.mode, receipt.recu)}
                  className="flex-1 py-3 rounded-xl border border-[#075B32] text-[#075B32] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#E8F3EC] transition-colors">
                  <Printer size={14} /> Imprimer
                </button>
                <button onClick={() => terminerVente(receipt.ticketNo, receipt.mode, receipt.recu)}
                  className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#063A22] transition-colors">
                  <Receipt size={14} /> Terminer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL ventes en attente ── */}
      <AnimatePresence>
        {holdModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.2, ease }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 text-[#17231C]">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#17231C]">Ventes en attente</h3>
                <button onClick={() => setHoldModal(false)}><X size={20} className="text-[#A0ADA5]" /></button>
              </div>

              {cart.length > 0 && (
                <button onClick={holdSale}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors">
                  <PauseCircle size={16} /> Mettre la vente courante en attente
                </button>
              )}

              {held.length === 0 && (
                <p className="text-sm text-center text-[#C0CCC4] py-6">Aucune vente en attente</p>
              )}

              <div className="space-y-2">
                {held.map(sale => (
                  <div key={sale.id} className="bg-[#F5F7F5] rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#17231C] truncate">{sale.client || "Client anonyme"}</div>
                      <div className="text-xs text-[#A0ADA5] flex items-center gap-1 mt-0.5">
                        <Clock size={11} /> {sale.heldAt} · {sale.items.length} réf.
                      </div>
                      <div className="text-xs font-bold text-[#075B32] mt-0.5">
                        {sale.items.reduce((s, i) => s + i.price_xaf * i.qty, 0).toLocaleString("fr-FR")} FCFA
                      </div>
                    </div>
                    <button onClick={() => restoreSale(sale.id)}
                      className="p-2 rounded-xl bg-[#075B32] text-white hover:bg-[#063A22] transition-colors flex-shrink-0">
                      <PlayCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {printPreview && (
          <PrintPreviewModal
            html={printPreview.html}
            title={printPreview.title}
            paper="80mm"
            onClose={() => setPrintPreview(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
