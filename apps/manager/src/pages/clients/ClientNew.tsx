import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, Phone, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Step = 1 | 2 | 3;
type Kind = "individual" | "company" | "association" | "administration";

const STEPS = [
  { n: 1 as Step, label: "Identité",  icon: User },
  { n: 2 as Step, label: "Contact",   icon: Phone },
  { n: 3 as Step, label: "Confirmer", icon: Check },
];

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "individual",    label: "Particulier" },
  { value: "company",       label: "Entreprise" },
  { value: "association",   label: "Association" },
  { value: "administration",label: "Administration" },
];

export function ClientNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kind,        setKind]        = useState<Kind>("individual");
  const [fullName,    setFullName]    = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [city,        setCity]        = useState("");

  const displayName = kind === "individual" ? fullName : companyName;

  function reset() {
    setKind("individual"); setFullName(""); setCompanyName("");
    setPhone(""); setEmail(""); setCity(""); setStep(1); setError(null);
  }

  async function doInsert() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("contacts").insert({
      type:         "client",
      is_company:   kind !== "individual",
      full_name:    kind === "individual" ? fullName    : null,
      company_name: kind !== "individual" ? companyName : null,
      phone:        phone  || null,
      email:        email  || null,
      city:         city   || null,
      is_active:    true,
    });
    setSaving(false);
    if (err) { setError(err.message); return false; }
    return true;
  }

  async function handleSave() {
    if (await doInsert()) navigate("/clients");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/clients" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-6 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Clients
      </Link>

      <h1 className="text-xl font-semibold text-[#17231C] mb-6">Nouveau client</h1>

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

      <div className="bg-white rounded-xl border border-[#E2E8E3] p-6 min-h-[260px] flex flex-col">
        {step === 1 && (
          <div className="flex flex-col gap-4 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Type de client</h2>
            <div className="grid grid-cols-2 gap-3">
              {KIND_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setKind(o.value)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    kind === o.value
                      ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32]"
                      : "border-[#E2E8E3] text-[#66736A] hover:border-[#075B32]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="block text-sm font-medium text-[#17231C] mb-1">
                {kind === "individual" ? "Nom complet" : "Raison sociale"}
              </label>
              <input
                type="text"
                value={kind === "individual" ? fullName : companyName}
                onChange={e => kind === "individual" ? setFullName(e.target.value) : setCompanyName(e.target.value)}
                placeholder={kind === "individual" ? "Jean Dupont" : "ACME SARL"}
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Coordonnées</h2>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Téléphone</label>
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="contact@exemple.cm"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#17231C] mb-1">Ville</label>
              <input
                type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Yaoundé"
                className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3 flex-1">
            <h2 className="text-base font-semibold text-[#17231C]">Récapitulatif</h2>
            <dl className="text-sm space-y-2">
              <div className="flex gap-2"><dt className="text-[#66736A] w-24">Type</dt><dd className="text-[#17231C]">{KIND_OPTIONS.find(o => o.value === kind)?.label}</dd></div>
              <div className="flex gap-2"><dt className="text-[#66736A] w-24">Nom</dt><dd className="text-[#17231C]">{displayName || "—"}</dd></div>
              {phone && <div className="flex gap-2"><dt className="text-[#66736A] w-24">Téléphone</dt><dd className="text-[#17231C]">{phone}</dd></div>}
              {email && <div className="flex gap-2"><dt className="text-[#66736A] w-24">Email</dt><dd className="text-[#17231C]">{email}</dd></div>}
              {city  && <div className="flex gap-2"><dt className="text-[#66736A] w-24">Ville</dt><dd className="text-[#17231C]">{city}</dd></div>}
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
                disabled={step === 1 && !displayName.trim()}
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
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
