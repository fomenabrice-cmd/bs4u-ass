import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  paid:    { label: "Payée",     cls: "bg-[#E8F3EC] text-[#067647]", icon: CheckCircle2 },
  partial: { label: "Partiel",   cls: "bg-blue-50 text-[#175CD3]",   icon: TrendingUp },
  sent:    { label: "Envoyée",   cls: "bg-orange-50 text-[#B54708]", icon: Clock },
  overdue: { label: "En retard", cls: "bg-red-50 text-[#B42318]",    icon: Clock },
  draft:   { label: "Brouillon", cls: "bg-[#F5F7F5] text-[#66736A]", icon: Clock },
  void:    { label: "Annulée",   cls: "bg-[#F5F7F5] text-[#66736A]", icon: Clock },
};

const STATUTS = ["Tous", "paid", "partial", "sent", "overdue"];

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  total_xaf: number;
  paid_xaf: number;
  issued_at: string;
  customer_name: string;
}

export function FinanceEncaissements() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");

  useEffect(() => {
    supabase
      .from("v_invoices")
      .select("id, invoice_number, status, total_xaf, paid_xaf, issued_at, customer_name")
      .not("status", "eq", "draft")
      .order("issued_at", { ascending: false })
      .then(({ data }) => setInvoices((data ?? []) as InvoiceRow[]));
  }, []);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const ms = monthStart.toISOString().slice(0, 10);

  const encaisseCeMois   = invoices.filter(i => i.issued_at >= ms).reduce((s, i) => s + i.paid_xaf, 0);
  const enAttente        = invoices.filter(i => ["sent", "partial", "overdue"].includes(i.status));
  const montantEnAttente = enAttente.reduce((s, i) => s + (i.total_xaf - i.paid_xaf), 0);
  const creancesTotales  = invoices.reduce((s, i) => s + Math.max(0, i.total_xaf - i.paid_xaf), 0);

  const KPI = [
    { label: "Encaissé ce mois",   value: fmt(encaisseCeMois),    sub: "FCFA",      color: "#075B32", bg: "#E8F3EC" },
    { label: "En attente",         value: String(enAttente.length), sub: "factures", color: "#92400E", bg: "#FFFBEB" },
    { label: "Montant en attente", value: fmt(montantEnAttente),   sub: "FCFA",      color: "#1E40AF", bg: "#EFF6FF" },
    { label: "Créances totales",   value: fmt(creancesTotales),    sub: "FCFA",      color: "#6D28D9", bg: "#F5F3FF" },
  ];

  const filtered = invoices.filter(i => {
    const q = search.toLowerCase();
    return (
      (statusFilter === "Tous" || i.status === statusFilter) &&
      (!q || i.invoice_number.toLowerCase().includes(q) || i.customer_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Encaissements</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Paiements reçus · affectations · créances</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Enregistrer un paiement
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI.map(({ label, value, sub, color, bg }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-sm border border-black/5" style={{ backgroundColor: bg }}>
            <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color }}>{sub}</p>
            <p className="text-xs text-[#66736A] mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8E3] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E2E8E3] flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66736A]" />
            <input
              type="search" placeholder="N° facture ou client…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUTS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-[#075B32] text-white"
                    : "bg-[#F5F7F5] text-[#66736A] hover:bg-[#E8F3EC]"
                }`}>
                {s === "Tous" ? "Toutes" : (STATUS_CFG[s]?.label ?? s)}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#66736A] text-right px-4 py-2 border-b border-[#F5F7F5]">
          {filtered.length} facture{filtered.length > 1 ? "s" : ""}
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Référence</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden sm:table-cell">Client</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Montant</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Statut</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden md:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8E3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#A0ADA5]">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
                  <p>Aucune facture trouvée</p>
                </td>
              </tr>
            ) : filtered.map(inv => {
              const cfg = STATUS_CFG[inv.status] ?? STATUS_CFG.sent;
              const Icon = cfg.icon;
              return (
                <tr key={inv.id} className="hover:bg-[#F5F7F5] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-[#075B32] font-semibold">{inv.invoice_number}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#17231C] hidden sm:table-cell">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <p className="font-semibold text-[#17231C]">{fmt(inv.paid_xaf)} <span className="text-xs text-[#66736A]">FCFA</span></p>
                    {inv.paid_xaf < inv.total_xaf && (
                      <p className="text-xs text-[#A0ADA5]">/ {fmt(inv.total_xaf)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-[#66736A] hidden md:table-cell">{inv.issued_at}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
