import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, User, FileText, CreditCard, Check } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1 as Step, label: "Client",     icon: User },
  { n: 2 as Step, label: "Prestations",icon: FileText },
  { n: 3 as Step, label: "Récapitulatif",icon: FileText },
  { n: 4 as Step, label: "Confirmation",icon: Check },
];

export function OrderNew() {
  const [step, setStep] = useState<Step>(1);
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/commandes" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-6 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Commandes
      </Link>

      <h1 className="text-xl font-semibold text-[#17231C] mb-6">Nouvelle commande</h1>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          const Icon = s.icon;
          return (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  done   ? "bg-[#075B32] text-white" :
                  active ? "bg-[#075B32] text-white" :
                           "bg-[#E2E8E3] text-[#66736A]"
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

      {/* Contenu de l'étape */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] p-6 min-h-[300px] flex flex-col">
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-[#17231C] mb-4">Sélectionner ou créer un client</h2>
            <input
              type="search" placeholder="Rechercher un client existant…"
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] bg-white focus:ring-2 focus:ring-[#075B32] outline-none mb-3"
            />
            <p className="text-sm text-[#66736A]">Ou créer un nouveau client à la volée via le bouton ci-dessous.</p>
          </div>
        )}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-[#17231C] mb-4">Ajouter des prestations</h2>
            <p className="text-sm text-[#66736A]">Sélectionner les services / produits du catalogue. Les prix sont calculés en FCFA (entiers, pas de décimales).</p>
          </div>
        )}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-[#17231C] mb-4">Récapitulatif</h2>
            <p className="text-sm text-[#66736A]">Vérifiez les informations avant de confirmer la commande.</p>
          </div>
        )}
        {step === 4 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#E8F3EC] flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-[#075B32]" />
            </div>
            <h2 className="text-lg font-semibold text-[#17231C] mb-1">Commande créée !</h2>
            <p className="text-sm text-[#66736A] mb-4">La commande a été enregistrée et envoyée en production.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setStep(1)} className="border border-[#075B32] text-[#075B32] text-sm px-3 py-2 rounded-lg hover:bg-[#E8F3EC] transition-colors">
                + Nouvelle commande
              </button>
              <button onClick={() => navigate("/commandes")} className="bg-[#075B32] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#063A22]">
                Retour aux commandes
              </button>
            </div>
          </div>
        )}

        {step < 4 && (
          <div className="flex justify-between mt-auto pt-4 border-t border-[#E2E8E3]">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              disabled={step === 1}
              className="text-sm text-[#66736A] hover:text-[#17231C] disabled:opacity-30"
            >
              Précédent
            </button>
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1) as Step)}
              className="bg-[#075B32] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#063A22]"
            >
              {step === 3 ? "Confirmer la commande" : "Suivant"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
