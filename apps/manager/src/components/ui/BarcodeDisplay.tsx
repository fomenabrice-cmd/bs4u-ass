/** Composant code-barre visuel déterministe (non scannable — usage démo/impression).
 *  Pour la production, remplacer par JsBarcode ou react-barcode. */
export function BarcodeDisplay({ code, height = 44, showText = true }: {
  code: string; height?: number; showText?: boolean;
}) {
  // Génère une séquence de largeurs de barres à partir du code (alternance noir/blanc)
  const bars: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i);
    bars.push(1 + (c & 1));
    bars.push(1 + ((c >> 2) & 1));
    bars.push(1 + ((c >> 4) & 1));
    bars.push(1 + ((c >> 6) & 1));
  }
  // Toujours commencer et finir par une barre noire (guard)
  const allBars = [2, ...bars, 2];

  return (
    <div style={{ display: "inline-block", lineHeight: 0, background: "white" }}>
      <div style={{ display: "flex", gap: 0, height, alignItems: "stretch" }}>
        {allBars.map((w, i) => (
          <div key={i} style={{
            width: w * 1.4,
            background: i % 2 === 0 ? "#000" : "transparent",
            flexShrink: 0,
          }} />
        ))}
      </div>
      {showText && (
        <div style={{ fontFamily: "monospace", fontSize: 9, textAlign: "center", color: "#000", letterSpacing: "0.08em", marginTop: 2 }}>
          {code}
        </div>
      )}
    </div>
  );
}
