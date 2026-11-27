import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Smartphone, AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

type MomoType = "deposit" | "withdrawal" | "send";
type Account = { id: string; provider: string; account_name: string; cash_balance: number; efloat_balance: number };

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

const TYPE_LABELS: Record<MomoType, string> = {
  deposit: "Dépôt", withdrawal: "Retrait", send: "Transfert envoyé",
};

// Indication du sens de l'opération pour l'agent
const TYPE_HINT: Record<MomoType, string> = {
  deposit:   "Cash reçu du client → solde électronique envoyé au client. Votre cash augmente, e-float diminue.",
  withdrawal: "E-float récupéré → cash remis au client. Votre e-float augmente, cash diminue.",
  send:      "Envoi électronique. Votre e-float diminue.",
};

export function MomoEntry() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialType = (params.get("type") as MomoType | null) ?? "deposit";

  const [type, setType]           = useState<MomoType>(initialType);
  const [phone, setPhone]         = useState("");
  const [name, setName]           = useState("");
  const [amount, setAmount]       = useState("");
  const [accounts, setAccounts]   = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Clé d'idempotence unique par montage du composant
  const [idempKey] = useState(() => `momo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

  const amountNum = parseInt(amount.replace(/\D/g, "")) || 0;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const oid = (user as any).app_metadata?.organization_id as string | null;
      if (!oid) { setLoading(false); return; }
      const { data: accs } = await supabase
        .from("mobile_money_accounts")
        .select("id, provider, account_name, cash_balance, efloat_balance")
        .eq("organization_id", oid).eq("is_active", true);
      setAccounts(accs ?? []);
      if (accs?.length) setAccountId(accs[0].id);
      setLoading(false);
    })();
  }, []);

  const selectedAccount = accounts.find(a => a.id === accountId);

  // Vérifie si le solde est suffisant (vérification indicative côté client, la vraie vérif est côté serveur)
  function balanceWarning(): string | null {
    if (!selectedAccount || amountNum <= 0) return null;
    if (type === "deposit" && selectedAccount.cash_balance < amountNum) {
      return `Réserve cash insuffisante. Disponible : ${fmt(selectedAccount.cash_balance)} FCFA.`;
    }
    if ((type === "withdrawal" || type === "send") && selectedAccount.efloat_balance < amountNum) {
      return `Solde électronique insuffisant. Disponible : ${fmt(selectedAccount.efloat_balance)} FCFA.`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId || amountNum <= 0) return;
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("record_momo_transaction", {
      p_account_id:      accountId,
      p_transaction_type: type,
      p_amount_xaf:      amountNum,
      p_phone_number:    phone || null,
      p_recipient_name:  type === "deposit" || type === "send" ? (name || null) : null,
      p_sender_name:     type === "withdrawal" ? (name || null) : null,
      p_idempotency_key: idempKey,
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    navigate("/mobile-money");
  }

  if (loading) {
    return (
      <div className="p-6 max-w-lg mx-auto flex items-center justify-center py-20">
        <span className="text-sm text-[#66736A]">Chargement…</span>
      </div>
    );
  }

  const warn = balanceWarning();

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Link to="/mobile-money" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-6 w-fit">
        <ArrowLeft className="w-4 h-4" /> Mobile Money
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#E8F3EC] flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-[#075B32]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Nouvelle opération</h1>
          <p className="text-sm text-[#66736A]">Mobile Money</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Aucun compte MoMo configuré</p>
            <p className="text-sm text-amber-700 mt-1">
              Créez d'abord un compte Mobile Money dans les paramètres.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#E2E8E3] p-5 space-y-5">

          {/* Compte MoMo */}
          {accounts.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-2">Compte MoMo</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm focus:ring-2 focus:ring-[#075B32] outline-none">
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.provider})</option>
                ))}
              </select>
            </div>
          )}

          {/* Soldes disponibles (indicatif) */}
          {selectedAccount && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#F5F7F5] rounded-lg px-3 py-2">
                <p className="text-xs text-[#66736A]">Cash dispo</p>
                <p className="text-sm font-semibold tabular-nums text-[#17231C]">{fmt(selectedAccount.cash_balance)} F</p>
              </div>
              <div className="bg-[#F5F7F5] rounded-lg px-3 py-2">
                <p className="text-xs text-[#66736A]">E-float dispo</p>
                <p className="text-sm font-semibold tabular-nums text-[#17231C]">{fmt(selectedAccount.efloat_balance)} F</p>
              </div>
            </div>
          )}

          {/* Type d'opération */}
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-2">Type d'opération</label>
            <div className="flex gap-2">
              {(["deposit", "withdrawal", "send"] as MomoType[]).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    type === t ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32] font-medium" : "border-[#E2E8E3] text-[#17231C] hover:bg-[#F5F7F5]"
                  }`}
                >{TYPE_LABELS[t]}</button>
              ))}
            </div>
            <p className="text-xs text-[#66736A] mt-1.5">{TYPE_HINT[type]}</p>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[#17231C] mb-1">
              Numéro de téléphone {type === "deposit" ? "du destinataire" : "de l'expéditeur"}
            </label>
            <input
              id="phone" type="tel" required placeholder="+237 6XX XXX XXX"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm font-mono text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>

          {/* Nom (optionnel) */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#17231C] mb-1">
              Nom {type === "withdrawal" ? "de l'expéditeur" : "du destinataire"}{" "}
              <span className="text-[#A0ADA5] font-normal">(optionnel)</span>
            </label>
            <input
              id="name" type="text" placeholder="Nom du client"
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>

          {/* Montant */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-[#17231C] mb-1">
              Montant (FCFA)
            </label>
            <input
              id="amount" type="number" min={100} required placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none text-right"
            />
          </div>

          {/* Résumé */}
          {amountNum > 0 && (
            <div className="bg-[#F5F7F5] rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-[#66736A]">Montant</span>
                <span className="tabular-nums font-medium text-[#17231C]">{fmt(amountNum)} FCFA</span>
              </div>
              <div className="flex justify-between text-xs text-[#66736A]">
                <span>Commission BS4U</span>
                <span>calculée automatiquement</span>
              </div>
            </div>
          )}

          {/* Alerte solde insuffisant (indicative) */}
          {warn && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          )}

          {/* Erreur serveur */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={!phone || amountNum <= 0 || saving}
            className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#063A22] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? "Enregistrement…" : "Enregistrer l'opération"}
          </button>
          <p className="text-xs text-[#66736A] text-center">
            Clé d'idempotence générée automatiquement · Vérification des soldes côté serveur
          </p>
        </form>
      )}
    </div>
  );
}
