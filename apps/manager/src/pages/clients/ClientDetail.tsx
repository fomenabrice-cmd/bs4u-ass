import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, MapPin, Building2, User,
  Plus, FileText, ShoppingCart, Receipt, FolderOpen,
  Loader2, ChevronRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Contact = {
  id: string; display_name: string;
  is_company: boolean; type: string;
  phone: string | null; email: string | null;
  address: string | null; city: string | null;
  notes: string | null; created_at: string;
};

type Quote = {
  id: string; reference: string; status: string;
  subtotal: number; notes: string | null; created_at: string;
};

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Brouillon", cls: "bg-gray-100 text-gray-600" },
  sent:     { label: "Envoyé",   cls: "bg-blue-50 text-blue-700" },
  accepted: { label: "Accepté",  cls: "bg-[#E8F3EC] text-[#067647]" },
  rejected: { label: "Refusé",   cls: "bg-red-50 text-red-700" },
  expired:  { label: "Expiré",   cls: "bg-orange-50 text-orange-700" },
};

const TABS = ["Résumé", "Devis", "Commandes", "Factures", "Documents"] as const;
type Tab = typeof TABS[number];

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]           = useState<Tab>("Résumé");
  const [contact, setContact]   = useState<Contact | null>(null);
  const [quotes, setQuotes]     = useState<Quote[]>([]);
  const [loading, setLoading]   = useState(true);
  const [qLoading, setQLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("contacts")
      .select("id, type, is_company, full_name, company_name, phone, email, address, city, notes, created_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContact({
          id: data.id,
          display_name: data.is_company
            ? (data.company_name ?? data.full_name ?? "—")
            : (data.full_name ?? "—"),
          is_company: Boolean(data.is_company),
          type: data.type ?? "client",
          phone: data.phone ?? null,
          email: data.email ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          notes: data.notes ?? null,
          created_at: (data.created_at as string)?.split("T")[0] ?? "",
        });
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (tab !== "Devis" || !id) return;
    setQLoading(true);
    supabase
      .from("quotes")
      .select("id, reference, status, subtotal, notes, created_at")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setQuotes((data ?? []).map((q: any) => ({
          id: q.id,
          reference: q.reference,
          status: q.status,
          subtotal: Number(q.subtotal),
          notes: q.notes ?? null,
          created_at: (q.created_at as string)?.split("T")[0] ?? "",
        })));
        setQLoading(false);
      });
  }, [tab, id]);

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-[#075B32]" />
    </div>
  );
  if (!contact) return (
    <div className="p-6 text-center text-[#66736A]">Client introuvable.</div>
  );

  const locationStr = [contact.address, contact.city].filter(Boolean).join(", ") || "—";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <Link to="/clients" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] w-fit">
        <ArrowLeft className="w-4 h-4" /> Clients
      </Link>

      {/* Fiche en-tête */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F3EC] flex items-center justify-center shrink-0">
              {contact.is_company
                ? <Building2 className="w-7 h-7 text-[#075B32]" />
                : <User       className="w-7 h-7 text-[#075B32]" />}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#17231C]">{contact.display_name}</h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                {contact.is_company ? "Entreprise" : "Particulier"} · depuis {contact.created_at}
              </p>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="flex gap-2 shrink-0">
            <Link
              to="/devis/nouveau"
              className="flex items-center gap-1.5 text-sm border border-[#075B32] text-[#075B32] px-3 py-2 rounded-lg hover:bg-[#E8F3EC] transition-colors"
            >
              <Plus className="w-4 h-4" /> Devis
            </Link>
            <Link
              to="/commandes/nouvelle"
              className="flex items-center gap-1.5 text-sm bg-[#075B32] text-white px-3 py-2 rounded-lg hover:bg-[#063A22] transition-colors"
            >
              <Plus className="w-4 h-4" /> Commande
            </Link>
          </div>
        </div>

        {/* Coordonnées */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#E2E8E3]">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-[#66736A] shrink-0" />
            <span className="text-[#17231C]">{contact.phone ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <Mail className="w-4 h-4 text-[#66736A] shrink-0" />
            <span className="text-[#17231C] truncate">{contact.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-[#66736A] shrink-0" />
            <span className="text-[#17231C]">{locationStr}</span>
          </div>
        </div>

        {contact.notes && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-[#7A5A0E]">
            <span className="font-medium">Notes : </span>{contact.notes}
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#E2E8E3]" role="tablist">
          {TABS.map(t => (
            <button
              key={t} role="tab" aria-selected={t === tab}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                t === tab
                  ? "border-[#075B32] text-[#075B32]"
                  : "border-transparent text-[#66736A] hover:text-[#17231C]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Résumé ── */}
          {tab === "Résumé" && (
            <div className="space-y-5">
              {/* Raccourcis par section */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { label: "Devis",      icon: FileText,     tab: "Devis"      as Tab },
                  { label: "Commandes",  icon: ShoppingCart, tab: "Commandes"  as Tab },
                  { label: "Factures",   icon: Receipt,      tab: "Factures"   as Tab },
                  { label: "Documents",  icon: FolderOpen,   tab: "Documents"  as Tab },
                ] as const).map(({ label, icon: Icon, tab: dest }) => (
                  <button
                    key={label} onClick={() => setTab(dest)}
                    className="flex flex-col items-center gap-1.5 p-4 bg-[#F5F7F5] rounded-xl hover:bg-[#E8F3EC] transition-colors group"
                  >
                    <Icon className="w-6 h-6 text-[#075B32]" />
                    <span className="text-sm font-medium text-[#17231C] group-hover:text-[#075B32]">{label}</span>
                  </button>
                ))}
              </div>

              {/* Créer */}
              <div>
                <p className="text-xs font-semibold text-[#66736A] uppercase tracking-wider mb-2">Créer</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Nouveau devis",     to: "/devis/nouveau" },
                    { label: "Nouvelle commande", to: "/commandes/nouvelle" },
                    { label: "Nouvelle facture",  to: "/finance/factures" },
                  ].map(a => (
                    <Link key={a.label} to={a.to}
                      className="flex items-center gap-1.5 text-sm text-[#075B32] border border-[#075B32] rounded-lg px-3 py-1.5 hover:bg-[#E8F3EC] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> {a.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Devis ── */}
          {tab === "Devis" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#17231C]">Devis</h2>
                <Link to="/devis/nouveau" className="flex items-center gap-1 text-sm text-[#075B32] hover:underline">
                  <Plus className="w-4 h-4" /> Nouveau
                </Link>
              </div>
              {qLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#075B32]" />
                </div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-10 text-[#66736A]">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun devis pour ce client</p>
                  <Link to="/devis/nouveau" className="text-[#075B32] text-sm hover:underline mt-1 inline-block">
                    Créer le premier devis
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8E3]">
                  {quotes.map(q => {
                    const badge = QUOTE_STATUS[q.status] ?? { label: q.status, cls: "bg-gray-100 text-gray-600" };
                    return (
                      <div key={q.id} className="flex items-center justify-between py-3 -mx-5 px-5 hover:bg-[#F9FBF9] transition-colors cursor-pointer">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-4 h-4 text-[#66736A] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#17231C]">{q.reference}</p>
                            <p className="text-xs text-[#66736A] truncate">{q.notes || "—"} · {q.created_at}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                          <span className="text-sm font-semibold text-[#17231C]">{q.subtotal.toLocaleString("fr-CM")} FCFA</span>
                          <ChevronRight className="w-4 h-4 text-[#A0ADA5]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Commandes / Factures / Documents ── */}
          {(tab === "Commandes" || tab === "Factures" || tab === "Documents") && (
            <div className="text-center py-12 text-[#66736A]">
              {tab === "Commandes"  && <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />}
              {tab === "Factures"   && <Receipt      className="w-10 h-10 mx-auto mb-3 opacity-20" />}
              {tab === "Documents"  && <FolderOpen   className="w-10 h-10 mx-auto mb-3 opacity-20" />}
              <p className="text-sm">Section {tab} — disponible prochainement</p>
              {tab === "Commandes" && (
                <Link to="/commandes/nouvelle" className="text-[#075B32] text-sm hover:underline mt-1 inline-block">
                  Créer une commande
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
