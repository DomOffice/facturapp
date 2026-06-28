export type FactureFournisseurExtraite = {
  fournisseurNom?: string
  numeroFacture?: string
  dateFacture?: string
  iceFournisseur?: string
  totalHt?: number
  totalTva?: number
  totalTtc?: number
  devise?: string
  lignes: LigneFactureExtraite[]
  confiance: number
  alertes: string[]
}

export type LigneFactureExtraite = {
  designation: string
  quantite?: number
  prixUnitaireTtc?: number
  tauxTva?: number
  totalTtc?: number
}

function parseMontant(value: string): number | undefined {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const montant = Number(normalized)
  return Number.isFinite(montant) ? montant : undefined
}

function chercher(regex: RegExp, texte: string): string | undefined {
  const match = texte.match(regex)
  return match?.[1]?.trim()
}

export function extraireFactureFournisseurDepuisOcr(
  texteOcr: string
): FactureFournisseurExtraite {
  const texte = texteOcr.replace(/\r/g, '\n')

  const numeroFacture =
  chercher(/(?:BL\s*\/\s*)?FACTURE\s*N[°º�]?\s*:?\s*([A-Z]{1,5}\d{4}[-/]\d{3,8})/i, texte) ||
  chercher(/(?:N[°º�]\s*:?\s*)([A-Z]{1,5}\d{4}[-/]\d{3,8})/i, texte) ||
  chercher(/\b([A-Z]{1,5}\d{4}[-/]\d{3,8})\b/i, texte)

  const dateFacture = chercher(
    /(?:date\s*(?:facturation|facture)?\s*:?\s*)(\d{2}\/\d{2}\/\d{4})/i,
    texte
  )

  const iceMatches = [...texte.matchAll(/ICE\s*:?\s*(\d{10,20})/gi)]
  const iceFournisseur = iceMatches.at(-1)?.[1]

  const totalHt = parseMontant(
    chercher(/total\s*ht\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || ''
  )

  const totalTva = parseMontant(
    chercher(/total\s*tva(?:\s*\d+%)?\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || ''
  )

  const totalTtc = parseMontant(
    chercher(/total\s*ttc\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || ''
  )

  const fournisseurNom = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .find((ligne) => ligne.length >= 3 && /^[A-Z0-9\s&.-]+$/.test(ligne))

  const devise = /dirham|mad|dh/i.test(texte) ? 'MAD' : undefined

  const alertes: string[] = []

  if (!numeroFacture) alertes.push('Numéro de facture non détecté')
  if (!dateFacture) alertes.push('Date de facture non détectée')
  if (!totalTtc) alertes.push('Total TTC non détecté')
  if (!totalHt) alertes.push('Total HT non détecté')
  if (!iceFournisseur) alertes.push('ICE fournisseur non détecté')

  let points = 0
  if (numeroFacture) points += 20
  if (dateFacture) points += 20
  if (totalHt) points += 15
  if (totalTva) points += 15
  if (totalTtc) points += 20
  if (iceFournisseur) points += 10

  return {
    fournisseurNom,
    numeroFacture,
    dateFacture,
    iceFournisseur,
    totalHt,
    totalTva,
    totalTtc,
    devise,
    lignes: [],
    confiance: points,
    alertes,
  }
}