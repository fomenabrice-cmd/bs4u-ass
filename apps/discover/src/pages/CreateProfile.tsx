import { useState } from "react";
import { User, Briefcase, MapPin, Mail, Phone, ChevronRight, CheckCircle, Send } from "lucide-react";

type Step = "info" | "skills" | "review" | "done";

const DOMAINS = ["Développement web", "Design", "Marketing", "Comptabilité", "Droit", "Formations", "Artisanat", "Commerce", "Santé", "Autre"];

export function CreateProfile() {
  const [step, setStep] = useState<Step>("info");
  const [form, setForm] = useState({
    full_name: "", title: "", city: "Yaoundé", phone: "", email: "",
    bio: "", domains: [] as string[], skills: "",
  });

  const steps: { key: Step; label: string }[] = [
    { key: "info",   label: "Informations" },
    { key: "skills", label: "Compétences" },
    { key: "review", label: "Validation" },
  ];

  const stepIdx = steps.findIndex((s) => s.key === step);

  if (step === "done") {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-[#075B32]" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Profil soumis !</h1>
        <p className="text-slate-600 text-sm">
          Votre profil a été envoyé pour validation. L'équipe BS4U vous contactera dans les 48 heures.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Étapes */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map(({ key, label }, i) => (
          <div key={key} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
              i < stepIdx ? "bg-[#075B32] text-white"
              : i === stepIdx ? "bg-[#075B32] text-white ring-4 ring-emerald-100"
              : "bg-slate-200 text-slate-500"
            }`}>
              {i < stepIdx ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i <= stepIdx ? "text-slate-800" : "text-slate-400"}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-1 ${i < stepIdx ? "bg-[#075B32]" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        {step === "info" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Informations personnelles</h2>
            {[
              { key: "full_name", label: "Nom complet",          icon: User,     type: "text",  placeholder: "Jean Nguema" },
              { key: "title",     label: "Titre professionnel",  icon: Briefcase,type: "text",  placeholder: "Développeur Web Fullstack" },
              { key: "city",      label: "Ville",                icon: MapPin,   type: "text",  placeholder: "Yaoundé" },
              { key: "phone",     label: "Téléphone",            icon: Phone,    type: "tel",   placeholder: "+237 6 xx xx xx xx" },
              { key: "email",     label: "E-mail professionnel", icon: Mail,     type: "email", placeholder: "vous@example.cm" },
            ].map(({ key, label, icon: Icon, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={type} value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Présentation</label>
              <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Décrivez votre parcours et vos spécialités en quelques lignes…"
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20 resize-none"
              />
            </div>
          </div>
        )}

        {step === "skills" && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Compétences & Domaines</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Domaine(s) d'activité</label>
              <div className="flex flex-wrap gap-2">
                {DOMAINS.map((d) => (
                  <button key={d} onClick={() => setForm((f) => ({
                    ...f,
                    domains: f.domains.includes(d) ? f.domains.filter((x) => x !== d) : [...f.domains, d],
                  }))}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      form.domains.includes(d)
                        ? "bg-[#075B32] text-white border-[#075B32]"
                        : "border-slate-300 text-slate-700 hover:border-[#075B32] hover:bg-emerald-50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Compétences clés (séparées par virgule)</label>
              <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="React, Node.js, PostgreSQL, TypeScript…"
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20"
              />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Vérifier avant envoi</h2>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex gap-2"><span className="text-slate-500 w-32 shrink-0">Nom</span><span className="font-medium">{form.full_name || "—"}</span></div>
              <div className="flex gap-2"><span className="text-slate-500 w-32 shrink-0">Titre</span><span className="font-medium">{form.title || "—"}</span></div>
              <div className="flex gap-2"><span className="text-slate-500 w-32 shrink-0">Ville</span><span className="font-medium">{form.city}</span></div>
              <div className="flex gap-2"><span className="text-slate-500 w-32 shrink-0">Domaines</span><span className="font-medium">{form.domains.join(", ") || "—"}</span></div>
              <div className="flex gap-2"><span className="text-slate-500 w-32 shrink-0">Compétences</span><span className="font-medium">{form.skills || "—"}</span></div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              Votre profil sera examiné par l'équipe BS4U avant publication. Délai : 24 à 48 heures.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step !== "info" && (
            <button onClick={() => setStep(steps[stepIdx - 1]!.key)}
              className="flex-1 border border-slate-300 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
              Retour
            </button>
          )}
          <button
            onClick={() => {
              if (step === "review") setStep("done");
              else setStep(steps[stepIdx + 1]!.key);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-[#075B32] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#063A22] transition-colors"
          >
            {step === "review" ? (
              <><Send className="w-4 h-4" /> Soumettre le profil</>
            ) : (
              <>Continuer <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
