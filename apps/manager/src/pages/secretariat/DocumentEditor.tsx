import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Download, FileText } from "lucide-react";
import { useState } from "react";

export function DocumentEditor() {
  const { id } = useParams();
  const [content, setContent] = useState(
    id
      ? "Chargement du document en cours…\n\n(En production : TipTap editor avec templates)"
      : "# Nouveau document\n\nCommencez à rédiger votre document ici.\n\n*Note : L'éditeur TipTap complet sera intégré en LOT 05.*"
  );
  const [title, setTitle] = useState(id ? "Lettre de recommandation – M. Nguema" : "Nouveau document");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between mb-4">
        <Link to="/secretariat" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32]">
          <ArrowLeft className="w-4 h-4" />
          Secrétariat
        </Link>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${
              saved ? "bg-[#E8F3EC] text-[#067647]" : "border border-[#E2E8E3] text-[#17231C] hover:bg-[#F5F7F5]"
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? "Enregistré !" : "Enregistrer"}
          </button>
          <button className="flex items-center gap-2 text-sm border border-[#E2E8E3] rounded-lg px-3 py-2 text-[#17231C] hover:bg-[#F5F7F5]">
            <Download className="w-4 h-4" />
            Télécharger PDF
          </button>
        </div>
      </div>

      {/* Titre */}
      <input
        type="text" value={title} onChange={(e) => setTitle(e.target.value)}
        className="text-lg font-semibold text-[#17231C] border-0 border-b border-[#E2E8E3] pb-2 mb-4 focus:outline-none focus:border-[#075B32] bg-transparent"
        placeholder="Titre du document"
      />

      {/* Zone d'édition (placeholder TipTap) */}
      <div className="flex-1 bg-white rounded-xl border border-[#E2E8E3] overflow-hidden flex flex-col">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-[#E2E8E3] bg-[#F5F7F5] flex-wrap">
          {["G","I","S","U","Titre 1","Titre 2","• Liste","1. Liste","Lien","Image"].map((tool) => (
            <button key={tool} className="px-2 py-1 text-xs text-[#17231C] hover:bg-white rounded border border-transparent hover:border-[#E2E8E3] transition-colors">
              {tool}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1 text-xs text-[#66736A]">
            <FileText className="w-3.5 h-3.5" />
            TipTap (LOT 05)
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 p-5 text-sm text-[#17231C] leading-relaxed resize-none focus:outline-none font-mono"
          placeholder="Rédigez votre document…"
        />
      </div>
    </div>
  );
}
