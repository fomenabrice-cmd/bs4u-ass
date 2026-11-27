/** Utilitaires de formatage de dates pour le Cameroun (fr-CM) */

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CM", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CM", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Retourne la période comptable sous forme "T1 2026" */
export function formatPeriod(year: number, quarter?: number | null): string {
  if (!quarter) return String(year);
  return `T${quarter} ${year}`;
}

/** ISO date string du jour courant : "2026-11-21" */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
