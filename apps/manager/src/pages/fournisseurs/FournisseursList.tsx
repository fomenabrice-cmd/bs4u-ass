import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Truck, Plus, Search, Phone, MapPin, Mail,
  Filter, MoreVertical, Building2, Loader2
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const ease = [0.22, 1, 0.36, 1] as const;

type Fournisseur = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  category: string | null;
  balance: number;
};

const CATEGORIES = ["Toutes", "Fournitures", "Mobilier", "Matériel", "Services", "Autre"];

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F3EC] text-[#075B32]">
      {label}
    </span>
  );
}

export function FournisseursList() {
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("Toutes");
  const [showNew,  setShowNew]  = useState(false);
  const [data,     setData]     = useState<Fournisseur[]>([]);
  const [loading,  setLoading]  = useState(true);

  // Form state
  const [fNom,     setFNom]     = useState("");
  const [fContact, setFContact] = useState("");
  const [fEmail,   setFEmail]   = useState("");
  const [fPhone,   setFPhone]   = useState("");
  const [fVille,   setFVille]   = useState("");
  const [fSaving,  setFSaving]  = useState(false);
  const [fError,   setFError]   = useState<string | null>(null);

  function fReset() {
    setFNom(""); setFContact(""); setFEmail("");
    setFPhone(""); setFVille(""); setFError(null);
  }

  function reload() {
    supabase
      .from("contacts")
      .select("id, company_name, full_name, contact_person, email, phone, city, notes")
      .in("type", ["supplier", "both"])
      .then(({ data: rows }) => {
        setData((rows ?? []).map(r => ({
          id: r.id,
          name: r.company_name ?? r.full_name ?? "—",
          contact: r.contact_person ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          city: r.city ?? null,
          category: null,
          balance: 0,
        })));
      });
  }

  async function fDoInsert() {
    if (!fNom.trim()) { setFError("Le nom est obligatoire."); return false; }
    setFSaving(true);
    setFError(null);
    const { error: err } = await supabase.from("contacts").insert({
      type:           "supplier",
      is_company:     true,
      company_name:   fNom.trim(),
      contact_person: fContact || null,
      email:          fEmail   || null,
      phone:          fPhone   || null,
      city:           fVille   || null,
      is_active:      true,
    });
    setFSaving(false);
    if (err) { setFError(err.message); return false; }
    reload();
    return true;
  }

  useEffect(() => {
    supabase
      .from("contacts")
      .select("id, company_name, full_name, contact_person, email, phone, city, notes")
      .in("type", ["supplier", "both"])
      .then(({ data: rows }) => {
        setData((rows ?? []).map(r => ({
          id: r.id,
          name: r.company_name ?? r.full_name ?? "—",
          contact: r.contact_person ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          city: r.city ?? null,
          category: null,
          balance: 0,
        })));
        setLoading(false);
      });
  }, []);

  const filtered = data.filter(f => {
    const q = search.toLowerCase();
    const matchQ = !q || f.name.toLowerCase().includes(q) || (f.contact ?? "").toLowerCase().includes(q) || (f.city ?? "").toLowerCase().includes(q);
    const matchC = category === "Toutes" || f.category === category;
    return matchQ && matchC;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#17231C]">Fournisseurs</h1>
          <p className="text-[#66736A] text-sm mt-0.5">{data.length} fournisseurs enregistrés</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#075B32] hover:bg-[#063A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Plus size={16} /> Nouveau fournisseur
        </button>
      </motion.div>

      {/* Filtres */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.05 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0ADA5]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl bg-[#F5F7F5] focus:outline-none focus:border-[#075B32] focus:bg-white focus:ring-2 focus:ring-[#075B32]/20" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#A0ADA5]" />
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  category === c ? "bg-[#075B32] text-white" : "bg-[#F5F7F5] text-[#66736A] hover:bg-[#E8F3EC] hover:text-[#075B32]"
                }`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tableau */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease, delay: 0.1 }}
        className="bg-white rounded-2xl border border-[#E2E8E3] overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#075B32]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#A0ADA5]">
            <Truck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun fournisseur trouvé</p>
            <p className="text-xs mt-1">Modifiez votre recherche ou ajoutez un fournisseur.</p>
          </div>
        ) : (
          <table className="w-full">

            <thead>
              <tr className="border-b border-[#E2E8E3] bg-[#F5F7F5]">
                {["Fournisseur", "Contact", "Localisation", "Catégorie", "Solde", ""].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-[#A0ADA5] uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <motion.tr key={f.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="border-b border-[#F5F7F5] hover:bg-[#F9FBF9] transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#075B32]/10 flex items-center justify-center shrink-0">
                        <Building2 size={16} className="text-[#075B32]" />
                      </div>
                      <span className="text-sm font-semibold text-[#17231C]">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {f.contact && <p className="text-sm text-[#17231C]">{f.contact}</p>}
                      {f.email   && <p className="text-xs text-[#A0ADA5] flex items-center gap-1"><Mail size={10} />{f.email}</p>}
                      {f.phone   && <p className="text-xs text-[#A0ADA5] flex items-center gap-1"><Phone size={10} />{f.phone}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {f.city ? (
                      <span className="flex items-center gap-1 text-sm text-[#66736A]">
                        <MapPin size={12} className="shrink-0" />{f.city}
                      </span>
                    ) : <span className="text-[#D0D5D2]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {f.category ? <Badge label={f.category} /> : <span className="text-[#D0D5D2]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${f.balance < 0 ? "text-[#B42318]" : f.balance > 0 ? "text-[#075B32]" : "text-[#A0ADA5]"}`}>
                      {f.balance === 0 ? "Soldé" : `${f.balance.toLocaleString("fr-FR")} FCFA`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="p-1.5 rounded-lg hover:bg-[#F5F7F5] text-[#A0ADA5] hover:text-[#17231C] transition-colors">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Modal nouveau fournisseur */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowNew(false); fReset(); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-[#17231C] flex items-center gap-2"><Truck size={18} className="text-[#075B32]" /> Nouveau fournisseur</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1">Nom de l'entreprise *</label>
                <input value={fNom} onChange={e => setFNom(e.target.value)} placeholder="Ex: Imprimex Cameroun"
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1">Personne de contact</label>
                <input value={fContact} onChange={e => setFContact(e.target.value)} placeholder="Prénom Nom"
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1">Email</label>
                <input value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="contact@fournisseur.cm" type="email"
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1">Téléphone</label>
                <input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="+237 6XX XXX XXX" type="tel"
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#17231C] mb-1">Ville</label>
                <input value={fVille} onChange={e => setFVille(e.target.value)} placeholder="Yaoundé"
                  className="w-full px-3 py-2.5 text-sm border border-[#E2E8E3] rounded-xl focus:outline-none focus:border-[#075B32] focus:ring-2 focus:ring-[#075B32]/20" />
              </div>
              {fError && <p className="text-xs text-red-600">{fError}</p>}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowNew(false); fReset(); }}
                className="flex-1 py-2.5 text-sm text-[#66736A] border border-[#E2E8E3] rounded-xl hover:bg-[#F5F7F5] transition-colors">
                Annuler
              </button>
              <button onClick={async () => { if (await fDoInsert()) fReset(); }}
                disabled={fSaving}
                className="py-2.5 px-4 text-sm border border-[#075B32] text-[#075B32] rounded-xl hover:bg-[#E8F3EC] disabled:opacity-40 transition-colors">
                + Ajouter un autre
              </button>
              <button onClick={async () => { if (await fDoInsert()) { fReset(); setShowNew(false); } }}
                disabled={fSaving}
                className="flex-1 py-2.5 text-sm text-white bg-[#075B32] hover:bg-[#063A22] rounded-xl font-semibold disabled:opacity-40 transition-colors">
                {fSaving ? "…" : "Enregistrer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
