import { X, Printer } from "lucide-react";
import { motion } from "framer-motion";
import { printWindow } from "../../utils/printUtils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  html: string;
  title: string;
  paper: "80mm" | "A4";
  onClose: () => void;
};

/** Modal de prévisualisation avant impression — partagé par toute l'application. */
export function PrintPreviewModal({ html, title, paper, onClose }: Props) {
  const is80 = paper === "80mm";
  const pageStyle = is80
    ? `@page { size: 80mm auto; margin: 4mm; } body { width: 72mm; }`
    : `@page { size: A4 portrait; margin: 15mm; } body { width: 180mm; }`;
  const fontSize = is80 ? "10px" : "11px";

  const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${title}</title><style>
${pageStyle}
* { box-sizing: border-box; }
body { font-family: 'Courier New', monospace; font-size: ${fontSize}; margin: 0; padding: 8px; color: #000; background: white; }
h1 { font-size: ${is80 ? "13px" : "16px"}; margin: 0 0 4px; }
h2 { font-size: ${is80 ? "11px" : "13px"}; margin: 8px 0 4px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 2px 4px; text-align: left; }
th { border-bottom: 1px solid #000; font-weight: bold; }
.right { text-align: right; }
.center { text-align: center; }
.sep { border-top: 1px dashed #000; margin: 6px 0; }
.bold { font-weight: bold; }
.small { font-size: 8px; }
</style></head><body>${html}</body></html>`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease }}
        className="bg-white rounded-3xl shadow-2xl text-[#17231C] flex flex-col overflow-hidden"
        style={{ width: is80 ? 360 : 760, maxHeight: "92vh" }}>

        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8E3] shrink-0">
          <div>
            <h3 className="font-bold text-[#17231C] text-lg">Prévisualisation impression</h3>
            <p className="text-xs text-[#66736A] mt-0.5">{title} · Format {paper}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#F5F7F5] transition-colors">
            <X size={20} className="text-[#A0ADA5]" />
          </button>
        </div>

        {/* Zone preview */}
        <div className="flex-1 overflow-auto bg-[#F0F2F0] p-4 flex justify-center">
          <div className="bg-white shadow-md" style={{ width: is80 ? 302 : "100%", minHeight: 300 }}>
            <iframe
              srcDoc={fullHtml}
              title={title}
              style={{ width: "100%", height: is80 ? 480 : 520, border: "none", display: "block" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#E2E8E3] shrink-0">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-[#E2E8E3] text-sm text-[#66736A] hover:bg-[#F5F7F5] transition-colors">
            Annuler
          </button>
          <button
            onClick={() => { printWindow(html, title, paper); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-[#075B32] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#063A22] transition-colors">
            <Printer size={15} /> Lancer l'impression
          </button>
        </div>
      </motion.div>
    </div>
  );
}
