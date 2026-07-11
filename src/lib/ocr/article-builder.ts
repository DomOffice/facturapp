import type {
  LigneFactureExtraite,
  MotOcrNormalise,
  ProfilOcrFournisseur,
} from './types'

type DonneesArticleDetectees = {
  designationBrute: string
  tva?: MotOcrNormalise
  pu?: MotOcrNormalise
  qte?: MotOcrNormalise
  total?: MotOcrNormalise
}

function parseMontant(value: string): number | undefined {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const montant = Number(normalized)
  return Number.isFinite(montant) ? montant : undefined
}

function extraireReferenceDepuisDesignation(designation: string): {
  reference?: string
  designation: string
} {
  const texte = designation.trim()
  const match = texte.match(/^([A-Z0-9][A-Z0-9._/-]{2,})\s*[-–:]?\s+(.+)$/i)

  if (!match) return { designation: texte }

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
  if (ligne.tauxTva !== undefined) points += 5

  if (
    ligne.quantite !== undefined &&
    ligne.prixUnitaireTtc !== undefined &&
    ligne.totalTtc !== undefined
  ) {
    const attendu = ligne.quantite * ligne.prixUnitaireTtc
    const ecart = Math.abs(attendu - ligne.totalTtc)

    if (ecart <= 0.05) points += 10
    else if (ecart > 1) points -= 20
  }

  return Math.max(0, Math.min(100, points))
}

function estMontant(texte: string): boolean {
  return /^\d[\d\s]*[,.]\d{2}$/.test(texte.replace(/\s/g, ''))
}

function detecterDonneesArticle(
  groupes: MotOcrNormalise[][],
  profil: ProfilOcrFournisseur,
): DonneesArticleDetectees {
  const colonnes = profil.colonnes
  const tousLesMots = groupes.flat()

  const textesDesignation = tousLesMots
    .filter(
      (m) =>
        m.x >= colonnes.designation.xMin &&
        m.x < colonnes.designation.xMax,
    )
    .map((m) => m.texte.trim())
    .filter(Boolean)

  const tva = tousLesMots.find(
    (m) =>
      m.x >= colonnes.tva.xMin &&
      m.x < colonnes.tva.xMax &&
      /\b(20|10|7)\s*%/.test(m.texte),
  )

  const pu = tousLesMots.find(
    (m) =>
      m.x >= colonnes.puTtc.xMin &&
      m.x < colonnes.puTtc.xMax &&
      estMontant(m.texte),
  )

  const qte = tousLesMots.find(
    (m) =>
      m.x >= colonnes.quantite.xMin &&
      m.x < colonnes.quantite.xMax &&
      /^\d+$/.test(m.texte.trim()),
  )

  const total = tousLesMots.find(
    (m) =>
      m.x >= colonnes.totalTtc.xMin &&
      m.x < colonnes.totalTtc.xMax &&
      estMontant(m.texte),
  )

  return {
    designationBrute: textesDesignation.join(' ').replace(/\s+/g, ' ').trim(),
    tva,
    pu,
    qte,
    total,
  }
}

export function construireLigneArticleDepuisGroupes(
  groupes: MotOcrNormalise[][],
  profil: ProfilOcrFournisseur,
): LigneFactureExtraite | null {
  const donnees = detecterDonneesArticle(groupes, profil)

  if (!donnees.designationBrute || !donnees.pu || !donnees.qte || !donnees.total) {
    return null
  }

  const tauxTvaMatch = donnees.tva?.texte.match(/\b(20|10|7)\s*%/)
  const refEtDesignation = extraireReferenceDepuisDesignation(
    donnees.designationBrute,
  )

  const ligne: LigneFactureExtraite = {
    reference: refEtDesignation.reference,
    designation: refEtDesignation.designation,
    quantite: Number(donnees.qte.texte.trim()),
    prixUnitaireTtc: parseMontant(donnees.pu.texte),
    tauxTva: tauxTvaMatch ? Number(tauxTvaMatch[1]) : undefined,
    totalTtc: parseMontant(donnees.total.texte),
    confiance: 0,
    alertes: [],
  }

  if (!ligne.reference) ligne.alertes.push('Référence non détectée')
  if (ligne.quantite === undefined) ligne.alertes.push('Quantité non détectée')
  if (ligne.prixUnitaireTtc === undefined) ligne.alertes.push('Prix unitaire non détecté')
  if (ligne.totalTtc === undefined) ligne.alertes.push('Total ligne non détecté')
  if (ligne.tauxTva === undefined) ligne.alertes.push('TVA non détectée')

  ligne.confiance = calculerConfianceLigne(ligne)

  return ligne
}