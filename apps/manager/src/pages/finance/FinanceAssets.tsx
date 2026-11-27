import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, AlertCircle, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { assetService } from "../../services/finance";
import type { Asset } from "../../services/finance";

const ease = [0.22, 1, 0.36, 1] as const;
const fmt = (n: number) => new Intl.NumberFormat("fr-CM").format(n);
const today = () => new Date().toISOString().slice(0, 10);

const CAT_LABELS: Record<string, string> = {
  it_equipment: "Matériel IT", office_equipment: "Matériel bureau",
  furniture: "Mobilier", vehicle: "Véhicule", other: "Autre",
};
const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  disposed: "bg-gray-100 text-gray-500",
  fully_depreciated: "bg-orange-100 text-orange-700",
};

// ─── Modal : Nouvelle immobilisation ─────────────────────────────────────────

function CreateAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", asset_category: "it_equipment" as const,
    acquisition_cost_xaf: 0, acquisition_date: today(),
    useful_life_months: 36, residual_value_xaf: 0, notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.acquisition_cost_xaf <= 0) { setErr("Nom et coût requis."); return; }
    if (form.acquisition_cost_xaf <= form.residual_value_xaf) { setErr("Le coût doit dépasser la valeur résiduelle."); return; }
    setLoading(true); setErr("");
    try {
      await assetService.create({
        name:                 form.name,
        asset_category:       form.asset_category,
        acquisition_cost_xaf: form.acquisition_cost_xaf,
        acquisition_date:     form.acquisition_date,
        useful_life_months:   form.useful_life_months,
        residual_value_xaf:   form.residual_value_xaf,
        notes:                form.notes || undefined,
      });
      onCreated();
    } catch (e) { setErr((e as Error).message); setLoading(false); }
  };

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-200 outline-none";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="font-bold text-lg text-gray-900">Nouvelle immobilisation</h2>
        {err && <p className="text-rose-600 text-sm">{err}</p>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Désignation *</label>
            <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Ordinateur portable Dell" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Catégorie</label>
            <select className={inp} value={form.asset_category} onChange={e => setForm(f => ({ ...f, asset_category: e.target.value as typeof form.asset_category }))}>
              <option value="it_equipment">Matériel IT</option>
              <option value="office_equipment">Matériel bureau</option>
              <option value="furniture">Mobilier</option>
              <option value="vehicle">Véhicule</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Durée (mois)</label>
            <input className={inp} type="number" min={1} max={240} value={form.useful_life_months} onChange={e => setForm(f => ({ ...f, useful_life_months: parseInt(e.target.value) || 36 }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Coût d'acquisition (XAF) *</label>
            <input className={inp} type="number" min={1} step={1} value={form.acquisition_cost_xaf || ""} onChange={e => setForm(f => ({ ...f, acquisition_cost_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Valeur résiduelle (XAF)</label>
            <input className={inp} type="number" min={0} step={1} value={form.residual_value_xaf || ""} onChange={e => setForm(f => ({ ...f, residual_value_xaf: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Date d'acquisition</label>
            <input className={inp} type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <textarea className={inp} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">Annuler</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
            {loading ? "Création…" : "Créer l'actif"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Carte actif ──────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: Asset }) {
  const depPct = asset.acquisition_cost_xaf > 0
    ? Math.min(100, (asset.accumulated_depreciation_xaf / asset.acquisition_cost_xaf) * 100)
    : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease }}
      className="bg-white border border-gray-200 rounded-xl p-5 space-y-3"
    >
      <div className="flex justify-between items-start">
        <div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[asset.status] ?? "bg-gray-100"}`}>
            {asset.status === "active" ? "Actif" : asset.status === "disposed" ? "Cédé" : "Amorti"}
          </span>
          <p className="mt-1 font-semibold text-gray-900">{asset.name}</p>
          <p className="text-xs text-gray-400">{CAT_LABELS[asset.asset_category]} · {asset.asset_number}</p>
        </div>
        <Building2 className="w-5 h-5 text-blue-400" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-gray-400">Coût acquisition</p>
          <p className="font-mono">{fmt(asset.acquisition_cost_xaf)} XAF</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Valeur nette</p>
          <p className="font-mono font-medium">{fmt(asset.book_value_xaf)} XAF</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Amortissement cumulé</span><span>{depPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-orange-400 rounded-full" style={{ width: `${depPct}%` }} />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Durée : {asset.useful_life_months} mois · Acquis : {asset.acquisition_date}
      </p>
    </motion.div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function FinanceAssets() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ["finance", "assets"],
    queryFn: () => assetService.list(),
    staleTime: 120_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["finance", "assets"] });
    void qc.invalidateQueries({ queryKey: ["finance", "dashboard-kpi"] });
    setShowCreate(false);
  };

  const totalBV   = assets.filter(a => a.status === "active").reduce((s, a) => s + a.book_value_xaf, 0);
  const totalCost = assets.reduce((s, a) => s + a.acquisition_cost_xaf, 0);

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Chargement…</div>;
  if (error) return (
    <div className="p-6 flex gap-2 text-rose-600 text-sm">
      <AlertCircle className="w-4 h-4 mt-0.5" />
      {(error as Error).message}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {showCreate && <CreateAssetModal onClose={() => setShowCreate(false)} onCreated={refresh} />}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Immobilisations</h1>
          <p className="text-sm text-gray-500">
            Coût total : <strong>{fmt(totalCost)} XAF</strong> ·
            Valeur nette : <strong>{fmt(totalBV)} XAF</strong>
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouvelle immobilisation
        </button>
      </div>

      {assets.length === 0
        ? <p className="text-sm text-gray-400">Aucun actif enregistré.</p>
        : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map(a => <AssetCard key={a.id} asset={a} />)}
          </div>
        )
      }
    </div>
  );
}
