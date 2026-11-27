import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Building2, User, Users, Filter } from "lucide-react";
import { supabase } from "../../lib/supabase";

type CustomerKind = "individual" | "company" | "association" | "administration";
type CustomerCategory = "standard" | "vip" | "member" | "partner" | "internal";

interface Customer {
  id: string; customer_number: string; kind: CustomerKind;
  display_name: string; phone?: string; email?: string; city?: string;
  category: CustomerCategory; created_at: string;
}

const kindLabel: Record<CustomerKind, string> = {
  individual:    "Particulier", company:       "Entreprise",
  association:   "Association", administration: "Administration",
};
const categoryBadge: Record<CustomerCategory, { label: string; cls: string }> = {
  standard:  { label: "Standard",   cls: "bg-[#F5F7F5] text-[#66736A]" },
  vip:       { label: "VIP",        cls: "bg-amber-50 text-[#7A5A0E]" },
  member:    { label: "Membre",     cls: "bg-[#E8F3EC] text-[#067647]" },
  partner:   { label: "Partenaire", cls: "bg-blue-50 text-[#175CD3]" },
  internal:  { label: "Interne",    cls: "bg-[#F5F7F5] text-[#66736A]" },
};
const KindIcon = ({ kind }: { kind: CustomerKind }) => {
  if (kind === "company" || kind === "association" || kind === "administration") {
    return <Building2 className="w-4 h-4 text-[#66736A]" />;
  }
  return <User className="w-4 h-4 text-[#66736A]" />;
};

export function ClientsList() {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<CustomerKind | "">("");
  const [catFilter, setCatFilter] = useState<CustomerCategory | "">("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    supabase
      .from("contacts")
      .select("id, type, is_company, full_name, company_name, phone, email, city, created_at")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setCustomers(data.map((c: any, idx: number) => ({
          id: c.id,
          customer_number: "CLI-" + String(idx + 1).padStart(6, "0"),
          kind: (c.type ?? (c.is_company ? "company" : "individual")) as CustomerKind,
          display_name: c.is_company ? (c.company_name ?? c.full_name ?? "—") : (c.full_name ?? "—"),
          phone: c.phone ?? undefined,
          email: c.email ?? undefined,
          city: c.city ?? undefined,
          category: "standard" as CustomerCategory,
          created_at: c.created_at?.split("T")[0] ?? "",
        })));
      });
  }, []);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.display_name.toLowerCase().includes(q) ||
      c.customer_number.includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q);
    const matchKind = !kindFilter || c.kind === kindFilter;
    const matchCat  = !catFilter  || c.category === catFilter;
    return matchSearch && matchKind && matchCat;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Clients</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{filtered.length} client{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/clients/nouveau"
          className="flex items-center gap-2 bg-[#075B32] text-white text-sm px-3 py-2 rounded-lg hover:bg-[#063A22] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau client
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#66736A]" aria-hidden />
          <input
            type="search"
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] placeholder:text-[#66736A] bg-white focus:ring-2 focus:ring-[#075B32] focus:border-transparent outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#66736A]" aria-hidden />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as CustomerKind | "")}
            className="text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 bg-white text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
            aria-label="Filtrer par type"
          >
            <option value="">Tous les types</option>
            <option value="individual">Particuliers</option>
            <option value="company">Entreprises</option>
            <option value="association">Associations</option>
            <option value="administration">Administrations</option>
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value as CustomerCategory | "")}
            className="text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 bg-white text-[#17231C] focus:ring-2 focus:ring-[#075B32] outline-none"
            aria-label="Filtrer par catégorie"
          >
            <option value="">Toutes catégories</option>
            <option value="vip">VIP</option>
            <option value="member">Membres</option>
            <option value="partner">Partenaires</option>
            <option value="standard">Standard</option>
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
        <table className="w-full text-sm" aria-label="Liste des clients">
          <thead>
            <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden sm:table-cell">Numéro</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden md:table-cell">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden lg:table-cell">Ville</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Catégorie</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8E3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-[#66736A]">
                  <Users className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" aria-hidden />
                  <p>Aucun client trouvé</p>
                  {search && (
                    <button onClick={() => setSearch("")} className="text-[#075B32] text-sm mt-1 hover:underline">
                      Réinitialiser la recherche
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className="hover:bg-[#F5F7F5] transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/clients/${customer.id}`} className="flex items-center gap-3 hover:text-[#075B32]">
                      <div className="w-8 h-8 rounded-full bg-[#E8F3EC] flex items-center justify-center shrink-0">
                        <KindIcon kind={customer.kind} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-[#17231C] truncate">{customer.display_name}</p>
                        <p className="text-xs text-[#66736A]">{kindLabel[customer.kind]}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#66736A] font-mono text-xs hidden sm:table-cell">
                    {customer.customer_number}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-[#17231C]">{customer.phone ?? "—"}</p>
                    {customer.email && <p className="text-xs text-[#66736A] truncate max-w-[180px]">{customer.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#66736A] hidden lg:table-cell">{customer.city ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryBadge[customer.category].cls}`}>
                      {categoryBadge[customer.category].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/clients/${customer.id}`} className="text-[#075B32] text-xs hover:underline">
                      Voir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
