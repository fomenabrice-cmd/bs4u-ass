import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useState } from "react";

const ALL_PROFILES = [
  { slug: "jean-nguema-dev", name: "Jean Nguema",   title: "Développeur Web",    skills: ["React","Node.js"], city: "Yaoundé", status: "approved" },
  { slug: "alice-fouda-dg",  name: "Alice Fouda",   title: "Designer UI/UX",     skills: ["Figma","CSS"],     city: "Yaoundé", status: "approved" },
  { slug: "paul-mvondo-mkt", name: "Paul Mvondo",   title: "Marketing Digital",  skills: ["SEO","Ads"],       city: "Yaoundé", status: "approved" },
  { slug: "ines-essogo-rh",  name: "Inès Essogo",  title: "Consultante RH",     skills: ["Recrutement"],     city: "Yaoundé", status: "approved" },
  { slug: "marc-ateba-cpa",  name: "Marc Ateba",    title: "Comptable CPA",      skills: ["Compta","Excel"],  city: "Yaoundé", status: "approved" },
  { slug: "sara-nkolo-law",  name: "Sara Nkolo",    title: "Juriste d'affaires", skills: ["Droit","Contrats"],city: "Yaoundé", status: "approved" },
];

export function ProfilesPage() {
  const [search, setSearch] = useState("");
  const filtered = ALL_PROFILES.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.skills.some(s => s.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#17231C] mb-3">Tous les talents</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66736A]" />
          <input type="search" placeholder="Chercher par nom, titre, compétence…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8E3] rounded-lg text-sm bg-white text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Link key={p.slug} to={`/profils/${p.slug}`}
            className="bg-white rounded-xl border border-[#E2E8E3] p-4 hover:border-[#075B32] hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#E8F3EC] flex items-center justify-center shrink-0">
                <span className="text-[#075B32] font-bold text-sm">{p.name.split(" ").map(n => n[0]).join("")}</span>
              </div>
              <div>
                <p className="font-semibold text-[#17231C] text-sm">{p.name}</p>
                <p className="text-xs text-[#066D3B]">{p.title}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {p.skills.map((s) => (
                <span key={s} className="text-xs bg-[#F5F7F5] text-[#66736A] px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-[#66736A] text-sm">Aucun profil trouvé</div>
        )}
      </div>
    </div>
  );
}
