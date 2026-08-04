export function formatMontant(valeur: number | null | undefined): string {
  if (valeur == null || Number.isNaN(valeur)) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valeur);
}