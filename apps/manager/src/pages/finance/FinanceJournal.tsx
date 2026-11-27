import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, AlertCircle, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { journalService, periodService } from "../../services/finance";
import type { JournalEntry } from "../../services/finance";

const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-yellow-100 text-yellow-700",
  posted:   "bg-emerald-100 text-emerald-700",
  reversed: "bg-gray-100 text-gray-500",
};

type Line = { account_code: string; type: "debit" | "credit"; amount: number };

// ─── Modal : Nouvelle écriture ────────────────────────────────────────────────

function CreateEntryModal({ periodId, onClose, onCreated }: { periodId: string; onClose: () => void; onCreated: () => void }) {
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [lines, setLines] = useState<Line[]>([
    { account_code: "", type: "debit",  amount: 0 },
    { account_code: "", type: "credit", amount: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const totalDebit  = lines.filter(l => l.type === "debit").reduce((s, l) => s + l.amount, 0);
  const totalCredit = lines.filter(l => l.type === "credit").reduce((s, l) => s + l.amount, 0);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  const addLine = () => setLines(ls => [...ls, { account_code: "", type: "debit", amount: 0 }]);
  const removeLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) { setErr("Description requise."); return; }
    if (!balanced) { setErr(`Écriture non équilibrée : Débit ${fmt(totalDebit)} ≠ Crédit ${fmt(totalCredit)} XAF`); return; }
    if (lines.some(l => !l.account_code || l.amount <= 0)) { setErr("Toutes les lignes doivent avoir un compte et un montant."); return; }
    setLoading(true); setErr("");
    try {
      await journalService.createEntry({
        description,
        entry_date: entryDate,
        period_id:  periodId,
        lines: lines.map(l => ({
          account_code: l.account_code,
          debit_xaf:    l.type === "debit"  ? l.amount : 0,
          credit_xaf:   l.type === "credit" ? l.amount : 0,
        })),
      });
      onCreated();
    } catch (e) { setErr((e as Error).message); setLoading(false); }
  };

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg text-gray-900">Nouvelle écriture (brouillon)</h2>
        {err && <p className="text-rose-600 text-sm">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Description *</label>
            <input className={`${inp} w-full`} value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Achat fournitures de bureau" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date</label>
            <input className={`${inp} w-full`} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <div className={`text-sm px-3 py-2 rounded-lg w-full text-center font-medium ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
              {balanced ? `✓ Équilibré (${fmt(totalDebit)} XAF)` : `Δ ${fmt(Math.abs(totalDebit - totalCredit))} XAF`}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 text-xs text-gray-400 px-1">
            <span className="col-span-4">Compte SYSCOHADA</span>
            <span className="col-span-3">Type</span>
            <span className="col-span-4">Montant (XAF)</span>
            <span className="col-span-1" />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 items-center">
              <input
                className={`${inp} col-span-4`}
                value={line.account_code}
                onChange={e => updateLine(i, { account_code: e.target.value })}
                placeholder="ex: 601"
              />
              <select
                className={`${inp} col-span-3`}
                value={line.type}
                onChange={e => updateLine(i, { type: e.target.value as "debit" | "credit" })}
              >
                <option value="debit">Débit</option>
                <option value="credit">Crédit</option>
              </select>
              <input
                className={`${inp} col-span-4`}
                type="number"
                min={1}
                step={1}
                value={line.amount || ""}
                onChange={e => updateLine(i, { amount: parseInt(e.target.value) || 0 })}
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
                className="col-span-1 p-1 text-gray-300 hover:text-rose-400 disabled:opacity-20 flex justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Annuler</button>
          <button type="submit" disabled={loading || !balanced} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {loading ? "Création…" : "Créer (brouillon)"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Ligne d'écriture ─────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: JournalEntry }) {
  return (
    <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{entry.entry_number}</td>
      <td className="px-4 py-3 text-sm text-gray-700">{entry.entry_date}</td>
      <td className="px-4 py-3 text-sm">{entry.description}</td>
      <td className="px-4 py-3 text-xs text-gray-400">{entry.source_type ?? "—"}</td>
      <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
        {fmt(entry.total_xaf)} XAF
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[entry.status] ?? ""}`}>
          {entry.status === "draft" ? "Brouillon" : entry.status === "posted" ? "Posté" : "Annulé"}
        </span>
      </td>
    </motion.tr>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function FinanceJournal() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: period } = useQuery({
    queryKey: ["finance", "period", "current"],
    queryFn: () => periodService.getCurrent(),
    staleTime: 60_000,
  });

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ["finance", "journal", period?.id],
    queryFn: () => journalService.list(period?.id),
    enabled: !!period,
    staleTime: 60_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["finance", "journal"] });
    setShowCreate(false);
  };

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {showCreate && period && (
        <CreateEntryModal periodId={period.id} onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Journal comptable</h1>
            <p className="text-sm text-gray-500">
              {period ? `Période : ${period.label}` : "Aucune période ouverte"} · {entries.length} écriture(s)
            </p>
          </div>
        </div>
        {period && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle écriture
          </button>
        )}
      </div>

      {entries.length === 0
        ? <p className="text-sm text-gray-400">Aucune écriture pour cette période.</p>
        : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">N°</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">Source</th>
                  <th className="px-4 py-2 text-right">Montant</th>
                  <th className="px-4 py-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(e => <EntryRow key={e.id} entry={e} />)}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}
