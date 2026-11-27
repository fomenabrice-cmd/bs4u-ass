import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingDown, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { capitalService } from "../../services/finance";
import type { Loan } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_LABELS: Record<string, string> = {
  active: "Actif", closed: "Soldé", defaulted: "Défaut",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700", closed: "bg-emerald-100 text-emerald-700", defaulted: "bg-rose-100 text-rose-700",
};
const TYPE_LABELS: Record<string, string> = {
  bank: "Banque", personal: "Personnel", supplier: "Fournisseur", other: "Autre",
};

// ─── Modal : Nouvel emprunt ───────────────────────────────────────────────────

function CreateLoanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    lender: "", loan_type: "bank" as const, principal_xaf: 0,
    rate_pct: 0, disbursed_at: today(), due_date: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lender || form.principal_xaf <= 0) { setErr("Prêteur et montant requis."); return; }
    setLoading(true); setErr("");
    try {
      await capitalService.createLoan({
        lender:        form.lender,
        loan_type:     form.loan_type,
        principal_xaf: form.principal_xaf,
        rate_pct:      form.rate_pct,
        disbursed_at:  form.disbursed_at,
        due_date:      form.due_date || undefined,
        notes:         form.notes || undefined,
      });
      onCreated();
    } catch (e) { setErr((e as Error).message); setLoading(false); }
  };

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-200 outline-none";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="font-bold text-lg text-gray-900">Nouvel emprunt</h2>
        {err && <p className="text-rose-600 text-sm">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Prêteur *</label>
            <input className={inp} value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} placeholder="Nom de la banque ou du prêteur" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select className={inp} value={form.loan_type} onChange={e => setForm(f => ({ ...f, loan_type: e.target.value as typeof form.loan_type }))}>
              <option value="bank">Banque</option>
              <option value="personal">Personnel</option>
              <option value="supplier">Fournisseur</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Taux (%)</label>
            <input className={inp} type="number" min={0} step={0.01} value={form.rate_pct} onChange={e => setForm(f => ({ ...f, rate_pct: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Montant principal (XAF) *</label>
            <input className={inp} type="number" min={1} step={1} value={form.principal_xaf || ""} onChange={e => setForm(f => ({ ...f, principal_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date de décaissement</label>
            <input className={inp} type="date" value={form.disbursed_at} onChange={e => setForm(f => ({ ...f, disbursed_at: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Échéance</label>
            <input className={inp} type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {loading ? "Création…" : "Créer l'emprunt"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal : Enregistrer un remboursement ─────────────────────────────────────

function RecordRepaymentModal({ loan, onClose, onCreated }: { loan: Loan; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    total_xaf: 0, principal_xaf: 0, interest_xaf: 0, fees_xaf: 0,
    method: "cash" as const, paid_at: today(),
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.principal_xaf + form.interest_xaf + form.fees_xaf !== form.total_xaf) {
      setErr("Principal + Intérêts + Frais doit être égal au total."); return;
    }
    if (form.total_xaf <= 0) { setErr("Montant total requis."); return; }
    setLoading(true); setErr("");
    try {
      await capitalService.recordRepayment({
        loan_id:       loan.id,
        total_xaf:     form.total_xaf,
        principal_xaf: form.principal_xaf,
        interest_xaf:  form.interest_xaf,
        fees_xaf:      form.fees_xaf,
        method:        form.method,
        paid_at:       form.paid_at,
      });
      onCreated();
    } catch (e) { setErr((e as Error).message); setLoading(false); }
  };

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-emerald-200 outline-none";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="font-bold text-lg text-gray-900">Remboursement — {loan.lender}</h2>
        <p className="text-sm text-gray-500">Encours : <strong className="text-rose-600">{fmt(loan.outstanding_xaf)} XAF</strong></p>
        {err && <p className="text-rose-600 text-sm">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Total payé (XAF) *</label>
            <input className={inp} type="number" min={1} step={1} value={form.total_xaf || ""} onChange={e => setForm(f => ({ ...f, total_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">dont Principal</label>
            <input className={inp} type="number" min={0} step={1} value={form.principal_xaf || ""} onChange={e => setForm(f => ({ ...f, principal_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">dont Intérêts</label>
            <input className={inp} type="number" min={0} step={1} value={form.interest_xaf || ""} onChange={e => setForm(f => ({ ...f, interest_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">dont Frais</label>
            <input className={inp} type="number" min={0} step={1} value={form.fees_xaf || ""} onChange={e => setForm(f => ({ ...f, fees_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mode de paiement</label>
            <select className={inp} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value as typeof form.method }))}>
              <option value="cash">Espèces</option>
              <option value="transfer">Virement</option>
              <option value="momo">MoMo</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date de paiement</label>
            <input className={inp} type="date" value={form.paid_at} onChange={e => setForm(f => ({ ...f, paid_at: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
            {loading ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Carte emprunt ────────────────────────────────────────────────────────────

function LoanRow({ loan, onRepay }: { loan: Loan; onRepay: (l: Loan) => void }) {
  const pct = loan.principal_xaf > 0
    ? Math.min(100, (loan.repaid_principal_xaf / loan.principal_xaf) * 100)
    : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
    >
      <div className="flex justify-between items-start">
        <div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[loan.status]}`}>
            {STATUS_LABELS[loan.status]}
          </span>
          <p className="mt-1 font-semibold text-gray-900">{loan.lender}</p>
          <p className="text-xs text-gray-500">{TYPE_LABELS[loan.loan_type]} · {loan.loan_number}</p>
        </div>
        {loan.status === "closed"
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : <TrendingDown className="w-5 h-5 text-rose-400" />
        }
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-400">Principal</p>
          <p className="font-mono font-medium">{fmt(loan.principal_xaf)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Remboursé</p>
          <p className="font-mono font-medium text-emerald-600">{fmt(loan.repaid_principal_xaf)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Restant</p>
          <p className="font-mono font-medium text-rose-600">{fmt(loan.outstanding_xaf)}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Remboursement</span><span>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {loan.rate_pct > 0 && (
        <p className="text-xs text-gray-400">
          Taux : {loan.rate_pct}% · Intérêts payés : {fmt(loan.total_interest_paid_xaf)} XAF
        </p>
      )}

      {loan.status === "active" && (
        <button
          onClick={() => onRepay(loan)}
          className="w-full text-sm text-center py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors"
        >
          Enregistrer un remboursement
        </button>
      )}
    </motion.div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function FinanceLoans() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "closed">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null);

  const { data: loans = [], isLoading, error } = useQuery({
    queryKey: ["finance", "loans"],
    queryFn: () => capitalService.listLoans(),
    staleTime: 60_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["finance", "loans"] });
    void qc.invalidateQueries({ queryKey: ["finance", "dashboard-kpi"] });
    setShowCreate(false);
    setRepayLoan(null);
  };

  const filtered = filter === "all" ? loans : loans.filter(l => l.status === filter);
  const totalOutstanding = loans.filter(l => l.status === "active").reduce((s, l) => s + l.outstanding_xaf, 0);

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {showCreate && <CreateLoanModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {repayLoan && <RecordRepaymentModal loan={repayLoan} onClose={() => setRepayLoan(null)} onCreated={refresh} />}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dettes financières</h1>
          <p className="text-sm text-gray-500">
            Capital restant dû : <strong className="text-rose-600">{fmt(totalOutstanding)} XAF</strong>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouvel emprunt
        </button>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "closed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "Tous" : f === "active" ? "Actifs" : "Soldés"}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <p className="text-sm text-gray-400">Aucun emprunt trouvé.</p>
        : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(l => <LoanRow key={l.id} loan={l} onRepay={setRepayLoan} />)}
          </div>
        )
      }
    </div>
  );
}
