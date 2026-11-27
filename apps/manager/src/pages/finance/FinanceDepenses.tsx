import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, TrendingDown } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

const CAT_LABELS: Record<string, string> = {
  loyer: "Loyer", charges_fixes: "Charges fixes", fournitures: "Fournitures",
  salaires: "Salaires", maintenance: "Maintenance", marketing: "Marketing",
  transport: "Transport", autre: "Autre",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces", mtn_momo: "MTN MoMo", orange_money: "Orange Money",
  transfer: "Virement", cheque: "Chèque", other: "Autre",
};

const CATS = ["Toutes", ...Object.keys(CAT_LABELS)];

interface Depense {
  id: string;
  expense_number: string;
  label: string;
  category: string;
  amount_xaf: number;
  method: string;
  has_receipt: boolean;
  expense_date: string;
}

export function FinanceDepenses() {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("Toutes");

  useEffect(() => {
    supabase
      .from("v_depenses")
      .select("id, expense_number, label, category, amount_xaf, method, has_receipt, expense_date")
      .order("expense_date", { ascending: false })
      .then(({ data }) => setDepenses((data ?? []) as Depense[]));
  }, []);

  const monthStart = new Date();
  monthStart.setDate(1);
  const ms = monthStart.toISOString().slice(0, 10);

  const thisMonthdeps    = depenses.filter(d => d.expense_date >= ms);
  const totalMois        = thisMonthdeps.reduce((s, d) => s + d.amount_xaf, 0);
  const sansJustificatif = depenses.filter(d => !d.has_receipt).length;
  const totalSalaires    = depenses.filter(d => d.category === "salaires").reduce((s, d) => s + d.amount_xaf, 0);

  const KPI = [
    { label: "Dépenses ce mois",   value: fmt(totalMois),       sub: "FCFA",         color: "#B91C1C", bg: "#FEF2F2" },
    { label: "Sans justificatif",  value: String(sansJustificatif), sub: "à régulariser", color: "#92400E", bg: "#FFFBEB" },
    { label: "Salaires & charges", value: fmt(totalSalaires),   sub: "FCFA",         color: "#6D28D9", bg: "#F5F3FF" },
  ];

  const filtered = depenses.filter(d =>
    (cat === "Toutes" || d.category === cat) &&
    (d.label.toLowerCase().includes(search.toLowerCase()) || d.expense_number.includes(search))
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Dépenses</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Charges · trésorerie · rapprochements</p>
        </div>
        <button className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
          <Plus size={16} /> Saisir une dépense
        </button>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.25 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8E3] flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8E3] text-sm bg-[#F5F7F5] text-[#17231C] focus:outline-none focus:border-[#075B32] w-48" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: cat === c ? "#B91C1C" : "#F5F7F5", color: cat === c ? "#fff" : "#66736A" }}>
                {c === "Toutes" ? "Toutes" : (CAT_LABELS[c] ?? c)}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-[#A0ADA5]">{filtered.length} dépense{filtered.length > 1 ? "s" : ""}</span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="bg-[#F5F7F5]">
              {["Référence", "Libellé", "Catégorie", "Montant", "Mode", "Justificatif", "Date"].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-[#66736A] px-5 py-3 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F7F5]">
            {filtered.map((d, i) => (
              <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + i * 0.04 }}
                className="hover:bg-[#F5F7F5] transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs text-[#B91C1C] font-semibold">{d.expense_number}</td>
                <td className="px-5 py-3.5 text-sm text-[#17231C] max-w-[200px] truncate">{d.label}</td>
                <td className="px-5 py-3.5">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#F5F7F5] text-[#66736A]">
                    {CAT_LABELS[d.category] ?? d.category}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-sm font-semibold tabular-nums text-[#B91C1C]">{fmt(d.amount_xaf)} FCFA</td>
                <td className="px-5 py-3.5 text-xs text-[#66736A]">{METHOD_LABELS[d.method] ?? d.method}</td>
                <td className="px-5 py-3.5">
                  {d.has_receipt
                    ? <span className="text-xs px-2.5 py-1 rounded-full bg-[#E8F3EC] text-[#075B32] font-medium">Joint</span>
                    : <span className="text-xs px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#92400E] font-medium">Manquant</span>}
                </td>
                <td className="px-5 py-3.5 text-xs text-[#A0ADA5]">{d.expense_date}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <TrendingDown size={32} className="mx-auto text-[#E2E8E3] mb-3" />
            <p className="text-sm text-[#A0ADA5]">
              {depenses.length === 0 ? "Aucune dépense enregistrée" : "Aucune dépense trouvée"}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
