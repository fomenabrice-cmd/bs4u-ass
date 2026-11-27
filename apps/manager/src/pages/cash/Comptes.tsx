import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Banknote, Smartphone, TrendingUp, Wallet,
  Receipt, CreditCard, ArrowUpRight, Loader2, ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

type Account = {
  id: string;
  name: string;
  balance: number;
  link: string | null; // payment_method_link or null for caisse
  icon: "banknote" | "smartphone" | "wallet" | "credit_card";
  color: string;
  bg: string;
};

type Tx = {
  id: string;
  date: string;
  label: string;
  reference: string;
  amount: number;
};

const STYLE: Record<string, { color: string; bg: string; icon: Account["icon"] }> = {
  "Espèces":      { color: "#075B32", bg: "#E8F3EC",  icon: "banknote"     },
  "Orange Money": { color: "#EA580C", bg: "#FFF7ED",  icon: "smartphone"   },
  "MTN MoMo":     { color: "#D97706", bg: "#FFFBEB",  icon: "smartphone"   },
  "Chèque":       { color: "#2563EB", bg: "#EFF6FF",  icon: "credit_card"  },
  "Virement":     { color: "#7C3AED", bg: "#F5F3FF",  icon: "credit_card"  },
  _default:       { color: "#66736A", bg: "#F5F7F5",  icon: "wallet"       },
};

const TX_POSITIVE = new Set(["sale", "in", "deposit", "opening"]);

const ICONS = { banknote: Banknote, smartphone: Smartphone, wallet: Wallet, credit_card: CreditCard };

export function Comptes() {
  const [orgId, setOrgId]         = useState<string | null>(null);
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [selected, setSelected]   = useState<string>("caisse");
  const [txs, setTxs]             = useState<Tx[]>([]);
  const [loadTx, setLoadTx]       = useState(false);
  const [loading, setLoading]     = useState(true);

  /* ── Load all accounts ───────────────────────────────────────────── */
  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const oid = (user as any).app_metadata?.organization_id as string | null;
    if (!oid) { setLoading(false); return; }
    setOrgId(oid);

    const [{ data: sessData }, { data: secData }] = await Promise.all([
      supabase.from("cash_sessions")
        .select("opening_amount_xaf, status, cash_closings(counted_xaf)")
        .eq("organization_id", oid)
        .order("opened_at", { ascending: false })
        .limit(1),
      supabase.from("secondary_accounts")
        .select("id, name, account_type, current_balance, payment_method_link")
        .eq("organization_id", oid)
        .eq("is_active", true)
        .order("created_at"),
    ]);

    const sess = sessData?.[0] as any;
    const cashBalance = sess?.cash_closings?.[0]?.counted_xaf ?? sess?.opening_amount_xaf ?? 0;

    const all: Account[] = [
      {
        id: "caisse",
        name: "Compte Principal",
        balance: cashBalance,
        link: null,
        icon: "banknote",
        color: STYLE["Espèces"].color,
        bg: STYLE["Espèces"].bg,
      },
      ...(secData ?? []).map((s: any) => {
        const st = STYLE[s.payment_method_link ?? ""] ?? STYLE._default;
        return {
          id: s.id,
          name: s.name,
          balance: s.current_balance,
          link: s.payment_method_link,
          icon: st.icon,
          color: st.color,
          bg: st.bg,
        };
      }),
    ];

    setAccounts(all);
    setLoading(false);
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  /* ── Load transactions for selected account ──────────────────────── */
  useEffect(() => {
    if (!orgId || accounts.length === 0) return;
    setLoadTx(true);
    setTxs([]);

    if (selected === "caisse") {
      supabase.from("cash_movements")
        .select("id, movement_type, amount_xaf, description, reference, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setTxs((data ?? []).map((m: any) => ({
            id: m.id,
            date: m.created_at,
            label: m.description ?? m.movement_type,
            reference: m.reference ?? "",
            amount: TX_POSITIVE.has(m.movement_type) ? m.amount_xaf : -m.amount_xaf,
          })));
          setLoadTx(false);
        });
    } else {
      const acc = accounts.find(a => a.id === selected);
      if (!acc) { setLoadTx(false); return; }
      const link = acc.link;

      supabase.from("sales")
        .select("id, ticket_no, total, payment_method, payment_breakdown, created_at, client_name")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200)
        .then(({ data }) => {
          const rows = (data ?? []).filter((s: any) =>
            s.payment_method === link ||
            (s.payment_breakdown && s.payment_breakdown[link!] > 0)
          );
          setTxs(rows.map((s: any) => ({
            id: s.id,
            date: s.created_at,
            label: s.client_name ? `Vente — ${s.client_name}` : "Vente POS",
            reference: s.ticket_no,
            amount: s.payment_breakdown?.[link!] ?? s.total,
          })));
          setLoadTx(false);
        });
    }
  }, [selected, orgId, accounts]);

  const grandTotal = accounts.reduce((s, a) => s + a.balance, 0);
  const selAcc     = accounts.find(a => a.id === selected);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/caisse" className="flex items-center gap-1.5 text-sm text-[#66736A] hover:text-[#075B32] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Caisse
        </Link>
        <span className="text-[#E2E8E3]">/</span>
        <h1 className="text-xl font-semibold text-[#17231C]">Comptes</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
      ) : (
        <>
          {/* Account cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {accounts.map(acc => {
              const Icon = ICONS[acc.icon];
              const sel  = acc.id === selected;
              return (
                <motion.button key={acc.id} onClick={() => setSelected(acc.id)}
                  whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  className={`min-w-[180px] flex-shrink-0 rounded-xl border p-4 text-left transition-all cursor-pointer ${
                    sel ? "shadow-md" : "bg-white border-[#E2E8E3] hover:shadow-sm"
                  }`}
                  style={sel ? { borderColor: acc.color, background: acc.bg } : {}}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: sel ? "white" : acc.bg }}>
                      <Icon className="w-4 h-4" style={{ color: acc.color }} />
                    </div>
                    {sel && <ChevronRight className="w-4 h-4" style={{ color: acc.color }} />}
                  </div>
                  <p className="text-xs text-[#A0ADA5] mb-0.5 truncate max-w-[140px]">{acc.name}</p>
                  <p className="text-xl font-bold tabular-nums text-[#17231C]">{fmt(acc.balance)} F</p>
                </motion.button>
              );
            })}
          </div>

          {/* Total consolidé */}
          <div className="bg-[#063A22] rounded-xl p-5 mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#9AA79F] mb-1">Total consolidé — tous comptes</p>
              <p className="text-3xl font-bold text-white tabular-nums">{fmt(grandTotal)} F</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#D6A52B]" />
          </div>

          {/* Transactions section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#17231C]">
                Transactions — {selAcc?.name}
              </h2>
              {selAcc && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: selAcc.bg, color: selAcc.color }}>
                  Solde : {fmt(selAcc.balance)} F
                </span>
              )}
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
              {loadTx ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#075B32]" />
                </div>
              ) : txs.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-[#A0ADA5]">
                  <Receipt className="w-10 h-10 mb-2 opacity-25" />
                  <p className="text-sm">Aucune transaction pour ce compte</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
                      {["Date & heure", "Libellé", "Référence", "Montant"].map(h => (
                        <th key={h} className={`text-xs font-semibold text-[#66736A] uppercase tracking-wide px-5 py-3 ${h === "Montant" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F7F5]">
                    <AnimatePresence>
                      {txs.map((tx, i) => (
                        <motion.tr key={tx.id}
                          initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.015 }}
                          className="hover:bg-[#F5F7F5]">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <p className="text-xs font-medium text-[#17231C]">
                              {new Date(tx.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                            </p>
                            <p className="text-[11px] text-[#A0ADA5]">
                              {new Date(tx.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-[#17231C]">{tx.label}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#66736A]">{tx.reference || "—"}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                              <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${tx.amount < 0 ? "rotate-180" : ""}`} />
                              {tx.amount >= 0 ? "+" : ""}{fmt(Math.abs(tx.amount))} F
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
