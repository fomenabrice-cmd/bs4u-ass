import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Search, Printer, X, Loader2, Calendar, CreditCard,
  Banknote, Smartphone, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { buildTicketHTML } from "../../utils/printUtils";
import { PrintPreviewModal } from "../../components/ui/PrintPreviewModal";

const ease = [0.22, 1, 0.36, 1] as const;

type SaleItem = { name: string; qty: number; unit_price: number; subtotal: number };
type Sale = {
  id: string; ticket_no: string; client_name: string | null;
  subtotal: number; discount: number; total: number;
  payment_method: string; amount_received: number; change_given: number;
  created_at: string; items: SaleItem[];
  payment_breakdown?: Record<string, number> | null;
};

const PAY_ICON: Record<string, typeof Banknote> = {
  "Espèces": Banknote,
  "Orange Money": Smartphone,
  "MTN MoMo": Smartphone,
  "Chèque": CreditCard,
  "Virement": CreditCard,
};

const LIMIT = 25;

export function SalesHistory() {
  const [sales,   setSales]   = useState<Sale[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(0);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase.rpc("get_sales_history", { p_limit: LIMIT, p_offset: page * LIMIT }).then(({ data }) => {
      if (data) {
        setSales(data.sales as Sale[]);
        setTotal(data.total as number);
      }
      setLoading(false);
    });
  }, [page]);

  const filtered = sales.filter(s => {
    const q = search.toLowerCase();
    return !q || s.ticket_no.toLowerCase().includes(q) || (s.client_name ?? "").toLowerCase().includes(q);
  });

  function viewTicket(s: Sale) {
    const html = buildTicketHTML({
      ticketNo: s.ticket_no,
      items: s.items.map(i => ({ name: i.name, qty: i.qty, prixUnit: i.unit_price })),
      total: s.subtotal,
      remise: s.discount,
      modeReglement: s.payment_method,
      montantRecu: s.amount_received,
      client: s.client_name ?? undefined,
    });
    setPrintPreview({ html, title: `Ticket ${s.ticket_no}` });
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Historique des ventes</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{total} ventes enregistrées</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.1 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="N° ticket, client…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-[#F5F7F5] text-[#17231C] focus:outline-none focus:border-[#075B32] w-52" />
          </div>
          <span className="ml-auto text-xs text-[#A0ADA5]">{filtered.length} résultats</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#F5F7F5]">
                {["Ticket","Date & heure","Client","Articles","Montant","Paiement",""].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-5 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F7F5]">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-[#A0ADA5] text-sm">Aucune vente trouvée</td></tr>
              )}
              {filtered.map((s, i) => {
                const PayIcon = PAY_ICON[s.payment_method] ?? CreditCard;
                const dt = new Date(s.created_at);
                return (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 + i * 0.02 }}
                    className="hover:bg-[#F5F7F5] transition-colors cursor-pointer"
                    onClick={() => setSelected(s)}>
                    <td className="px-5 py-3.5 font-mono text-xs text-[#075B32] font-semibold">{s.ticket_no}</td>
                    <td className="px-5 py-3.5">
                      <p className="text-xs font-medium text-[#17231C]">{dt.toLocaleDateString("fr-FR")}</p>
                      <p className="text-[11px] text-[#A0ADA5]">{dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#17231C]">{s.client_name ?? <span className="text-[#C0CCC4]">—</span>}</td>
                    <td className="px-5 py-3.5 text-xs text-[#66736A]">{s.items.length} art.</td>
                    <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#17231C]">
                      {s.total.toLocaleString("fr-FR")} FCFA
                      {s.discount > 0 && <span className="text-xs text-amber-600 ml-1">-{s.discount.toLocaleString("fr-FR")}</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {s.payment_breakdown
                        ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[#66736A]">
                              <Banknote size={11} className="text-[#075B32]" />
                              <Smartphone size={11} className="text-[#075B32]" />
                              Mixte
                            </span>
                          )
                        : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#66736A]">
                              <PayIcon size={12} className="text-[#075B32]" /> {s.payment_method}
                            </span>
                          )
                      }
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={e => { e.stopPropagation(); viewTicket(s); }}
                        className="p-1.5 rounded-lg border border-[#E2E8E3] hover:bg-[#E8F3EC] hover:border-[#075B32]/30 text-[#66736A] hover:text-[#075B32] transition-colors">
                        <Printer size={13} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pages > 1 && (
          <div className="px-5 py-3 border-t border-[#E2E8E3] flex items-center justify-between">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 text-xs text-[#66736A] hover:text-[#075B32] disabled:opacity-40 transition-colors">
              <ChevronLeft size={14} /> Précédent
            </button>
            <span className="text-xs text-[#A0ADA5]">Page {page + 1} / {pages}</span>
            <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 text-xs text-[#66736A] hover:text-[#075B32] disabled:opacity-40 transition-colors">
              Suivant <ChevronRight size={14} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Modal détail vente */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[#17231C] flex items-center gap-2">
                  <Receipt size={16} className="text-[#075B32]" /> {selected.ticket_no}
                </h2>
                <button onClick={() => setSelected(null)} className="text-[#A0ADA5] hover:text-[#17231C]"><X size={18} /></button>
              </div>
              <div className="text-xs text-[#66736A] flex items-center gap-2">
                <Calendar size={12} />
                {new Date(selected.created_at).toLocaleString("fr-FR")}
                {selected.client_name && <span className="ml-auto font-medium text-[#17231C]">{selected.client_name}</span>}
              </div>
              <div className="bg-[#F5F7F5] rounded-xl p-4 space-y-1.5">
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[#66736A]">{item.name} ×{item.qty}</span>
                    <span className="font-medium tabular-nums">{item.subtotal.toLocaleString("fr-FR")}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-[#D0D8D2] mt-2 pt-2">
                  {selected.discount > 0 && (
                    <div className="flex justify-between text-xs text-amber-700 mb-1">
                      <span>Remise</span><span>-{selected.discount.toLocaleString("fr-FR")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[#17231C]">
                    <span>Total</span><span className="text-[#075B32]">{selected.total.toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  {selected.payment_breakdown
                    ? (
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(selected.payment_breakdown).map(([m, v]) => (
                            <div key={m} className="flex justify-between text-xs text-[#66736A]">
                              <span>{m}</span>
                              <span className="tabular-nums">{v.toLocaleString("fr-FR")} FCFA</span>
                            </div>
                          ))}
                        </div>
                      )
                    : (
                        <div className="flex justify-between text-xs text-[#66736A] mt-1">
                          <span>{selected.payment_method}</span>
                          {selected.change_given > 0 && <span className="text-amber-700">Monnaie: {selected.change_given.toLocaleString("fr-FR")}</span>}
                        </div>
                      )
                  }
                </div>
              </div>
              <button onClick={() => viewTicket(selected)}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-[#075B32] border border-[#075B32] rounded-xl hover:bg-[#E8F3EC] transition-colors">
                <Printer size={15} /> Imprimer le ticket
              </button>
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
