import { FileText, Download, Eye } from "lucide-react";

const documents = [
  { id: 1, title: "Attestation de membre",   date: "15 oct. 2026",  type: "Attestation", size: "142 Ko" },
  { id: 2, title: "Certificat de formation", date: "02 sept. 2026", type: "Certificat",  size: "218 Ko" },
  { id: 3, title: "Reçu cotisation 2026",    date: "10 janv. 2026", type: "Reçu",        size: "85 Ko"  },
  { id: 4, title: "Carte de membre 2026",    date: "10 janv. 2026", type: "Carte",       size: "340 Ko" },
];

const typeColors: Record<string, string> = {
  Attestation: "bg-blue-50 text-blue-700",
  Certificat:  "bg-purple-50 text-purple-700",
  Reçu:        "bg-emerald-50 text-emerald-700",
  Carte:       "bg-amber-50 text-amber-700",
};

export function MemberDocuments() {
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-[#063A22] px-6 py-8 text-white">
        <p className="text-xs text-emerald-300 uppercase tracking-wide mb-1">Documents</p>
        <h1 className="text-xl font-bold">Mes documents officiels</h1>
        <p className="text-emerald-200 text-sm mt-1">{documents.length} document(s)</p>
      </div>

      <div className="px-4 mt-6 space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${typeColors[doc.type] ?? "bg-slate-100 text-slate-600"}`}>
                    {doc.type}
                  </span>
                  <span className="text-xs text-slate-500">{doc.date}</span>
                  <span className="text-xs text-slate-400">{doc.size}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button className="p-2 text-slate-400 hover:text-[#075B32] rounded-lg hover:bg-emerald-50 transition-colors" aria-label="Voir">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-[#075B32] rounded-lg hover:bg-emerald-50 transition-colors" aria-label="Télécharger">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 mt-6">
        <div className="bg-[#E8F5EE] border border-emerald-200 rounded-xl p-4">
          <p className="text-sm font-medium text-[#075B32]">Besoin d'un autre document ?</p>
          <p className="text-xs text-emerald-700 mt-1">Contactez le secrétariat BS4U au +237 6 00 00 00 00 ou par WhatsApp.</p>
        </div>
      </div>
    </div>
  );
}
