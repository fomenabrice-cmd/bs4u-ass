/** Toutes les opérations monétaires en bigint XAF — jamais de float */

/** Formate un entier XAF en chaîne lisible : 1 500 FCFA */
export function formatXaf(xaf: bigint | number): string {
  const n = typeof xaf === "bigint" ? Number(xaf) : xaf;
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Convertit une saisie utilisateur (string) en bigint XAF — retourne null si invalide */
export function parseXaf(input: string): bigint | null {
  const cleaned = input.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return BigInt(Math.round(n));
}

/** Addition sûre de bigints (accepte number pour la commodité) */
export function addXaf(a: bigint | number, b: bigint | number): bigint {
  return BigInt(a) + BigInt(b);
}

/** Soustraction sûre — retourne 0 si le résultat serait négatif */
export function subXaf(a: bigint | number, b: bigint | number): bigint {
  const r = BigInt(a) - BigInt(b);
  return r < 0n ? 0n : r;
}

/** Pourcentage entier sur bigint : (xaf * pct) / 100, arrondi à l'entier */
export function pctXaf(xaf: bigint | number, pct: number): bigint {
  return BigInt(Math.round(Number(BigInt(xaf)) * pct / 100));
}
