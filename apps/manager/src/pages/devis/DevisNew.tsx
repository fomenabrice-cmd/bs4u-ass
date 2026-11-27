import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, FileText, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Step = 1 | 2 | 3;

const STEPS = [
  { n: 1 as Step, label: "Client",        icon: User },
  { n: 2 as Step, label: "Lignes",        icon: FileText },
  { n: 3 as Step, label: "Confirmer",     icon: Check },
];

interface LigneDevis {
  description: string;
  quantite: number;
  prix_unitaire: number;
}

export function DevisNew() {
  const navigate = useNavigate();
  const [step,    setStep]   = useState<Step>(1);
  const [saving,  setSaving] = useState(false);
  const [error,   setError]  = useState<string | null>(null);

  const [clientSearch, setClientSearch] = useState("");
  const [clientId,     setClientId]     = useState<string | null>(null);
  const [clientName,   setClientName]   = useState("");
  const [clients,      setClients]      = useState<{ id: string; name: string }[]>([]);
  const [searching,    setSearching]    = useState(false);

  const [objet,  setObjet]  = useState("");
  const [lignes, setLignes] = useState<LigneDevis[]>([
    { description: "", quantite: 1, prix_unitaire: 0 },
  ]);

  const totalXaf = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  async function searchClients(q: string) {
    setClientSearch(q);
    if (q.length < 2) { setClients([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("contacts")
      .select("id, full_name, company_name, is_company")
      .or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%`)
      .is("deleted_at", null)
      .limit(8);
    setClients(
      (data ?? []).map((c: any) => ({
        id:   c.id,
        name: c.is_company ? (c.company_name ?? c.full_name ?? "—") : (c.full_name ?? "—"),
      }))
    );
    setSearching(false);
  }

  function selectClient(id: string, name: string) {
    setClientId(id); setClientName(name);
    setClientSearch(name); setClients([]);
  }

  function updateLigne(i: number, field: keyof LigneDevis, val: string | number) {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  }

  function reset() {
    setStep(1); setClientSearch(""); setClientId(null); setClientName("");
    setClients([]); setObjet("");
    setLignes([{ description: "", quantite: 1, prix_unitaire: 0 }]);
    setError(null);
  }

  async function doInsert() {
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    const orgId = (user as any)?.app_metadata?.organization_id as string | undefined;
    const year  = new Date().getFullYear().toString().slice(-2);
    const ref   = `DV${year}-${Date.now().toString().slice(-5)}`;
    const { error: err } = await supabase.from("quotes").insert({
      organization_id: orgId,
      client_id:       clientId,
      reference:       ref,
      notes:           objet || null,
      status:          "draft",
      subtotal:        totalXaf,
      tax_amount:      0,
      discount_amount: 0,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    return true;
  }

  async function handleSave() {
    if (await doInsert()) navigate("/devis");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/devis" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-6 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Devis
      </Link>

      <h1 className="text-xl font-semibold text-[#17231C] mb-6">Nouveau devis</h1>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done   = step > s.n;
          const active = step === s.n;
          const Icon   = s.icon;
          return (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  done || active ? "bg-[#075B32] text-white" : "bg-[#E2E8E3] text-[#66736A]"
                }`}>
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-xs mt-1 font-medium ${active || done ? "text-[#075B32]" : "text-[#66736A]"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-[-12px] ${done ? "bg-[#075B32]" : "bg-[#E2E8E3]"}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] p-6 min-h-[280px] flex flex-col">
        {step === 1 && (
          <div className="flex flex-col gap-4 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Sélectionner un client</h2>
            <div className="relative">
              <input
                type="search" value={clientSearch}
                onChange={e => searchClients(e.target.value)}
                placeholder="Rechercher un client…"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
              {clients.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-[#E2E8E3] rounded-lg shadow-lg overflow-hidden">
                  {clients.map(c => (
                    <li key={c.id}>
                      <button
                        onClick={() => selectClient(c.id, c.name)}
                        className="w-full text-left px-4 py-2 text-sm text-[#17231C] hover:bg-[#E8F3EC] transition-colors"
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searching && <p className="text-xs text-[#66736A] mt-1">Recherche…</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Objet du devis</label>
              <input
                type="text" value={objet} onChange={e => setObjet(e.target.value)}
                placeholder="Conception de logo, Impression…"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Lignes du devis</h2>
            <div className="space-y-3">
              {lignes.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px] gap-2 items-center">
                  <input
                    type="text" value={l.description}
                    onChange={e => updateLigne(i, "description", e.target.value)}
                    placeholder="Description"
                    className="px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
                  />
                  <input
                    type="number" min={1} value={l.quantite}
                    onChange={e => updateLigne(i, "quantite", Number(e.target.value))}
                    placeholder="Qté"
                    className="px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
                  />
                  <input
                    type="number" min={0} value={l.prix_unitaire}
                    onChange={e => updateLigne(i, "prix_unitaire", Number(e.target.value))}
                    placeholder="Prix XAF"
                    className="px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => setLignes(prev => [...prev, { description: "", quantite: 1, prix_unitaire: 0 }])}
              className="text-sm text-[#075B32] hover:underline w-fit"
            >
              + Ajouter une ligne
            </button>
            <p className="text-sm font-semibold text-[#17231C] mt-auto">
              Total : {totalXaf.toLocaleString("fr-CM")} FCFA
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Récapitulatif</h2>
            <dl className="text-sm space-y-2">
              <div className="flex gap-2"><dt className="text-[#66736A] w-20">Client</dt><dd className="text-[#17231C]">{clientName || "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-[#66736A] w-20">Objet</dt><dd className="text-[#17231C]">{objet || "—"}</dd></div>
              <div className="flex gap-2"><dt className="text-[#66736A] w-20">Lignes</dt><dd className="text-[#17231C]">{lignes.length}</dd></div>
              <div className="flex gap-2"><dt className="text-[#66736A] w-20">Total</dt><dd className="font-semibold text-[#17231C]">{totalXaf.toLocaleString("fr-CM")} FCFA</dd></div>
            </dl>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-[#E2E8E3]">
          {step > 1
            ? <button onClick={() => setStep((step - 1) as Step)} className="text-sm text-[#66736A] hover:text-[#075B32]">Précédent</button>
            : <span />
          }
          {step < 3
            ? <button
                onClick={() => setStep((step + 1) as Step)}
                disabled={step === 1 && !clientId}
                className="bg-[#075B32] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#063A22] disabled:opacity-40 transition-colors"
              >
                Suivant
              </button>
            : <div className="flex gap-2">
                <button
                  onClick={async () => { if (await doInsert()) reset(); }}
                  disabled={saving}
                  className="border border-[#075B32] text-[#075B32] text-sm px-3 py-2 rounded-lg hover:bg-[#E8F3EC] disabled:opacity-40 transition-colors"
                >
                  + Ajouter un autre
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#075B32] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#063A22] disabled:opacity-40 transition-colors"
                >
                  {saving ? "Enregistrement…" : "Enregistrer le devis"}
                </button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
