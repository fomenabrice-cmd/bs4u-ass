import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Banknote, TrendingUp, TrendingDown, Lock, Plus, X, History, AlertTriangle, Clock, Signal } from "lucide-react";
import { supabase } from "../../lib/supabase";

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }
function fmtDelay(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60).toString().padStart(2, "0");
  const m = (abs % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

const MVT_LABELS: Record<string, string> = {
  opening: "Ouverture", closing: "Clôture",
  sale: "Vente", payment_received: "Encaissement",
  momo_commission: "Commission MoMo", expense: "Dépense",
  fund_addition: "Entrée de fonds", fund_withdrawal: "Sortie de fonds",
  adjustment: "Ajustement", administrative: "Administratif",
  flotte_request: "Commande de flotte", flotte_repayment: "Remboursement de flotte",
};

type FlotteProvider = { enabled: boolean; request_deadline: string; repayment_deadline: string };
type FlotteSettings = { orange_money: FlotteProvider; mtn_momo: FlotteProvider };
const PROVIDER_LABELS: Record<string, string> = { orange_money: "Orange Money", mtn_momo: "MTN MoMo" };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

type Session  = {
  id: string; register_id: string; register_name: string;
  opening_amount_xaf: number; opened_at: string;
  expected_open_at: string | null; open_delay_minutes: number | null;
  expected_close_at: string | null; late_close_minutes: number | null;
};
type Movement = { id: string; movement_type: string; amount_xaf: number; description: string; reference: string | null; created_at: string };
type Register = { id: string; name: string; opening_time?: string | null; closing_time?: string | null };

function ModalOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        {children}
      </div>
    </div>
  );
}

function OpenModal({ registers, saving, onConfirm, onClose }: {
  registers: Register[]; saving: boolean;
  onConfirm: (registerId: string, amount: number) => void;
  onClose: () => void;
}) {
  const [regId, setRegId] = useState(registers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const amountNum = parseInt(amount) || 0;
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#17231C]">Ouvrir la caisse</h2>
        <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
      </div>
      <div className="space-y-4">
        {registers.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Caisse</label>
            <select value={regId} onChange={(e) => setRegId(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C]">
              {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Fond d'ouverture (FCFA)</label>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C]" />
        </div>
        <button disabled={!regId || saving}
          onClick={() => onConfirm(regId, amountNum)}
          className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#063A22] transition-colors">
          {saving ? "Ouverture…" : "Ouvrir"}
        </button>
      </div>
    </>
  );
}

function MovementModal({ title, color, saving, onConfirm, onClose }: {
  title: string; color: "green" | "red"; saving: boolean;
  onConfirm: (amount: number, description: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc]     = useState("");
  const amountNum = parseInt(amount) || 0;
  const btnClass  = color === "green" ? "bg-[#075B32] hover:bg-[#063A22]" : "bg-[#B42318] hover:bg-red-800";
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#17231C]">{title}</h2>
        <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Montant (FCFA)</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Motif</label>
          <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Description…" maxLength={200}
            className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C]" />
        </div>
        <button disabled={amountNum <= 0 || saving}
          onClick={() => onConfirm(amountNum, desc)}
          className={`w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors ${btnClass}`}>
          {saving ? "Enregistrement…" : "Confirmer"}
        </button>
      </div>
    </>
  );
}

function ClotureModal({ balance, saving, onConfirm, onClose }: {
  balance: number; saving: boolean;
  onConfirm: (counted: number, justification: string) => void;
  onClose: () => void;
}) {
  const [counted, setCounted] = useState(String(balance));
  const [justif, setJustif]   = useState("");
  const countedNum  = parseInt(counted) || 0;
  const diff        = countedNum - balance;
  const needsJustif = diff !== 0;
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#17231C]">Clôturer la caisse</h2>
        <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
      </div>
      <div className="space-y-4">
        <div className="bg-[#F5F7F5] rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-[#66736A]">Solde théorique</span>
            <span className="tabular-nums font-medium text-[#17231C]">{fmt(balance)} FCFA</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Montant compté (FCFA)</label>
          <input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)}
            className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C]" />
        </div>
        {counted !== "" && (
          <div className="text-sm flex justify-between">
            <span className="text-[#66736A]">Écart</span>
            <span className={`tabular-nums font-medium ${diff === 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
              {diff >= 0 ? "+" : ""}{fmt(diff)} FCFA
            </span>
          </div>
        )}
        {needsJustif && (
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">
              Justification de l'écart <span className="text-[#B42318]">*</span>
            </label>
            <input type="text" required value={justif} onChange={(e) => setJustif(e.target.value)}
              placeholder="Expliquez l'écart…" maxLength={300}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C]" />
          </div>
        )}
        <button disabled={saving || (needsJustif && !justif.trim())}
          onClick={() => onConfirm(countedNum, justif)}
          className="w-full bg-[#B42318] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-red-800 transition-colors">
          {saving ? "Clôture en cours…" : "Clôturer la caisse"}
        </button>
      </div>
    </>
  );
}

function FlotteModal({ type, flotte, saving, onConfirm, onClose }: {
  type: "flotte_request" | "flotte_repayment";
  flotte: FlotteSettings;
  saving: boolean;
  onConfirm: (provider: string, amount: number, description: string) => void;
  onClose: () => void;
}) {
  const isRequest = type === "flotte_request";
  const enabledProviders = (Object.entries(flotte) as [string, FlotteProvider][])
    .filter(([, p]) => p.enabled);
  const [provider, setProvider] = useState(enabledProviders[0]?.[0] ?? "orange_money");
  const [amount, setAmount]     = useState("");
  const [desc, setDesc]         = useState("");
  const amountNum = parseInt(amount) || 0;

  const deadline = isRequest
    ? flotte[provider as keyof FlotteSettings]?.request_deadline
    : flotte[provider as keyof FlotteSettings]?.repayment_deadline;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[#17231C]">
          {isRequest ? "Commande de flotte" : "Remboursement de flotte"}
        </h2>
        <button onClick={onClose}><X className="w-4 h-4 text-[#66736A]" /></button>
      </div>
      <div className="space-y-4">
        {enabledProviders.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Opérateur</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C]">
              {enabledProviders.map(([key]) => (
                <option key={key} value={key}>{PROVIDER_LABELS[key]}</option>
              ))}
            </select>
          </div>
        )}
        {deadline && (
          <p className="text-xs text-[#66736A] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isRequest ? "Heure limite de demande" : "Heure limite de remboursement"} : <strong>{deadline}</strong>
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Montant (FCFA)</label>
          <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-right tabular-nums text-[#17231C]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-1">Motif</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder={`${PROVIDER_LABELS[provider] ?? provider}…`} maxLength={200}
            className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C]" />
        </div>
        <button disabled={amountNum <= 0 || saving}
          onClick={() => onConfirm(provider, amountNum, desc || `${isRequest ? "Commande" : "Remboursement"} flotte ${PROVIDER_LABELS[provider] ?? provider}`)}
          className={`w-full text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors ${
            isRequest ? "bg-orange-600 hover:bg-orange-700" : "bg-[#075B32] hover:bg-[#063A22]"
          }`}>
          {saving ? "Enregistrement…" : isRequest ? "Enregistrer la commande" : "Enregistrer le remboursement"}
        </button>
      </div>
    </>
  );
}

export function CashSession() {
  const [registers, setRegisters]           = useState<Register[]>([]);
  const [session, setSession]               = useState<Session | null>(null);
  const [balance, setBalance]               = useState(0);
  const [movements, setMovements]           = useState<Movement[]>([]);
  const [loading, setLoading]               = useState(true);
  const [modal, setModal]                   = useState<string | null>(null);
  const [selectedMvt, setSelectedMvt]       = useState<Movement | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [alertClosingTime, setAlertClosingTime]   = useState(false);
  const [openDelayMinutes, setOpenDelayMinutes]   = useState<number | null>(null);
  const [flotte, setFlotte]                       = useState<FlotteSettings | null>(null);
  const idempKeyRef = useRef<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const oid = (user as any).app_metadata?.organization_id as string | null;
    if (!oid) { setLoading(false); return; }

    const [{ data: regs }, { data: org }] = await Promise.all([
      supabase.from("cash_registers").select("id, name, opening_time, closing_time")
        .eq("organization_id", oid).eq("is_active", true),
      supabase.from("organizations").select("settings").eq("id", oid).single(),
    ]);
    setRegisters(regs ?? []);
    if (org?.settings?.flotte) setFlotte(org.settings.flotte as FlotteSettings);

    if (!regs?.length) { setLoading(false); return; }

    const { data: sess } = await supabase
      .from("cash_sessions")
      .select("id, cash_register_id, opening_amount_xaf, opened_at, expected_open_at, open_delay_minutes, expected_close_at, late_close_minutes, cash_register:cash_register_id(name)")
      .eq("status", "open").in("cash_register_id", regs.map(r => r.id))
      .maybeSingle();

    if (sess) {
      setSession({
        id: sess.id, register_id: sess.cash_register_id,
        register_name: (sess.cash_register as any)?.name ?? "—",
        opening_amount_xaf: sess.opening_amount_xaf, opened_at: sess.opened_at,
        expected_open_at: sess.expected_open_at ?? null,
        open_delay_minutes: sess.open_delay_minutes ?? null,
        expected_close_at: sess.expected_close_at ?? null,
        late_close_minutes: sess.late_close_minutes ?? null,
      });
      const { data: bal } = await supabase.rpc("get_cash_session_balance", { p_session_id: sess.id });
      setBalance(Number(bal ?? 0));
    } else {
      setSession(null); setBalance(0);
    }
    // Mouvements du jour : toutes sessions du registre (ouvertes ou clôturées)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: todaySess } = await supabase.from("cash_sessions")
      .select("id").in("cash_register_id", regs.map(r => r.id))
      .gte("opened_at", todayStart.toISOString());
    if (todaySess?.length) {
      const { data: mvts } = await supabase.from("cash_movements")
        .select("id, movement_type, amount_xaf, description, reference, created_at")
        .in("cash_session_id", todaySess.map(s => s.id))
        .order("created_at", { ascending: false }).limit(100);
      setMovements(mvts ?? []);
    } else {
      setMovements([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ALERT_ONLY : vérifie retard ouverture + retard fermeture (toutes les minutes)
  useEffect(() => {
    if (!registers.length) return;
    const reg = registers[0]; // première caisse active

    const check = () => {
      const now = new Date();

      // Retard ouverture : si pas de session et heure passée
      if (!session) {
        const [oh, om] = (reg.opening_time ?? "08:00").split(":").map(Number);
        const expOpen = new Date(now); expOpen.setHours(oh, om, 0, 0);
        const diff = Math.round((now.getTime() - expOpen.getTime()) / 60000);
        setOpenDelayMinutes(diff > 0 ? diff : null);
        setAlertClosingTime(false);
        return;
      }

      setOpenDelayMinutes(null);

      // Retard fermeture : session ouverte et heure dépassée
      const [ch, cm] = (reg.closing_time ?? "17:00").split(":").map(Number);
      const expClose = new Date(now); expClose.setHours(ch, cm, 0, 0);
      setAlertClosingTime(now > expClose);
    };

    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [session, registers]);

  function openModal(type: string) {
    idempKeyRef.current = crypto.randomUUID();
    setModal(type);
  }

  async function openSession(registerId: string, openingAmount: number) {
    setSaving(true);
    const { error } = await supabase.rpc("open_cash_session", {
      p_register_id:     registerId,
      p_opening_xaf:     openingAmount,
      p_idempotency_key: idempKeyRef.current,
    });
    setSaving(false);
    if (error) { alert("Erreur ouverture: " + error.message); return; }
    setModal(null); await load();
  }

  async function addMovement(type: "fund_addition" | "fund_withdrawal", amountAbs: number, description: string) {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.rpc("add_cash_movement", {
      p_session_id:      session.id,
      p_movement_type:   type,
      p_amount_xaf:      amountAbs,
      p_description:     description || null,
      p_idempotency_key: idempKeyRef.current,
    });
    if (error) alert("Erreur: " + error.message);
    setSaving(false); setModal(null); await load();
  }

  async function addFlotteMovement(type: "flotte_request" | "flotte_repayment", provider: string, amount: number, description: string) {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.rpc("add_cash_movement", {
      p_session_id:      session.id,
      p_movement_type:   type,
      p_amount_xaf:      amount,
      p_description:     description,
      p_idempotency_key: idempKeyRef.current,
    });
    if (error) alert("Erreur: " + error.message);
    setSaving(false); setModal(null); await load();
  }

  async function closeSession(countedXaf: number, justification: string) {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.rpc("close_cash_session", {
      p_session_id:      session.id,
      p_counted_xaf:     countedXaf,
      p_justification:   justification || null,
      p_idempotency_key: idempKeyRef.current,
    });
    if (error) { setSaving(false); alert("Erreur clôture: " + error.message); return; }
    setSaving(false); setModal(null); await load();
  }

  const netChange = balance - (session?.opening_amount_xaf ?? 0);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Session de caisse</h1>
          <p className="text-sm text-[#66736A] mt-0.5">
            {new Date().toLocaleDateString("fr-CM", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          <Link to="/caisse/historique" className="inline-flex items-center gap-1 text-xs text-[#66736A] hover:text-[#075B32] mt-1 transition-colors">
            <History className="w-3 h-3" /> Voir l'historique
          </Link>
        </div>
        {!loading && (
          session ? (
            <span className="flex items-center gap-1.5 text-sm text-[#067647] bg-[#E8F3EC] px-3 py-1.5 rounded-lg font-medium">
              <div className="w-2 h-2 rounded-full bg-[#067647]" />
              {session.register_name} — ouverte
            </span>
          ) : registers.length === 0 ? (
            <span className="text-xs text-[#B42318] bg-red-50 px-3 py-1.5 rounded-lg">Aucune caisse configurée</span>
          ) : (
            <button onClick={() => openModal("open")}
              className="flex items-center gap-1.5 bg-[#075B32] text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#063A22] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Ouvrir une caisse
            </button>
          )
        )}
      </div>

      {/* Alerte retard d'ouverture */}
      {openDelayMinutes !== null && !session && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>
            <strong>Retard d'ouverture : {fmtDelay(openDelayMinutes!)}</strong> — La caisse aurait dû être ouverte à{" "}
            {registers[0]?.opening_time ?? "08:00"}. Cette alerte est informative.
          </span>
        </div>
      )}

      {/* Alerte retard de fermeture */}
      {alertClosingTime && session && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>L'heure de clôture est dépassée. Cette alerte est informative — vous pouvez continuer à opérer.</span>
        </div>
      )}

      {/* Carte timing horodaté */}
      {session && (session.expected_open_at || session.expected_close_at) && (
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[#075B32]" />
            <span className="text-sm font-semibold text-[#17231C]">Horaires de session</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {/* Ouverture — heure prévue = horaire courant du registre */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#66736A] uppercase tracking-wide">Ouverture</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A0ADA5]">Prévu</span>
                <span className="font-mono text-[#17231C]">
                  {registers.find(r => r.id === session.register_id)?.opening_time ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A0ADA5]">Réel  </span>
                <span className="font-mono text-[#17231C]">
                  {new Date(session.opened_at).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {session.open_delay_minutes !== null && (
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  session.open_delay_minutes > 0
                    ? "bg-red-100 text-red-700"
                    : session.open_delay_minutes < 0
                    ? "bg-green-100 text-green-700"
                    : "bg-[#E8F3EC] text-[#067647]"
                }`}>
                  {session.open_delay_minutes > 0
                    ? `+${fmtDelay(session.open_delay_minutes)} de retard`
                    : session.open_delay_minutes < 0
                    ? `-${fmtDelay(session.open_delay_minutes)} d'avance`
                    : "À l'heure"}
                </span>
              )}
            </div>

            {/* Fermeture — toujours lire l'horaire courant du registre */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-[#66736A] uppercase tracking-wide">Fermeture prévue</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A0ADA5]">Prévu</span>
                <span className="font-mono text-[#17231C]">
                  {registers.find(r => r.id === session.register_id)?.closing_time ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#A0ADA5]">Statut</span>
                <span className={`text-xs font-medium ${alertClosingTime ? "text-amber-700" : "text-[#067647]"}`}>
                  {alertClosingTime ? "Heure dépassée" : "En cours"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-5 sm:col-span-1">
          <p className="text-sm text-[#66736A] mb-1">Solde actuel</p>
          <p className="text-3xl font-bold text-[#17231C] tabular-nums">{fmt(balance)}</p>
          <p className="text-xs text-[#66736A] mt-1">FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#067647]" />
            <p className="text-sm text-[#66736A]">Fond d'ouverture</p>
          </div>
          <p className="text-xl font-bold text-[#17231C] tabular-nums">{fmt(session?.opening_amount_xaf ?? 0)}</p>
          <p className="text-xs text-[#66736A] mt-1">FCFA</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
          <div className="flex items-center gap-2 mb-1">
            {netChange >= 0
              ? <TrendingUp className="w-4 h-4 text-[#067647]" />
              : <TrendingDown className="w-4 h-4 text-[#B42318]" />}
            <p className="text-sm text-[#66736A]">Variation nette</p>
          </div>
          <p className={`text-xl font-bold tabular-nums ${netChange >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
            {netChange >= 0 ? "+" : ""}{fmt(netChange)}
          </p>
          <p className="text-xs text-[#66736A] mt-1">FCFA</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#E2E8E3] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#17231C]">Opérations du jour</h2>
          {movements.length > 0 && (() => {
            const totalIn  = movements.filter(m => m.amount_xaf > 0).reduce((s, m) => s + m.amount_xaf, 0);
            const totalOut = movements.filter(m => m.amount_xaf < 0).reduce((s, m) => s + m.amount_xaf, 0);
            return (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-[#067647] font-medium tabular-nums">+{fmt(totalIn)}</span>
                <span className="text-[#B42318] font-medium tabular-nums">{fmt(totalOut)}</span>
                <span className="text-[#A0ADA5]">{movements.length} op.</span>
              </div>
            );
          })()}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[#A0ADA5]">Chargement…</div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Banknote className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
            <p className="text-sm text-[#A0ADA5]">Aucune opération enregistrée aujourd'hui</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8E3]">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F5F7F5] transition-colors"
                onClick={() => setSelectedMvt(m)}>
                <div>
                  <p className="text-sm font-medium text-[#17231C]">{MVT_LABELS[m.movement_type] ?? m.movement_type}</p>
                  <p className="text-xs text-[#66736A]">{m.description}</p>
                  <p className="text-xs text-[#A0ADA5]">{new Date(m.created_at).toLocaleTimeString("fr-CM", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className={`tabular-nums font-semibold text-sm ${m.amount_xaf >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                  {m.amount_xaf >= 0 ? "+" : ""}{fmt(m.amount_xaf)} FCFA
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {session && (
        <>
          {/* Boutons flotte (si flotte configurée) */}
          {flotte && (() => {
            const anyRequestOpen  = Object.values(flotte).some(p => p.enabled && nowMinutes() < timeToMinutes(p.request_deadline));
            const anyRepayOpen    = Object.values(flotte).some(p => p.enabled && nowMinutes() < timeToMinutes(p.repayment_deadline));
            const earliestRequest = Object.values(flotte).filter(p => p.enabled).map(p => p.request_deadline).sort()[0];
            const earliestRepay   = Object.values(flotte).filter(p => p.enabled).map(p => p.repayment_deadline).sort()[0];
            return (
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => { idempKeyRef.current = crypto.randomUUID(); openModal("flotte_request"); }}
                  disabled={!anyRequestOpen}
                  title={anyRequestOpen ? undefined : "Heure limite dépassée"}
                  className="flex flex-col items-center flex-1 justify-center bg-orange-50 border border-orange-200 text-orange-700 text-sm py-2 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-1.5 font-medium"><Signal className="w-3.5 h-3.5" /> Commande de flotte</span>
                  <span className="text-xs opacity-70">avant {earliestRequest}</span>
                </button>
                <button
                  onClick={() => { idempKeyRef.current = crypto.randomUUID(); openModal("flotte_repayment"); }}
                  disabled={!anyRepayOpen}
                  title={anyRepayOpen ? undefined : "Heure limite dépassée"}
                  className="flex flex-col items-center flex-1 justify-center bg-[#E8F3EC] border border-[#B7D9C4] text-[#075B32] text-sm py-2 rounded-lg hover:bg-[#D1EBD8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-1.5 font-medium"><Signal className="w-3.5 h-3.5" /> Remboursement de flotte</span>
                  <span className="text-xs opacity-70">avant {earliestRepay}</span>
                </button>
              </div>
            );
          })()}

          <div className="flex gap-3">
            <button onClick={() => openModal("entree")}
              className="flex items-center gap-2 flex-1 justify-center bg-[#F5F7F5] border border-[#E2E8E3] text-[#17231C] text-sm py-2.5 rounded-lg hover:bg-[#E8F3EC] transition-colors">
              <TrendingUp className="w-4 h-4 text-[#075B32]" /> Entrée de fonds
            </button>
            <button onClick={() => openModal("sortie")}
              className="flex items-center gap-2 flex-1 justify-center bg-[#F5F7F5] border border-[#E2E8E3] text-[#17231C] text-sm py-2.5 rounded-lg hover:bg-[#E8F3EC] transition-colors">
              <TrendingDown className="w-4 h-4 text-[#B42318]" /> Sortie de fonds
            </button>
            <button onClick={() => openModal("cloture")}
              className="flex items-center gap-2 flex-1 justify-center bg-[#B42318] text-white text-sm py-2.5 rounded-lg hover:bg-red-800 transition-colors">
              <Lock className="w-4 h-4" /> Clôturer
            </button>
          </div>
        </>
      )}

      {selectedMvt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMvt(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#17231C]">{MVT_LABELS[selectedMvt.movement_type] ?? selectedMvt.movement_type}</h2>
              <button onClick={() => setSelectedMvt(null)}><X className="w-4 h-4 text-[#66736A]" /></button>
            </div>
            <div className="bg-[#F5F7F5] rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold tabular-nums ${selectedMvt.amount_xaf >= 0 ? "text-[#067647]" : "text-[#B42318]"}`}>
                {selectedMvt.amount_xaf >= 0 ? "+" : ""}{fmt(selectedMvt.amount_xaf)} FCFA
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Description</span>
                <span className="text-[#17231C] font-medium text-right max-w-[200px]">{selectedMvt.description}</span>
              </div>
              {selectedMvt.reference && (
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Référence</span>
                  <span className="font-mono text-xs text-[#17231C]">{selectedMvt.reference}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#66736A]">Date & heure</span>
                <span className="text-[#17231C]">{new Date(selectedMvt.created_at).toLocaleString("fr-FR")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <ModalOverlay onClose={() => !saving && setModal(null)}>
          {modal === "open" && (
            <OpenModal registers={registers} saving={saving} onConfirm={openSession} onClose={() => setModal(null)} />
          )}
          {modal === "entree" && (
            <MovementModal title="Entrée de fonds" color="green" saving={saving}
              onConfirm={(a, d) => addMovement("fund_addition", a, d)} onClose={() => setModal(null)} />
          )}
          {modal === "sortie" && (
            <MovementModal title="Sortie de fonds" color="red" saving={saving}
              onConfirm={(a, d) => addMovement("fund_withdrawal", a, d)} onClose={() => setModal(null)} />
          )}
          {modal === "cloture" && (
            <ClotureModal balance={balance} saving={saving} onConfirm={closeSession} onClose={() => setModal(null)} />
          )}
          {modal === "flotte_request" && flotte && (
            <FlotteModal type="flotte_request" flotte={flotte} saving={saving}
              onConfirm={(prov, amt, desc) => addFlotteMovement("flotte_request", prov, amt, desc)}
              onClose={() => setModal(null)} />
          )}
          {modal === "flotte_repayment" && flotte && (
            <FlotteModal type="flotte_repayment" flotte={flotte} saving={saving}
              onConfirm={(prov, amt, desc) => addFlotteMovement("flotte_repayment", prov, amt, desc)}
              onClose={() => setModal(null)} />
          )}
        </ModalOverlay>
      )}
    </div>
  );
}
