// src/lib/utils/currency.ts

/**
 * Formatte un montant en MAD
 * Ex: 1234.56 → "1 234,56"
 */
export function formatMontant(montant: number, decimales = 2): string {
  return new Intl.NumberFormat('fr-MA', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(montant)
}

/**
 * Formatte un montant avec devise
 * Ex: 1234.56 → "1 234,56 MAD"
 */
export function formatMontantDevise(montant: number, devise = 'MAD'): string {
  return `${formatMontant(montant)} ${devise}`
}

/**
 * Arrondi à 2 décimales
 */
export function arrondi2(valeur: number): number {
  return Math.round(valeur * 100) / 100
}

/**
 * Calculs facture ligne
 */
export function calculerLigne(
  quantite: number,
  prixUnitaireHt: number,
  remisePourcentage: number,
  tauxTva: number
) {
  const brutHt = arrondi2(quantite * prixUnitaireHt)
  const montantRemiseHt = arrondi2(brutHt * (remisePourcentage / 100))
  const montantHt = arrondi2(brutHt - montantRemiseHt)
  const montantTva = arrondi2(montantHt * (tauxTva / 100))
  const montantTtc = arrondi2(montantHt + montantTva)

  return { brutHt, montantRemiseHt, montantHt, montantTva, montantTtc }
}

/**
 * Calcule les totaux d'une facture à partir de ses lignes
 */
export function calculerTotauxFacture(lignes: Array<{
  quantite: number
  prixAchatHt: number
  montantHt: number
  montantTva: number
  montantTtc: number
}>) {
  const totalLignes = lignes.length
  const totalArticles = arrondi2(lignes.reduce((s, l) => s + l.quantite, 0))
  const totalHt = arrondi2(lignes.reduce((s, l) => s + l.montantHt, 0))
  const totalTva = arrondi2(lignes.reduce((s, l) => s + l.montantTva, 0))
  const totalTtc = arrondi2(lignes.reduce((s, l) => s + l.montantTtc, 0))
  const totalAchatHt = arrondi2(lignes.reduce((s, l) => s + l.prixAchatHt * l.quantite, 0))
  const margeHt = arrondi2(totalHt - totalAchatHt)

  return { totalLignes, totalArticles, totalHt, totalTva, totalTtc, totalAchatHt, margeHt }
}
