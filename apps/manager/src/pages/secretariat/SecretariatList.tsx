import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText, Download, Edit } from "lucide-react";
import { supabase } from "../../lib/supabase";

type DocType = "letter" | "certificate" | "contract" | "report" | "other";
interface Doc { id: string; title: string; doc_type: DocType; customer_name?: string; created_at: string; size_pages: number }

const TYPE_CFG: Record<DocType, { label: string; cls: string }> = {
  letter:      { label: "Lettre",       cls: "bg-blue-50 text-[#175CD3]" },
  certificate: { label: "Attestation",  cls: "bg-[#E8F3EC] text-[#067647]" },
  contract:    { label: "Contrat",      cls: "bg-purple-50 text-purple-700" },
  report:      { label: "Rapport",      cls: "bg-orange-50 text-[#B54708]" },
  other:       { label: "Autre",        cls: "bg-[#F5F7F5] text-[#66736A]" },
};

export function SecretariatList() {
  const [docs, setDocs] = useState<Doc[]>([]);

  useEffect(() => {
    supabase
      .from("documents")
      .select("id, title, type, pages, created_at, client:client_id(full_name, company_name, is_company)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const validTypes = new Set(["letter","certificate","contract","report","other"]);
        setDocs(data.map((d: any) => ({
          id: d.id,
          title: d.title ?? "—",
          doc_type: validTypes.has(d.type) ? d.type as DocType : "other",
          customer_name: d.client
            ? (d.client.is_company ? d.client.company_name : d.client.full_name) ?? undefined
            : undefined,
          created_at: d.created_at?.split("T")[0] ?? "—",
          size_pages: Number(d.pages) || 1,
        })));
      });
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Secrétariat</h1>
          <p className="text-sm text-[#66736A] mt-0.5">{docs.length} document{docs.length !== 1 ? "s" : ""}</p>
        </div>
        <Link to="/secretariat/nouveau" className="flex items-center gap-2 bg-[#075B32] text-white text-sm px-3 py-2 rounded-lg hover:bg-[#063A22]">
          <Plus className="w-4 h-4" />
          Nouveau document
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F7F5] border-b border-[#E2E8E3]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Document</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden md:table-cell">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#66736A] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8E3]">
            {docs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[#66736A]">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-[#E2E8E3]" />
                  <p>Aucun document enregistré</p>
                </td>
              </tr>
            ) : docs.map((doc) => (
              <tr key={doc.id} className="hover:bg-[#F5F7F5] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F3EC] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#075B32]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#17231C] text-sm truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CFG[doc.doc_type].cls}`}>{TYPE_CFG[doc.doc_type].label}</span>
                        <span className="text-xs text-[#66736A]">{doc.size_pages} p.</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#66736A] hidden md:table-cell">{doc.customer_name ?? "—"}</td>
                <td className="px-4 py-3 text-sm text-[#66736A] hidden sm:table-cell">{doc.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/secretariat/${doc.id}`} className="p-1.5 hover:bg-[#E8F3EC] rounded text-[#075B32]" title="Modifier">
                      <Edit className="w-3.5 h-3.5" />
                    </Link>
                    <button className="p-1.5 hover:bg-[#E8F3EC] rounded text-[#075B32]" title="Télécharger">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
