import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Plus, Smartphone, ArrowUpRight, ArrowDownLeft, RefreshCw,
  AlertTriangle, TrendingUp, Banknote, Zap, ShieldCheck, Users,
  Clock, Package, BarChart3, CheckSquare, ChevronDown, X, Printer, RotateCcw, Eye, EyeOff
} from "lucide-react";
import { supabase } from "../../lib/supabase";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-CM").format(n);
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CM", { day: "2-digit", month: "short" });
}

type Provider = "orange_money" | "mtn_mobile_money";
type Account = {
  id: string; provider: Provider; account_name: string; account_number: string;
  cash_balance: number; efloat_balance: number; bs4u_capital_xaf: number;
  cash_min_threshold: number; efloat_min_threshold: number;
  cash_alert_threshold: number; efloat_alert_threshold: number;
};
type DashboardData = {
  account: Account;
  today: { deposits_count: number; deposits_volume: number; withdrawals_count: number; withdrawals_volume: number; commission_xaf: number };
  debts: { total_xaf: number; open_count: number };
  alerts: { cash_low: boolean; cash_critical: boolean; efloat_low: boolean; efloat_critical: boolean };
};
type Tx = { id: string; transaction_type: string; amount: number; fee: number; commission_xaf: number; phone_number: string | null; recipient_name: string | null; sender_name: string | null; reference: string; status: string; created_at: string };
type Debt = { id: string; received_xaf: number; repaid_xaf: number; remaining_xaf: number; received_at: string; deadline_at: string; is_overdue: boolean; supply_type: string; supplier_name: string };

const PROVIDER_LABEL: Record<string, string> = {
  orange_money: "Orange Money",
  mtn_mobile_money: "MTN MoMo",
};
const TX_LABEL: Record<string, string> = {
  deposit: "Dépôt", withdrawal: "Retrait", send: "Transfert envoyé",
  receive: "Transfert reçu", payment: "Paiement",
};
const TX_COLOR: Record<string, string> = {
  deposit: "bg-blue-50 text-blue-700",
  withdrawal: "bg-orange-50 text-orange-700",
  send: "bg-purple-50 text-purple-700",
  receive: "bg-[#E8F3EC] text-[#067647]",
  payment: "bg-red-50 text-red-700",
};

// ===== Modal Fleet Receival =====
function FleetReceivalModal({ accountId, onClose, onDone }: { accountId: string; onClose: () => void; onDone: () => void }) {
  const [supplyType, setSupplyType] = useState<"cash" | "electronic">("cash");
  const [amount, setAmount] = useState("");
  const [supplier, setSupplier] = useState("");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    const { error } = await supabase.rpc("record_fleet_receival", {
      p_account_id: accountId,
      p_amount_xaf: amt,
      p_supply_type: supplyType,
      p_supplier_name: supplier || null,
      p_receipt_ref: ref || null,
    });
    setSaving(false);
    if (error) { alert("Erreur: " + error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#17231C]">Réception de flotte</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Type d'approvisionnement</label>
            <div className="flex gap-2">
              {(["cash", "electronic"] as const).map(t => (
                <button key={t} type="button" onClick={() => setSupplyType(t)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${supplyType === t ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32] font-medium" : "border-[#E2E8E3] text-[#17231C]"}`}>
                  {t === "cash" ? "💵 Cash" : "📱 Électronique"}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#66736A] mt-1">
              {supplyType === "cash" ? "Le fournisseur remet des espèces → réserve cash +" : "Le fournisseur crédite le compte → solde électronique +"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Montant (FCFA)</label>
            <input type="number" required min={1} value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Fournisseur</label>
            <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Nom du fournisseur"
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Référence</label>
            <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="Réf. reçu"
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            Une dette fournisseur sera automatiquement créée. Échéance : 17h00 aujourd'hui.
          </div>
          <button type="submit" disabled={saving || !amount}
            className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#063A22] transition-colors">
            {saving ? "Enregistrement…" : "Enregistrer la réception"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===== Modal Fleet Repayment =====
function FleetRepaymentModal({ debt, onClose, onDone }: { debt: Debt; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(debt.remaining_xaf));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseInt(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    const { error } = await supabase.rpc("record_fleet_repayment", {
      p_receival_id: debt.id,
      p_amount_xaf: amt,
    });
    setSaving(false);
    if (error) { alert("Erreur: " + error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#17231C]">Remboursement fournisseur</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>
        <div className={`rounded-lg p-3 mb-4 text-xs font-medium ${debt.is_overdue ? "bg-red-50 text-red-700 border border-red-200" : "bg-[#E8F3EC] text-[#067647] border border-[#B7D9C4]"}`}>
          {debt.is_overdue ? "⚠ Remboursement en retard" : "Dans les délais"}
          {" · "}{debt.supply_type === "cash" ? "Remboursement en CASH" : "Remboursement ÉLECTRONIQUE"}
        </div>
        <div className="bg-[#F5F7F5] rounded-lg p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-[#66736A]">Reçu le</span><span>{fmtDate(debt.received_at)}</span></div>
          <div className="flex justify-between"><span className="text-[#66736A]">Total reçu</span><span className="tabular-nums">{fmt(debt.received_xaf)} FCFA</span></div>
          <div className="flex justify-between"><span className="text-[#66736A]">Déjà remboursé</span><span className="tabular-nums">{fmt(debt.repaid_xaf)} FCFA</span></div>
          <div className="flex justify-between font-semibold border-t border-[#E2E8E3] pt-1 mt-1"><span>Reste dû</span><span className="tabular-nums text-[#B42318]">{fmt(debt.remaining_xaf)} FCFA</span></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Montant à rembourser (FCFA)</label>
            <input type="number" required min={1} max={debt.remaining_xaf} value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-[#B42318] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-red-800 transition-colors">
            {saving ? "Remboursement…" : "Rembourser"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===== Reconciliation Modal =====
function ReconciliationModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const [actualCash, setActualCash] = useState(String(account.cash_balance));
  const [actualEfloat, setActualEfloat] = useState(String(account.efloat_balance));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const cashVariance = (parseInt(actualCash) || 0) - account.cash_balance;
  const efloatVariance = (parseInt(actualEfloat) || 0) - account.efloat_balance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = (user as any)?.app_metadata?.organization_id;
    const { error } = await supabase.from("momo_reconciliations").insert({
      organization_id: orgId,
      account_id: account.id,
      theoretical_cash_xaf: account.cash_balance,
      actual_cash_xaf: parseInt(actualCash) || 0,
      theoretical_efloat_xaf: account.efloat_balance,
      actual_efloat_xaf: parseInt(actualEfloat) || 0,
      variance_reason: reason || null,
      reconciled_by: user?.id,
    });
    setSaving(false);
    if (error) { alert("Erreur: " + error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#17231C]">Rapprochement</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Cash réellement compté (FCFA)</label>
            <input type="number" required value={actualCash} onChange={e => setActualCash(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none" />
            {cashVariance !== 0 && (
              <p className={`text-xs mt-1 font-medium ${cashVariance > 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                Écart cash : {cashVariance > 0 ? "+" : ""}{fmt(cashVariance)} FCFA
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Solde électronique réel (FCFA)</label>
            <input type="number" required value={actualEfloat} onChange={e => setActualEfloat(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none" />
            {efloatVariance !== 0 && (
              <p className={`text-xs mt-1 font-medium ${efloatVariance > 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                Écart efloat : {efloatVariance > 0 ? "+" : ""}{fmt(efloatVariance)} FCFA
              </p>
            )}
          </div>
          {(cashVariance !== 0 || efloatVariance !== 0) && (
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Motif de l'écart</label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} required placeholder="Expliquer l'écart…"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none" />
            </div>
          )}
          <button type="submit" disabled={saving}
            className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#063A22] transition-colors">
            {saving ? "Enregistrement…" : "Valider le rapprochement"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===== Modal Capital Initial =====
function CapitalInitModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const [cash, setCash] = useState(String(account.cash_balance || ""));
  const [efloat, setEfloat] = useState(String(account.efloat_balance || ""));
  const [saving, setSaving] = useState(false);

  const total = (parseInt(cash) || 0) + (parseInt(efloat) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("mobile_money_accounts")
      .update({
        cash_balance: parseInt(cash) || 0,
        efloat_balance: parseInt(efloat) || 0,
        bs4u_capital_xaf: total,
      })
      .eq("id", account.id);
    setSaving(false);
    if (error) { alert("Erreur: " + error.message); return; }
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-[#17231C]">Capital initial du compte</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>
        <p className="text-xs text-[#66736A] mb-4">Renseigne les fonds réellement disponibles au démarrage. Le Capital BS4U sera la somme des deux.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Cash en caisse (FCFA)</label>
            <input type="number" required min={0} value={cash} onChange={e => setCash(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Solde électronique (FCFA)</label>
            <input type="number" required min={0} value={efloat} onChange={e => setEfloat(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none" />
          </div>
          <div className="bg-[#F5F7F5] rounded-lg p-3 flex justify-between items-center text-sm">
            <span className="text-[#66736A]">Capital BS4U (total)</span>
            <span className="font-bold tabular-nums text-[#17231C]">{fmt(total)} FCFA</span>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#063A22] transition-colors">
            {saving ? "Enregistrement…" : "Valider le capital initial"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ===== Transaction detail + print =====
function printReceipt(tx: Tx, account: Account, format: "thermal" | "a4") {
  const w = window.open("", "_blank", format === "thermal" ? "width=320,height=600" : "width=794,height=1000");
  if (!w) return;
  const name = tx.transaction_type === "withdrawal" ? tx.sender_name : tx.recipient_name;
  w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>Reçu</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:monospace;padding:12px;width:${format === "thermal" ? "72mm" : "180mm"};font-size:${format === "thermal" ? "11px" : "13px"};color:#000}
  .c{text-align:center}.b{font-weight:bold}
  .sep{border-top:1px dashed #000;margin:6px 0}
  .row{display:flex;justify-content:space-between;margin:3px 0}
  @media print{@page{size:${format === "thermal" ? "80mm auto" : "A4"};margin:${format === "thermal" ? "4mm" : "15mm"}}}
</style></head><body>
<div class="c b" style="font-size:1.3em;margin-bottom:4px">BS4U MANAGER</div>
<div class="c">${account.account_name}</div>
<div class="c" style="font-size:.9em">${PROVIDER_LABEL[account.provider] ?? account.provider}</div>
<div class="sep"></div>
<div class="c b" style="font-size:1.1em">${TX_LABEL[tx.transaction_type] ?? tx.transaction_type}</div>
<div class="sep"></div>
<div class="row"><span>Référence</span><span>${tx.reference}</span></div>
<div class="row"><span>Date</span><span>${new Date(tx.created_at).toLocaleString("fr-CM")}</span></div>
<div class="row"><span>Téléphone</span><span>${tx.phone_number || "—"}</span></div>
${name ? `<div class="row"><span>Nom</span><span>${name}</span></div>` : ""}
<div class="sep"></div>
<div class="row b"><span>Montant</span><span>${new Intl.NumberFormat("fr-CM").format(Number(tx.amount))} FCFA</span></div>
${Number(tx.commission_xaf) > 0 ? `<div class="row"><span>Commission</span><span>+${new Intl.NumberFormat("fr-CM").format(Number(tx.commission_xaf))} FCFA</span></div>` : ""}
<div class="sep"></div>
<div class="row"><span>Statut</span><span>${tx.status === "completed" ? "✓ Validée" : tx.status}</span></div>
<div class="sep"></div>
<div class="c" style="margin-top:8px;font-size:.9em">Merci pour votre confiance</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
</body></html>`);
  w.document.close();
}

function TxDetailModal({ tx, account, onClose }: { tx: Tx; account: Account; onClose: () => void }) {
  const name = tx.transaction_type === "withdrawal" ? tx.sender_name : tx.recipient_name;
  const nameLabel = tx.transaction_type === "withdrawal" ? "Expéditeur" : "Destinataire";
  const badge = tx.status === "completed" ? "bg-[#E8F3EC] text-[#067647]"
    : tx.status === "pending" ? "bg-orange-50 text-[#B54708]" : "bg-red-50 text-[#B42318]";
  const statusLabel = tx.status === "completed" ? "Validée" : tx.status === "pending" ? "En attente" : "Échouée";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8E3]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TX_COLOR[tx.transaction_type] ?? "bg-gray-50 text-gray-600"}`}>
              {tx.transaction_type === "deposit" ? <ArrowUpRight className="w-4 h-4" /> :
               tx.transaction_type === "withdrawal" ? <ArrowDownLeft className="w-4 h-4" /> :
               <RefreshCw className="w-4 h-4" />}
            </div>
            <div>
              <p className="font-semibold text-[#17231C]">{TX_LABEL[tx.transaction_type] ?? tx.transaction_type}</p>
              <p className="text-xs text-[#66736A] font-mono">{new Date(tx.created_at).toLocaleString("fr-CM")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F5F7F5]"><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="bg-[#F5F7F5] rounded-xl p-4 text-center">
            <p className="text-2xl font-bold tabular-nums text-[#17231C]">{fmt(Number(tx.amount))} FCFA</p>
            {Number(tx.commission_xaf) > 0 && (
              <p className="text-xs text-[#067647] mt-0.5">+{fmt(Number(tx.commission_xaf))} FCFA commission</p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            {([
              { label: "Référence", value: tx.reference },
              { label: "Téléphone", value: tx.phone_number || "—" },
              ...(name ? [{ label: nameLabel, value: name }] : []),
              { label: "Statut", value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{statusLabel}</span> },
            ] as { label: string; value: ReactNode }[]).map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2">
                <span className="text-[#66736A]">{label}</span>
                <span className="text-[#17231C] font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => printReceipt(tx, account, "thermal")}
            className="flex-1 flex items-center justify-center gap-1.5 border border-[#E2E8E3] text-sm text-[#17231C] py-2.5 rounded-lg hover:bg-[#F5F7F5] transition-colors">
            <Printer className="w-4 h-4" /> Thermique
          </button>
          <button onClick={() => printReceipt(tx, account, "a4")}
            className="flex-1 flex items-center justify-center gap-1.5 border border-[#075B32] text-sm text-[#075B32] py-2.5 rounded-lg hover:bg-[#E8F3EC] transition-colors">
            <Printer className="w-4 h-4" /> Reçu A4
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Reset Capital (admin-gated) =====
// Requires VITE_ADMIN_PASSWORD env variable to be set in .env.local
function ResetCapitalModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const [step, setStep]         = useState<"password" | "confirm">("password");
  const [pwd, setPwd]           = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [pwdError, setPwdError] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cash, setCash]         = useState("0");
  const [efloat, setEfloat]     = useState("0");
  const [saving, setSaving]     = useState(false);

  // shortcut: password stored in env — not suitable for high-security contexts, upgrade to server-side check if needed
  const ADMIN_PWD = import.meta.env.VITE_ADMIN_PASSWORD ?? "";

  function checkPwd() {
    if (verifying) return;
    if (!ADMIN_PWD) { alert("VITE_ADMIN_PASSWORD non configuré dans .env.local"); return; }
    setVerifying(true);
    setTimeout(() => {
      if (pwd === ADMIN_PWD) { setPwdError(false); setStep("confirm"); }
      else setPwdError(true);
      setVerifying(false);
    }, 400);
  }

  async function doReset() {
    setSaving(true);
    const cashVal   = parseInt(cash)   || 0;
    const efloatVal = parseInt(efloat) || 0;
    const { error } = await supabase.from("mobile_money_accounts").update({
      cash_balance:     cashVal,
      efloat_balance:   efloatVal,
      bs4u_capital_xaf: cashVal + efloatVal,
    }).eq("id", account.id);
    setSaving(false);
    if (error) { alert("Erreur: " + error.message); return; }
    onDone();
  }

  const total = (parseInt(cash) || 0) + (parseInt(efloat) || 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#17231C] flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-red-600" /> Réinitialiser le capital
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#F5F7F5]"><X className="w-4 h-4 text-[#66736A]" /></button>
        </div>

        {step === "password" ? (
          <div className="space-y-4">
            <p className="text-sm text-[#66736A]">Entrez le mot de passe administrateur pour accéder à cette action.</p>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Mot de passe admin</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"} value={pwd} autoFocus
                  onChange={e => { setPwd(e.target.value); setPwdError(false); }}
                  onKeyDown={e => e.key === "Enter" && checkPwd()}
                  placeholder="••••••••"
                  className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none ${pwdError ? "border-red-400 bg-red-50" : "border-[#E2E8E3]"}`}
                />
                <button
                  type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A0ADA5] hover:text-[#17231C]"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwdError && <p className="text-xs text-red-600 mt-1">Mot de passe incorrect</p>}
            </div>
            <button onClick={checkPwd} disabled={verifying || !pwd}
              className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#063A22] disabled:opacity-50 transition-colors">
              {verifying ? "Vérification…" : "Vérifier"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠ Les soldes actuels seront remplacés. Cette action est irréversible.
            </div>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Nouveau solde cash (FCFA)</label>
              <input type="number" min={0} value={cash} onChange={e => setCash(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Nouveau solde électronique (FCFA)</label>
              <input type="number" min={0} value={efloat} onChange={e => setEfloat(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none" />
            </div>
            <div className="bg-[#F5F7F5] rounded-lg p-3 flex justify-between text-sm">
              <span className="text-[#66736A]">Capital total</span>
              <span className="font-bold tabular-nums text-[#17231C]">{total.toLocaleString("fr-CM")} FCFA</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep("password")}
                className="flex-1 py-2.5 text-sm text-[#66736A] border border-[#E2E8E3] rounded-lg hover:bg-[#F5F7F5] transition-colors">
                Retour
              </button>
              <button onClick={doReset} disabled={saving}
                className="flex-1 py-2.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-semibold disabled:opacity-40 transition-colors">
                {saving ? "…" : "Réinitialiser"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== MAIN BOARD =====
type Tab = "overview" | "transactions" | "debts" | "reconciliations";
type Modal = "fleet_in" | "fleet_repay" | "reconcile" | "capital_init" | "reset_capital" | null;

export function MomoBoard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const load = useCallback(async (accId?: string) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const oid = (user as any)?.app_metadata?.organization_id as string | null;
    setOrgId(oid);
    if (!oid) { setLoading(false); return; }

    const { data: accs } = await supabase
      .from("mobile_money_accounts")
      .select("id, provider, account_name, account_number, cash_balance, efloat_balance, bs4u_capital_xaf, cash_min_threshold, efloat_min_threshold, cash_alert_threshold, efloat_alert_threshold")
      .eq("organization_id", oid).eq("is_active", true);

    if (!accs?.length) { setLoading(false); return; }
    setAccounts(accs as Account[]);

    const targetId = accId ?? accs[0].id;
    setSelectedAccountId(targetId);

    // Dashboard RPC
    const { data: dash } = await supabase.rpc("get_momo_dashboard", { p_account_id: targetId });
    if (dash) setDashboard(dash as DashboardData);

    // Today's transactions
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: txs } = await supabase
      .from("mobile_money_transactions")
      .select("id, transaction_type, amount, fee, commission_xaf, phone_number, recipient_name, sender_name, reference, status, created_at")
      .eq("account_id", targetId)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions(txs ?? []);

    // Active debts
    const { data: dts } = await supabase
      .from("momo_fleet_active_debts")
      .select("id, received_xaf, repaid_xaf, remaining_xaf, received_at, deadline_at, is_overdue, supply_type, supplier_name")
      .eq("organization_id", oid)
      .eq("account_id", targetId)
      .order("received_at", { ascending: false });
    setDebts(dts ?? []);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  function alertBanner() {
    if (!dashboard?.alerts) return null;
    const { cash_critical, efloat_critical, cash_low, efloat_low } = dashboard.alerts;
    const msgs: string[] = [];
    if (cash_critical) msgs.push("Réserve cash CRITIQUE");
    else if (cash_low) msgs.push("Réserve cash faible");
    if (efloat_critical) msgs.push("Solde électronique CRITIQUE");
    else if (efloat_low) msgs.push("Solde électronique faible");
    if (debts.some(d => d.is_overdue)) msgs.push("Remboursement fournisseur en RETARD");
    if (!msgs.length) return null;
    const isCritical = cash_critical || efloat_critical || debts.some(d => d.is_overdue);
    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border mb-4 text-sm ${isCritical ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{msgs.join(" · ")}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center py-20">
        <span className="text-sm text-[#66736A]">Chargement…</span>
      </div>
    );
  }

  if (!accounts.length) {
    return (
      <div className="p-6 max-w-2xl mx-auto py-20 text-center">
        <Smartphone className="w-12 h-12 mx-auto mb-3 text-[#E2E8E3]" />
        <p className="text-sm font-medium text-[#17231C] mb-1">Aucun compte Mobile Money configuré</p>
        <p className="text-sm text-[#66736A]">Créez un compte dans Préférences → Mobile Money.</p>
      </div>
    );
  }

  const d = dashboard;
  const acc = selectedAccount;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Mobile Money</h1>
          <p className="text-sm text-[#66736A] mt-0.5">Gestion financière professionnelle</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Operator selector */}
          {accounts.length > 1 && (
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={e => { setSelectedAccountId(e.target.value); load(e.target.value); }}
                className="appearance-none pl-3 pr-8 py-1.5 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{PROVIDER_LABEL[a.provider] ?? a.provider}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#66736A] pointer-events-none" />
            </div>
          )}
          {accounts.length === 1 && (
            <span className="text-sm font-medium text-[#17231C] bg-[#F5F7F5] border border-[#E2E8E3] px-3 py-1.5 rounded-lg">
              {PROVIDER_LABEL[accounts[0].provider] ?? accounts[0].provider}
            </span>
          )}
          <button
            onClick={() => setModal("reset_capital")}
            title="Réinitialiser le capital"
            className="p-1.5 rounded-lg border border-[#E2E8E3] text-[#66736A] hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Link to="/mobile-money/nouvelle"
            className="flex items-center gap-2 bg-[#075B32] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#063A22] transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle opération
          </Link>
        </div>
      </div>

      {/* Alert banner */}
      {alertBanner()}

      {/* Per-account balance cards */}
      <div className={`grid gap-3 mb-3 ${accounts.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {accounts.map(a => {
          const cashCritical = a.cash_balance < a.cash_min_threshold;
          const cashLow = a.cash_balance < a.cash_alert_threshold;
          const efloatCritical = a.efloat_balance < a.efloat_min_threshold;
          const efloatLow = a.efloat_balance < a.efloat_alert_threshold;
          const isSelected = a.id === selectedAccountId;
          return (
            <button key={a.id} onClick={() => { setSelectedAccountId(a.id); load(a.id); }}
              className={`bg-white rounded-xl border p-4 text-left transition-all ${isSelected ? "border-[#075B32] ring-1 ring-[#075B32]" : "border-[#E2E8E3] hover:border-[#075B32]/40"}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.provider === "orange_money" ? "bg-orange-500" : "bg-yellow-400"}`} />
                <span className="text-sm font-semibold text-[#17231C] truncate">{a.account_name}</span>
                <span className="ml-auto text-xs text-[#66736A] shrink-0">{PROVIDER_LABEL[a.provider]}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-[#66736A] mb-1 flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> Cash
                  </p>
                  <p className={`text-base font-bold tabular-nums ${cashCritical ? "text-red-600" : cashLow ? "text-amber-600" : "text-[#17231C]"}`}>
                    {fmt(a.cash_balance)} F
                  </p>
                  {cashLow && (
                    <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${cashCritical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {cashCritical ? "CRITIQUE" : "Faible"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-[#66736A] mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Électronique
                  </p>
                  <p className={`text-base font-bold tabular-nums ${efloatCritical ? "text-red-600" : efloatLow ? "text-amber-600" : "text-[#17231C]"}`}>
                    {fmt(a.efloat_balance)} F
                  </p>
                  {efloatLow && (
                    <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${efloatCritical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {efloatCritical ? "CRITIQUE" : "Faible"}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* KPI Cards — selected account */}
      {acc && d && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">

            {/* Capital BS4U */}
            <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-[#66736A]" />
                <p className="text-xs text-[#66736A] font-medium uppercase tracking-wide">Capital BS4U</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-[#17231C]">{fmt(acc.bs4u_capital_xaf)} F</p>
              {acc.bs4u_capital_xaf === 0
                ? <button onClick={() => setModal("capital_init")} className="text-xs text-[#075B32] underline mt-1">Initialiser le capital</button>
                : <p className="text-xs text-[#66736A] mt-1">Fonds propres investis</p>
              }
            </div>

            {/* Dettes fournisseurs */}
            <div className={`bg-white rounded-xl border p-4 ${d.debts.open_count > 0 && debts.some(x => x.is_overdue) ? "border-red-300" : d.debts.open_count > 0 ? "border-amber-200" : "border-[#E2E8E3]"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-[#66736A]" />
                <p className="text-xs text-[#66736A] font-medium uppercase tracking-wide">Dettes fournisseurs</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${d.debts.total_xaf > 0 ? "text-[#B42318]" : "text-[#17231C]"}`}>
                {fmt(d.debts.total_xaf)} F
              </p>
              <p className="text-xs text-[#66736A] mt-1">{d.debts.open_count} dette(s) ouverte(s)</p>
              {debts.some(x => x.is_overdue) && (
                <span className="inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">En retard</span>
              )}
            </div>

            {/* Commissions du jour */}
            <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[#66736A]" />
                <p className="text-xs text-[#66736A] font-medium uppercase tracking-wide">Commissions (jour)</p>
              </div>
              <p className="text-xl font-bold tabular-nums text-[#067647]">{fmt(d.today.commission_xaf)} F</p>
              <p className="text-xs text-[#66736A] mt-1">Revenus de l'activité</p>
            </div>

            {/* Activité du jour */}
            <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-[#66736A]" />
                <p className="text-xs text-[#66736A] font-medium uppercase tracking-wide">Activité (jour)</p>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-[#17231C]">{d.today.deposits_count} dépôts</span>
                <span className="text-[#17231C]">{d.today.withdrawals_count} retraits</span>
              </div>
              <p className="text-xs text-[#66736A] mt-1">Volume : {fmt(d.today.deposits_volume + d.today.withdrawals_volume)} F</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-5">
            <Link to="/mobile-money/nouvelle?type=deposit"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
              <ArrowUpRight className="w-4 h-4" /> Dépôt
            </Link>
            <Link to="/mobile-money/nouvelle?type=withdrawal"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors">
              <ArrowDownLeft className="w-4 h-4" /> Retrait
            </Link>
            <Link to="/mobile-money/nouvelle?type=send"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors">
              <RefreshCw className="w-4 h-4" /> Transfert
            </Link>
            <button onClick={() => setModal("fleet_in")}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#F5F7F5] border border-[#E2E8E3] text-[#17231C] hover:bg-[#E8F3EC] transition-colors">
              <Package className="w-4 h-4 text-[#075B32]" /> Réception flotte
            </button>
            {debts.length > 0 && (
              <button onClick={() => { setSelectedDebt(debts[0]); setModal("fleet_repay"); }}
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${debts.some(d => d.is_overdue) ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" : "bg-[#F5F7F5] border-[#E2E8E3] text-[#17231C] hover:bg-amber-50"}`}>
                <Clock className="w-4 h-4" /> Rembourser fournisseur
              </button>
            )}
            <button onClick={() => setModal("reconcile")}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[#F5F7F5] border border-[#E2E8E3] text-[#17231C] hover:bg-[#E8F3EC] transition-colors">
              <CheckSquare className="w-4 h-4 text-[#075B32]" /> Rapprochement
            </button>
          </div>
        </>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-[#E2E8E3] mb-4 overflow-x-auto">
        {([
          ["overview", "Vue d'ensemble"],
          ["transactions", "Transactions"],
          ["debts", "Dettes fournisseurs"],
          ["reconciliations", "Rapprochements"],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-[#075B32] text-[#075B32]" : "border-transparent text-[#66736A] hover:text-[#17231C]"}`}>
            {label}
            {t === "debts" && debts.length > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${debts.some(d => d.is_overdue) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {debts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
          <div className="bg-[#F5F7F5] px-4 py-3 border-b border-[#E2E8E3]">
            <p className="text-sm font-medium text-[#17231C]">Journal du jour</p>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <Smartphone className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
              <p className="text-sm text-[#A0ADA5]">Aucune opération aujourd'hui</p>
              <Link to="/mobile-money/nouvelle" className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#075B32] hover:underline">
                <Plus className="w-4 h-4" /> Enregistrer une opération
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8E3]">
              {transactions.map(tx => (
                <div key={tx.id} onClick={() => setSelectedTx(tx)} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F5F7F5] transition-colors cursor-pointer">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TX_COLOR[tx.transaction_type] ?? "bg-gray-50 text-gray-600"}`}>
                    {tx.transaction_type === "deposit" ? <ArrowUpRight className="w-3.5 h-3.5" /> :
                     tx.transaction_type === "withdrawal" ? <ArrowDownLeft className="w-3.5 h-3.5" /> :
                     <RefreshCw className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#17231C] truncate">{TX_LABEL[tx.transaction_type] ?? tx.transaction_type}</p>
                    <p className="text-xs text-[#66736A] font-mono">{tx.phone_number || "—"} · {fmtTime(tx.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-[#17231C]">{fmt(Number(tx.amount))} F</p>
                    <p className="text-xs tabular-nums text-[#067647]">+{fmt(Number(tx.commission_xaf))} F</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "transactions" && (
        <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase">Opération</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase hidden sm:table-cell">Téléphone</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase">Montant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase hidden md:table-cell">Commission</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E3]">
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-sm text-[#A0ADA5]">Aucune transaction aujourd'hui</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} onClick={() => setSelectedTx(tx)} className="hover:bg-[#F5F7F5] transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${TX_COLOR[tx.transaction_type] ?? "bg-gray-50 text-gray-600"}`}>
                          {tx.transaction_type === "deposit" ? <ArrowUpRight className="w-3 h-3" /> :
                           tx.transaction_type === "withdrawal" ? <ArrowDownLeft className="w-3 h-3" /> :
                           <RefreshCw className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="font-medium text-xs text-[#17231C]">{TX_LABEL[tx.transaction_type] ?? tx.transaction_type}</p>
                          <p className="text-xs text-[#66736A] font-mono">{fmtTime(tx.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#66736A] font-mono hidden sm:table-cell">{tx.phone_number || "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-[#17231C]">{fmt(Number(tx.amount))} F</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-[#067647] hidden md:table-cell">+{fmt(Number(tx.commission_xaf))} F</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        tx.status === "completed" ? "bg-[#E8F3EC] text-[#067647]" :
                        tx.status === "pending" ? "bg-orange-50 text-[#B54708]" :
                        "bg-red-50 text-[#B42318]"
                      }`}>{tx.status === "completed" ? "Validée" : tx.status === "pending" ? "En attente" : "Échouée"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "debts" && (
        <div className="space-y-3">
          {debts.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8E3] text-center py-12">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
              <p className="text-sm text-[#A0ADA5]">Aucune dette fournisseur en cours</p>
            </div>
          ) : (
            debts.map(debt => (
              <div key={debt.id} className={`bg-white rounded-xl border p-4 ${debt.is_overdue ? "border-red-300" : "border-[#E2E8E3]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${debt.supply_type === "cash" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                        {debt.supply_type === "cash" ? "Cash" : "Électronique"}
                      </span>
                      {debt.is_overdue && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">En retard</span>}
                    </div>
                    <p className="text-sm font-medium text-[#17231C]">{debt.supplier_name || "Fournisseur"}</p>
                    <p className="text-xs text-[#66736A]">Reçu le {fmtDate(debt.received_at)} · Échéance {fmtTime(debt.deadline_at)}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedDebt(debt); setModal("fleet_repay"); }}
                    className="text-sm px-3 py-1.5 rounded-lg bg-[#075B32] text-white hover:bg-[#063A22] transition-colors whitespace-nowrap">
                    Rembourser
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#F5F7F5] rounded-lg p-2">
                    <p className="text-xs text-[#66736A]">Reçu</p>
                    <p className="text-sm font-semibold tabular-nums text-[#17231C]">{fmt(debt.received_xaf)} F</p>
                  </div>
                  <div className="bg-[#E8F3EC] rounded-lg p-2">
                    <p className="text-xs text-[#66736A]">Remboursé</p>
                    <p className="text-sm font-semibold tabular-nums text-[#067647]">{fmt(debt.repaid_xaf)} F</p>
                  </div>
                  <div className={`rounded-lg p-2 ${debt.is_overdue ? "bg-red-50" : "bg-amber-50"}`}>
                    <p className="text-xs text-[#66736A]">Reste dû</p>
                    <p className={`text-sm font-semibold tabular-nums ${debt.is_overdue ? "text-red-600" : "text-amber-700"}`}>{fmt(debt.remaining_xaf)} F</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "reconciliations" && (
        <div className="space-y-4">
          {acc && (
            <div className="bg-white rounded-xl border border-[#E2E8E3] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#17231C]">Soldes théoriques actuels</h3>
                <button onClick={() => setModal("reconcile")}
                  className="text-sm px-3 py-1.5 rounded-lg bg-[#075B32] text-white hover:bg-[#063A22] transition-colors">
                  Nouveau rapprochement
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F5F7F5] rounded-lg p-3">
                  <p className="text-xs text-[#66736A] mb-1">Cash théorique</p>
                  <p className="text-lg font-bold tabular-nums text-[#17231C]">{fmt(acc.cash_balance)} FCFA</p>
                </div>
                <div className="bg-[#F5F7F5] rounded-lg p-3">
                  <p className="text-xs text-[#66736A] mb-1">E-float théorique</p>
                  <p className="text-lg font-bold tabular-nums text-[#17231C]">{fmt(acc.efloat_balance)} FCFA</p>
                </div>
              </div>
            </div>
          )}
          <ReconciliationHistory orgId={orgId} accountId={selectedAccountId} />
        </div>
      )}

      {/* Modals */}
      {selectedTx && acc && (
        <TxDetailModal tx={selectedTx} account={acc} onClose={() => setSelectedTx(null)} />
      )}
      {modal === "fleet_in" && acc && (
        <FleetReceivalModal accountId={acc.id} onClose={() => setModal(null)} onDone={() => { setModal(null); load(selectedAccountId); }} />
      )}
      {modal === "fleet_repay" && selectedDebt && (
        <FleetRepaymentModal debt={selectedDebt} onClose={() => { setModal(null); setSelectedDebt(null); }} onDone={() => { setModal(null); setSelectedDebt(null); load(selectedAccountId); }} />
      )}
      {modal === "reconcile" && acc && (
        <ReconciliationModal account={acc} onClose={() => setModal(null)} onDone={() => { setModal(null); load(selectedAccountId); setTab("reconciliations"); }} />
      )}
      {modal === "capital_init" && acc && (
        <CapitalInitModal account={acc} onClose={() => setModal(null)} onDone={() => { setModal(null); load(selectedAccountId); }} />
      )}
      {modal === "reset_capital" && acc && (
        <ResetCapitalModal account={acc} onClose={() => setModal(null)} onDone={() => { setModal(null); load(selectedAccountId); }} />
      )}
    </div>
  );
}

function ReconciliationHistory({ orgId, accountId }: { orgId: string | null; accountId: string }) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!orgId || !accountId) return;
    supabase.from("momo_reconciliations")
      .select("id, reconciled_at, theoretical_cash_xaf, actual_cash_xaf, cash_variance_xaf, theoretical_efloat_xaf, actual_efloat_xaf, efloat_variance_xaf, variance_reason, status")
      .eq("organization_id", orgId).eq("account_id", accountId)
      .order("reconciled_at", { ascending: false }).limit(20)
      .then(({ data }) => setRows(data ?? []));
  }, [orgId, accountId]);

  if (!rows.length) {
    return (
      <div className="bg-white rounded-xl border border-[#E2E8E3] text-center py-10">
        <p className="text-sm text-[#A0ADA5]">Aucun rapprochement enregistré</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
      <div className="bg-[#F5F7F5] px-4 py-3 border-b border-[#E2E8E3]">
        <p className="text-sm font-medium text-[#17231C]">Historique des rapprochements</p>
      </div>
      <div className="divide-y divide-[#E2E8E3]">
        {rows.map(r => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[#17231C]">{new Date(r.reconciled_at).toLocaleString("fr-CM")}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "validated" ? "bg-[#E8F3EC] text-[#067647]" : "bg-amber-50 text-amber-700"}`}>
                {r.status === "validated" ? "Validé" : "En attente"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#66736A]">Écart cash : </span>
                <span className={`font-semibold tabular-nums ${r.cash_variance_xaf === 0 ? "text-[#067647]" : r.cash_variance_xaf > 0 ? "text-blue-600" : "text-[#B42318]"}`}>
                  {r.cash_variance_xaf >= 0 ? "+" : ""}{fmt(r.cash_variance_xaf)} F
                </span>
              </div>
              <div>
                <span className="text-[#66736A]">Écart efloat : </span>
                <span className={`font-semibold tabular-nums ${r.efloat_variance_xaf === 0 ? "text-[#067647]" : r.efloat_variance_xaf > 0 ? "text-blue-600" : "text-[#B42318]"}`}>
                  {r.efloat_variance_xaf >= 0 ? "+" : ""}{fmt(r.efloat_variance_xaf)} F
                </span>
              </div>
            </div>
            {r.variance_reason && <p className="text-xs text-[#66736A] mt-1 italic">{r.variance_reason}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
