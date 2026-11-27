import { useState } from "react";
import { Calculator } from "lucide-react";

type PaperSize = "A4" | "A3" | "A5";
type ColorMode = "nb" | "color";
type Side = "recto" | "recto-verso";

const UNIT_PRICES: Record<PaperSize, Record<ColorMode, number>> = {
  A4: { nb: 25,  color: 100 },
  A3: { nb: 50,  color: 200 },
  A5: { nb: 15,  color: 60  },
};

function fmt(n: number) { return new Intl.NumberFormat("fr-CM").format(n); }

export function PrintCalculator() {
  const [size, setSize]       = useState<PaperSize>("A4");
  const [mode, setMode]       = useState<ColorMode>("nb");
  const [side, setSide]       = useState<Side>("recto");
  const [pages, setPages]     = useState(1);
  const [copies, setCopies]   = useState(1);

  const pagesPerCopy = side === "recto-verso" ? Math.ceil(pages / 2) : pages;
  const unitPrice    = UNIT_PRICES[size]![mode]!;
  const total        = unitPrice * pagesPerCopy * copies;

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#E8F3EC] flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#075B32]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#17231C]">Calculateur d'impression</h1>
          <p className="text-sm text-[#66736A]">Estimation rapide en FCFA</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8E3] p-5 space-y-5">
        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-2">Format</label>
          <div className="flex gap-2">
            {(["A4","A3","A5"] as PaperSize[]).map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  size === s ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32] font-medium" : "border-[#E2E8E3] text-[#17231C] hover:bg-[#F5F7F5]"
                }`}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-2">Mode couleur</label>
          <div className="flex gap-2">
            {([["nb","Noir & Blanc"],["color","Couleur"]] as [ColorMode,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  mode === k ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32] font-medium" : "border-[#E2E8E3] text-[#17231C] hover:bg-[#F5F7F5]"
                }`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Recto / Recto-verso */}
        <div>
          <label className="block text-sm font-medium text-[#17231C] mb-2">Impression</label>
          <div className="flex gap-2">
            {([["recto","Recto"],["recto-verso","Recto-verso"]] as [Side,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setSide(k)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                  side === k ? "border-[#075B32] bg-[#E8F3EC] text-[#075B32] font-medium" : "border-[#E2E8E3] text-[#17231C] hover:bg-[#F5F7F5]"
                }`}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Nombre de pages & exemplaires */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Nombre de pages</label>
            <input type="number" min={1} value={pages}
              onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] text-center tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#17231C] mb-1">Exemplaires</label>
            <input type="number" min={1} value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3 py-2 border border-[#E2E8E3] rounded-lg text-sm text-[#17231C] text-center tabular-nums focus:ring-2 focus:ring-[#075B32] outline-none"
            />
          </div>
        </div>

        {/* Résultat */}
        <div className="bg-[#F5F7F5] rounded-lg p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#66736A]">Prix unitaire ({size} {mode === "color" ? "couleur" : "N&B"})</span>
            <span className="font-medium text-[#17231C] tabular-nums">{fmt(unitPrice)} FCFA / feuille</span>
          </div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#66736A]">Feuilles × exemplaires</span>
            <span className="font-medium text-[#17231C] tabular-nums">{pagesPerCopy} × {copies}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-[#E2E8E3] pt-3">
            <span className="text-[#17231C]">Total estimé</span>
            <span className="text-[#075B32] tabular-nums">{fmt(total)} FCFA</span>
          </div>
        </div>

        <button className="w-full bg-[#075B32] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#063A22] transition-colors">
          Créer la commande avec ce devis
        </button>
      </div>
    </div>
  );
}
