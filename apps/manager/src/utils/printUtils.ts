/** Ouvre une fenêtre d'impression avec du HTML généré côté frontend. */
export function printWindow(html: string, title: string, paper: "80mm" | "A4" = "A4") {
  const win = window.open("", "_blank", "width=500,height=700");
  if (!win) { alert("Autoriser les popups pour imprimer."); return; }
  const pageStyle =
    paper === "80mm"
      ? `@page { size: 80mm auto; margin: 4mm; } body { width: 72mm; }`
      : `@page { size: A4 portrait; margin: 15mm; } body { width: 180mm; }`;
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${title}</title><style>
${pageStyle}
* { box-sizing: border-box; }
body { font-family: 'Courier New', monospace; font-size: ${paper === "80mm" ? "10px" : "11px"}; margin: 0; color: #000; }
h1 { font-size: ${paper === "80mm" ? "13px" : "16px"}; margin: 0 0 4px; }
h2 { font-size: ${paper === "80mm" ? "11px" : "13px"}; margin: 8px 0 4px; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 2px 4px; text-align: left; }
th { border-bottom: 1px solid #000; font-weight: bold; }
.right { text-align: right; }
.center { text-align: center; }
.sep { border-top: 1px dashed #000; margin: 6px 0; }
.bold { font-weight: bold; }
.small { font-size: 8px; }
</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export function formatXAF(n: number) {
  return new Intl.NumberFormat("fr-CM").format(n) + " FCFA";
}

export function now() {
  return new Date().toLocaleString("fr-CM", { dateStyle: "short", timeStyle: "short" });
}

/** Génère le HTML d'un ticket thermique 80mm */
export function buildTicketHTML(params: {
  ticketNo: string;
  items: { name: string; qty: number; prixUnit: number }[];
  total: number;
  remise: number;
  modeReglement: string;
  montantRecu: number;
  client?: string;
}) {
  const { ticketNo, items, total, remise, modeReglement, montantRecu, client } = params;
  const totalNet = total - remise;
  const monnaie = modeReglement === "Espèces" ? Math.max(0, montantRecu - totalNet) : 0;
  const rows = items.map(i =>
    `<tr><td>${i.name}</td><td class="right">${i.qty}</td><td class="right">${new Intl.NumberFormat("fr-CM").format(i.prixUnit * i.qty)}</td></tr>`
  ).join("");
  return `
<div class="center"><strong>BS4U Manager</strong><br>
Centre de services numériques<br>
Yaoundé — Cameroun<br>
<span class="small">Tél : +237 6XX XXX XXX</span></div>
<div class="sep"></div>
<div>Ticket : <strong>${ticketNo}</strong></div>
<div>Date : ${now()}</div>
${client ? `<div>Client : ${client}</div>` : ""}
<div class="sep"></div>
<table><thead><tr><th>Article</th><th class="right">Qté</th><th class="right">Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="sep"></div>
${remise > 0 ? `<div style="display:flex;justify-content:space-between"><span>Sous-total</span><span>${new Intl.NumberFormat("fr-CM").format(total)} FCFA</span></div>
<div style="display:flex;justify-content:space-between"><span>Remise</span><span>-${new Intl.NumberFormat("fr-CM").format(remise)} FCFA</span></div>` : ""}
<div style="display:flex;justify-content:space-between" class="bold"><span>TOTAL</span><span>${new Intl.NumberFormat("fr-CM").format(totalNet)} FCFA</span></div>
<div style="display:flex;justify-content:space-between"><span>Règlement</span><span>${modeReglement}</span></div>
${modeReglement === "Espèces" ? `<div style="display:flex;justify-content:space-between"><span>Reçu</span><span>${new Intl.NumberFormat("fr-CM").format(montantRecu)} FCFA</span></div>
<div style="display:flex;justify-content:space-between" class="bold"><span>Monnaie rendue</span><span>${new Intl.NumberFormat("fr-CM").format(monnaie)} FCFA</span></div>` : ""}
<div class="sep"></div>
<div class="center small">Merci pour votre visite !<br>Conservez ce ticket</div>`;
}

/** HTML d'une liste de stocks A4 */
export function buildStockA4(items: { sku: string; name: string; category: string; qty: number; unit: string; min_qty: number; unit_price_xaf: number }[]) {
  const rows = items.map(i => {
    const alert = i.qty <= i.min_qty;
    return `<tr style="${alert ? "background:#fff7ed" : ""}">
      <td>${i.sku}</td><td>${i.name}</td><td>${i.category}</td>
      <td class="right">${i.qty} ${i.unit}</td>
      <td class="right">${i.min_qty}</td>
      <td class="right">${new Intl.NumberFormat("fr-CM").format(i.unit_price_xaf)}</td>
      <td class="center">${alert ? "⚠️" : "✓"}</td>
    </tr>`;
  }).join("");
  return `<h1>État du stock — BS4U Manager</h1>
<div>Imprimé le ${now()} · ${items.length} références</div>
<div class="sep"></div>
<table><thead><tr>
<th>SKU</th><th>Article</th><th>Catégorie</th><th class="right">Qté</th><th class="right">Min</th><th class="right">P.U. FCFA</th><th class="center">État</th>
</tr></thead><tbody>${rows}</tbody></table>`;
}

/** HTML feuille d'étiquettes A4 (3 colonnes) */
export function buildLabelsA4(produits: { ref: string; nom: string; prixVente: number; prixMembre: number }[]) {
  function barcodeSVG(code: string) {
    const bars: number[] = [];
    for (let i = 0; i < code.length; i++) {
      const c = code.charCodeAt(i);
      bars.push(1 + (c & 1)); bars.push(1 + ((c >> 2) & 1));
      bars.push(1 + ((c >> 4) & 1)); bars.push(1 + ((c >> 6) & 1));
    }
    const all = [2, ...bars, 2];
    let x = 0;
    const rects = all.map((w, i) => {
      const r = i % 2 === 0 ? `<rect x="${x.toFixed(1)}" y="0" width="${(w * 1.4).toFixed(1)}" height="36" fill="black"/>` : "";
      x += w * 1.4;
      return r;
    }).join("");
    const totalW = x.toFixed(1);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="36" style="display:block;margin:2px auto">${rects}</svg>`;
  }
  const labels = produits.map(p => `
    <div style="border:1px solid #ccc;border-radius:4px;padding:8px 6px;text-align:center;page-break-inside:avoid;overflow:hidden">
      <div style="font-size:9px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${p.nom}</div>
      ${barcodeSVG(p.ref)}
      <div style="font-family:monospace;font-size:7px;letter-spacing:.08em;margin:2px 0">${p.ref}</div>
      <div style="font-size:8px;color:#333">${new Intl.NumberFormat("fr-CM").format(p.prixVente)} FCFA</div>
    </div>`).join("");
  return `<h2 style="font-size:13px;margin:0 0 8px">Étiquettes produits — BS4U Manager</h2>
<div style="font-size:8px;color:#666;margin-bottom:8px">Imprimé le ${now()} · ${produits.length} étiquette(s)</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${labels}</div>`;
}

/** HTML catalogue produits A4 */
export function buildCatalogueA4(produits: { ref: string; nom: string; categorie: string; prixVente: number; prixMembre: number; stock: number; unite: string }[]) {
  const rows = produits.map(p => `<tr>
    <td>${p.ref}</td><td>${p.nom}</td><td>${p.categorie}</td>
    <td class="right">${new Intl.NumberFormat("fr-CM").format(p.prixVente)}</td>
    <td class="right">${new Intl.NumberFormat("fr-CM").format(p.prixMembre)}</td>
    <td class="right">${p.stock} ${p.unite}</td>
  </tr>`).join("");
  return `<h1>Catalogue produits — BS4U Manager</h1>
<div>Édité le ${now()} · ${produits.length} références</div>
<div class="sep"></div>
<table><thead><tr>
<th>Réf.</th><th>Produit</th><th>Catégorie</th><th class="right">Prix vente</th><th class="right">Prix membre</th><th class="right">Stock</th>
</tr></thead><tbody>${rows}</tbody></table>`;
}
