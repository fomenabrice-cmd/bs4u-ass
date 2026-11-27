import { useState } from "react";
import { User, Mail, Phone, MapPin, Save } from "lucide-react";

export function MemberProfile() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "Jean-Paul Mbarga",
    email: "jpmbarga@example.cm",
    phone: "+237 6 55 00 00 01",
    city: "Yaoundé",
    quarter: "Bastos",
    profession: "Commerçant",
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-[#063A22] px-4 py-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[#D6A52B] mx-auto flex items-center justify-center text-2xl font-bold text-[#063A22]">
          JP
        </div>
        <h1 className="text-white font-bold text-lg mt-3">{form.full_name}</h1>
        <p className="text-emerald-300 text-sm">{form.profession}</p>
      </div>

      <div className="px-4 mt-6 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Informations personnelles</h2>
          <button onClick={() => setEditing(!editing)}
            className="text-xs text-[#075B32] font-medium border border-[#075B32]/30 px-3 py-1 rounded-lg hover:bg-emerald-50">
            {editing ? "Annuler" : "Modifier"}
          </button>
        </div>

        {([
          { key: "full_name",  label: "Nom complet", icon: User  },
          { key: "email",      label: "E-mail",       icon: Mail  },
          { key: "phone",      label: "Téléphone",    icon: Phone },
          { key: "city",       label: "Ville",        icon: MapPin},
          { key: "quarter",    label: "Quartier",     icon: MapPin},
          { key: "profession", label: "Profession",   icon: User  },
        ] as const).map(({ key, label, icon: Icon }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-[#075B32]" />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            {editing ? (
              <input value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full text-sm text-slate-900 border-0 border-b border-slate-300 pb-1 focus:outline-none focus:border-[#075B32]"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900">{form[key] || "—"}</p>
            )}
          </div>
        ))}

        {editing && (
          <button onClick={() => setEditing(false)}
            className="w-full flex items-center justify-center gap-2 bg-[#075B32] text-white py-3 rounded-xl font-semibold text-sm">
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        )}
      </div>
    </div>
  );
}
