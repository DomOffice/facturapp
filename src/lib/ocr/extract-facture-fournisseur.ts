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
  reference?: string
  designation: string
  quantite?: number
  prixUnitaireTtc?: number
  tauxTva?: number
  totalTtc?: number
  confiance: number
  alertes: string[]
}

type PointOcr = [number, number]

type LigneOcr = {
  texte?: string
  text?: string
  score?: number
  position?: PointOcr[]
}

type PageOcr = {
  lignes?: LigneOcr[]
}

type ResultatOcr = {
  pages?: PageOcr[]
}

type MotOcrNormalise = {
  texte: string
  x: number
  y: number
  score?: number
}

function parseMontant(value: string): number | undefined {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const montant = Number(normalized)
  return Number.isFinite(montant) ? montant : undefined
}

function chercher(regex: RegExp, texte: string): string | undefined {
  const match = texte.match(regex)
  return match && match[1] ? match[1].trim() : undefined
}

function normaliserTexte(value: string): string {
  return value.replace(/\r/g, '\n')
}

function extraireMotsOcr(resultatOcr?: ResultatOcr): MotOcrNormalise[] {
  const mots: MotOcrNormalise[] = []

  if (!resultatOcr || !Array.isArray(resultatOcr.pages)) {
    return mots
  }

  for (const page of resultatOcr.pages) {
    if (!page || !Array.isArray(page.lignes)) continue

    for (const ligne of page.lignes) {
      const texte = String(ligne.texte || ligne.text || '').trim()
      if (!texte) continue

      const position = ligne.position
      if (!Array.isArray(position) || position.length === 0) continue

      const xs = position.map((p) => p[0])
      const ys = position.map((p) => p[1])

      const x = Math.min.apply(null, xs)
      const y = ys.reduce((sum, val) => sum + val, 0) / ys.length

      mots.push({
        texte,
        x,
        y,
        score: ligne.score,
      })
    }
  }

  return mots.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 8) return a.y - b.y
    return a.x - b.x
  })
}

function grouperParLignes(mots: MotOcrNormalise[]): MotOcrNormalise[][] {
  const groupes: MotOcrNormalise[][] = []
  const toleranceY = 12

  for (const mot of mots) {
    let groupeTrouve: MotOcrNormalise[] | undefined

    for (const groupe of groupes) {
      const yMoyen =
        groupe.reduce((sum, item) => sum + item.y, 0) / groupe.length

      if (Math.abs(yMoyen - mot.y) <= toleranceY) {
        groupeTrouve = groupe
        break
      }
    }

    if (groupeTrouve) {
      groupeTrouve.push(mot)
    } else {
      groupes.push([mot])
    }
  }

  return groupes.map((groupe) => groupe.sort((a, b) => a.x - b.x))
}

function estMontant(value: string): boolean {
  return /^\d+(?:[.,]\d{1,2})?$/.test(value.replace(/\s/g, ''))
}

function estQuantite(value: string): boolean {
  return /^\d+(?:[.,]\d+)?$/.test(value.replace(/\s/g, ''))
}

function extraireReferenceDepuisDesignation(designation: string): {
  reference?: string
  designation: string
} {
  const texte = designation.trim()

  const match = texte.match(/^([A-Z0-9][A-Z0-9._/-]{2,})\s*[-–:]?\s+(.+)$/i)

  if (!match) {
    return { designation: texte }
  }

  return {
    reference: match[1].trim(),
    designation: match[2].trim(),
  }
}

function calculerConfianceLigne(ligne: LigneFactureExtraite): number {
  let points = 30

  if (ligne.designation && ligne.designation.length >= 5) points += 20
  if (ligne.reference) points += 10
  if (ligne.quantite !== undefined) points += 15
  if (ligne.prixUnitaireTtc !== undefined) points += 10
  if (ligne.totalTtc !== undefined) points += 15

  if (
    ligne.quantite !== undefined &&
    ligne.prixUnitaireTtc !== undefined &&
    ligne.totalTtc !== undefined
  ) {
    const attendu = ligne.quantite * ligne.prixUnitaireTtc
    const ecart = Math.abs(attendu - ligne.totalTtc)

    if (ecart <= 0.05) {
      points += 10
    } else if (ecart > 1) {
      points -= 20
    }
  }

  return Math.max(0, Math.min(100, points))
}

function extraireLignesArticles(resultatOcr?: ResultatOcr): LigneFactureExtraite[] {
  const mots = extraireMotsOcr(resultatOcr)
  const lignes: LigneFactureExtraite[] = []

  const headerDesignation = mots.find((m) =>
    /désignation|designation/i.test(m.texte),
  )

  const debutTableauY = headerDesignation ? headerDesignation.y + 25 : 0

  const totalHt = mots.find((m) => /total\s*ht/i.test(m.texte))
  const finTableauY = totalHt ? totalHt.y - 20 : Number.MAX_SAFE_INTEGER

  const elementsTableau = mots
    .filter((m) => m.y >= debutTableauY && m.y <= finTableauY)
    .sort((a, b) => {
      if (Math.abs(a.y - b.y) > 15) return a.y - b.y
      return a.x - b.x
    })

  const groupes = grouperParLignes(elementsTableau)

  let designationEnCours = ''

  for (const groupe of groupes) {
    const textesDesignation = groupe
      .filter((m) => m.x < 1000)
      .map((m) => m.texte.trim())
      .filter(Boolean)

    const texteDesignation = textesDesignation.join(' ').replace(/\s+/g, ' ').trim()

    const tva = groupe.find((m) => m.x >= 980 && m.x < 1120 && /\d+\s*%/.test(m.texte))
    const pu = groupe.find((m) => m.x >= 1120 && m.x < 1280 && /^\d[\d\s]*[,.]\d{2}$/.test(m.texte.replace(/\s/g, '')))
    const qte = groupe.find((m) => m.x >= 1280 && m.x < 1420 && /^\d+$/.test(m.texte.trim()))
    const total = groupe.find((m) => m.x >= 1420 && /^\d[\d\s]*[,.]\d{2}$/.test(m.texte.replace(/\s/g, '')))

    const commenceArticle = /^[A-Z0-9][A-Z0-9._/-]{2,}\s*[-–:]/i.test(texteDesignation)

    if (commenceArticle) {
      designationEnCours = texteDesignation
      continue
    }

    if (texteDesignation && designationEnCours) {
      designationEnCours = `${designationEnCours} ${texteDesignation}`.replace(/\s+/g, ' ').trim()
    }

    if (!designationEnCours || !tva || !pu || !qte || !total) {
      continue
    }

    const tauxTvaMatch = tva.texte.match(/(\d+)\s*%/)
    const tauxTva = tauxTvaMatch ? Number(tauxTvaMatch[1]) : undefined

    const refEtDesignation = extraireReferenceDepuisDesignation(designationEnCours)

    const ligne: LigneFactureExtraite = {
      reference: refEtDesignation.reference,
      designation: refEtDesignation.designation,
      quantite: Number(qte.texte.trim()),
      prixUnitaireTtc: parseMontant(pu.texte),
      tauxTva,
      totalTtc: parseMontant(total.texte),
      confiance: 0,
      alertes: [],
    }

    if (!ligne.reference) ligne.alertes.push('Référence non détectée')
    if (ligne.quantite === undefined) ligne.alertes.push('Quantité non détectée')
    if (ligne.prixUnitaireTtc === undefined) ligne.alertes.push('Prix unitaire non détecté')
    if (ligne.totalTtc === undefined) ligne.alertes.push('Total ligne non détecté')

    ligne.confiance = calculerConfianceLigne(ligne)

    lignes.push(ligne)
    designationEnCours = ''
  }

  return lignes
}
export function extraireFactureFournisseurDepuisOcr(
  texteOcr: string,
  resultatOcr?: ResultatOcr,
): FactureFournisseurExtraite {
  const texte = normaliserTexte(texteOcr)

  const numeroFacture =
    chercher(/(?:BL\s*\/\s*)?FACTURE\s*N[°º�]?\s*:?\s*([A-Z]{1,5}\d{4}[-/]\d{3,8})/i, texte) ||
    chercher(/(?:N[°º�]\s*:?\s*)([A-Z]{1,5}\d{4}[-/]\d{3,8})/i, texte) ||
    chercher(/\b([A-Z]{1,5}\d{4}[-/]\d{3,8})\b/i, texte)

  const dateFacture = chercher(
    /(?:date\s*(?:facturation|facture)?\s*:?\s*)(\d{2}\/\d{2}\/\d{4})/i,
    texte,
  )

  const iceMatches = Array.from(
    texte.matchAll(/ICE\s*:?\s*(\d{10,20})/gi),
  )

  const iceFournisseur =
    iceMatches.length > 0 ? iceMatches[iceMatches.length - 1][1] : undefined

  const totalHt = parseMontant(
    chercher(/total\s*ht\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || '',
  )

  const totalTva = parseMontant(
    chercher(/total\s*tva(?:\s*\d+%)?\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || '',
  )

  const totalTtc = parseMontant(
    chercher(/total\s*ttc\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || '',
  )

  const fournisseurNom = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .find((ligne) => ligne.length >= 3 && /^[A-Z0-9\s&.-]+$/.test(ligne))

  const devise = /dirham|mad|dh/i.test(texte) ? 'MAD' : undefined

  const lignes = extraireLignesArticles(resultatOcr)

  const alertes: string[] = []

  if (!numeroFacture) alertes.push('Numéro de facture non détecté')
  if (!dateFacture) alertes.push('Date de facture non détectée')
  if (!totalTtc) alertes.push('Total TTC non détecté')
  if (!totalHt) alertes.push('Total HT non détecté')
  if (!iceFournisseur) alertes.push('ICE fournisseur non détecté')
  if (lignes.length === 0) alertes.push('Aucune ligne article détectée')

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
    lignes,
    confiance: points,
    alertes,
  }
}