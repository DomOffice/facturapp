import type {
  LigneFactureExtraite,
  MotOcrNormalise,
  ProfilOcrFournisseur,
  ZoneColonneOcr,
} from "./types"

type DonneesArticleDetectees = {
  reference?: MotOcrNormalise
  designationBrute: string
  tva?: MotOcrNormalise
  remise?: MotOcrNormalise
  pu?: MotOcrNormalise
  qte?: MotOcrNormalise
  total?: MotOcrNormalise
}

function parseMontant(value: string): number | undefined {
  const normalized = value
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace("%", "")

  const montant = Number(normalized)

  return Number.isFinite(montant) ? montant : undefined
}

function extraireReferenceDepuisDesignation(designation: string): {
  reference?: string
  designation: string
} {
  const texte = designation.trim()

  const match = texte.match(
    /^([A-Z0-9][A-Z0-9._/-]{2,})\s*[-–:]?\s+(.+)$/i,
  )

  if (!match) {
    return {
      designation: texte,
    }
  }

  return {
    reference: match[1].trim(),
    designation: match[2].trim(),
  }
}

function calculerConfianceLigne(
  ligne: LigneFactureExtraite,
): number {
  let points = 30

  if (ligne.designation && ligne.designation.length >= 5) {
    points += 20
  }

  if (ligne.reference) {
    points += 10
  }

  if (ligne.quantite !== undefined) {
    points += 15
  }

  if (ligne.prixUnitaireTtc !== undefined) {
    points += 10
  }

  if (ligne.totalTtc !== undefined) {
    points += 15
  }

  if (ligne.tauxTva !== undefined) {
    points += 5
  }

  if (
    ligne.quantite !== undefined &&
    ligne.prixUnitaireTtc !== undefined &&
    ligne.totalTtc !== undefined
  ) {
    let attendu =
      ligne.quantite * ligne.prixUnitaireTtc

    if (
      ligne.remisePourcentage !== undefined &&
      ligne.remisePourcentage > 0
    ) {
      attendu *= 1 - ligne.remisePourcentage / 100
    }

    const ecart = Math.abs(attendu - ligne.totalTtc)

    if (ecart <= 0.05) {
      points += 10
    } else if (ecart > 1) {
      points -= 20
    }
  }

  return Math.max(0, Math.min(100, points))
}

function estMontant(texte: string): boolean {
  return /^\d[\d\s]*[,.]\d{2}$/.test(
    texte.replace(/\s/g, ""),
  )
}

function estEntier(texte: string): boolean {
  return /^\d+$/.test(texte.trim())
}

function estPourcentage(texte: string): boolean {
  return /^\d+(?:[,.]\d+)?\s*%?$/.test(
    texte.trim(),
  )
}

function estDansColonne(
  mot: MotOcrNormalise,
  colonne?: ZoneColonneOcr,
): boolean {
  if (!colonne) {
    return false
  }

  return (
    mot.x >= colonne.xMin &&
    mot.x < colonne.xMax
  )
}

function detecterDonneesArticle(
  groupes: MotOcrNormalise[][],
  profil: ProfilOcrFournisseur,
): DonneesArticleDetectees {
  const colonnes = profil.colonnes
  const tousLesMots = groupes.flat()

  const reference = colonnes.reference
    ? tousLesMots.find(
        (mot) =>
          estDansColonne(mot, colonnes.reference) &&
          /^[A-Z0-9][A-Z0-9._/-]{2,}$/i.test(
            mot.texte.trim(),
          ),
      )
    : undefined

  const textesDesignation = tousLesMots
    .filter((mot) =>
      estDansColonne(mot, colonnes.designation),
    )
    .filter((mot) => mot !== reference)
    .map((mot) => mot.texte.trim())
    .filter(Boolean)

  const tva = colonnes.tva
    ? tousLesMots.find(
        (mot) =>
          estDansColonne(mot, colonnes.tva) &&
          /\b(20|10|7)\s*%/.test(mot.texte),
      )
    : undefined

  const remise = colonnes.remise
    ? tousLesMots.find(
        (mot) =>
          estDansColonne(mot, colonnes.remise) &&
          estPourcentage(mot.texte),
      )
    : undefined

  const pu = tousLesMots.find(
    (mot) =>
      estDansColonne(mot, colonnes.puTtc) &&
      estMontant(mot.texte),
  )

  const qte = tousLesMots.find(
    (mot) =>
      estDansColonne(mot, colonnes.quantite) &&
      estEntier(mot.texte),
  )

  const total = tousLesMots.find(
    (mot) =>
      estDansColonne(mot, colonnes.totalTtc) &&
      estMontant(mot.texte),
  )

  return {
    reference,
    designationBrute: textesDesignation
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    tva,
    remise,
    pu,
    qte,
    total,
  }
}

export function construireLigneArticleDepuisGroupes(
  groupes: MotOcrNormalise[][],
  profil: ProfilOcrFournisseur,
): LigneFactureExtraite | null {
  const donnees = detecterDonneesArticle(
    groupes,
    profil,
  )

  if (
    !donnees.designationBrute ||
    !donnees.pu ||
    !donnees.qte ||
    !donnees.total
  ) {
    return null
  }

  const tauxTvaMatch =
    donnees.tva?.texte.match(/\b(20|10|7)\s*%/)

  const referenceSeparee =
    donnees.reference?.texte.trim()

  const refEtDesignation = referenceSeparee
    ? {
        reference: referenceSeparee,
        designation: donnees.designationBrute,
      }
    : extraireReferenceDepuisDesignation(
        donnees.designationBrute,
      )

  const ligne: LigneFactureExtraite = {
    reference: refEtDesignation.reference,
    designation: refEtDesignation.designation,
    quantite: Number(donnees.qte.texte.trim()),
    prixUnitaireTtc: parseMontant(
      donnees.pu.texte,
    ),
    tauxTva: tauxTvaMatch
      ? Number(tauxTvaMatch[1])
      : undefined,
    remisePourcentage: donnees.remise
      ? parseMontant(donnees.remise.texte)
      : undefined,
    totalTtc: parseMontant(
      donnees.total.texte,
    ),
    confiance: 0,
    alertes: [],
  }

  if (!ligne.reference) {
    ligne.alertes.push(
      "Référence non détectée",
    )
  }

  if (ligne.quantite === undefined) {
    ligne.alertes.push(
      "Quantité non détectée",
    )
  }

  if (ligne.prixUnitaireTtc === undefined) {
    ligne.alertes.push(
      "Prix unitaire non détecté",
    )
  }

  if (ligne.totalTtc === undefined) {
    ligne.alertes.push(
      "Total ligne non détecté",
    )
  }

  if (
    profil.colonnes.tva &&
    ligne.tauxTva === undefined
  ) {
    ligne.alertes.push(
      "TVA non détectée",
    )
  }

  ligne.confiance =
    calculerConfianceLigne(ligne)

  return ligne
}