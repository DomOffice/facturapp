export type PointOcr = [number, number]

export type LigneOcr = {
  texte?: string
  text?: string
  score?: number
  confiance?: number
  position?: PointOcr[]
}

export type PageOcr = {
  lignes?: LigneOcr[]
}

export type ResultatOcr = {
  pages?: PageOcr[]
}

export type MotOcrNormalise = {
  texte: string
  x: number
  y: number
  score?: number
}

export type LigneFactureExtraite = {
  reference?: string
  designation: string
  quantite?: number
  prixUnitaireTtc?: number
  tauxTva?: number
  remisePourcentage?: number
  totalTtc?: number
  confiance: number
  alertes: string[]
}

export type StrategieExtractionLignes =
  | 'profil'
  | 'fallback_generique'
  | 'fallback_texte'

export type FactureFournisseurExtraite = {
  fournisseurNom?: string
  numeroFacture?: string
  dateFacture?: string
  iceFournisseur?: string
  totalHt?: number
  totalTva?: number
  totalTtc?: number
  devise?: string
  profilOcr?: string
  strategieExtractionLignes?: StrategieExtractionLignes
  fallbackUtilise?: boolean
  qualiteExtraction?: 'A' | 'B' | 'C' | 'D'
  lignes: LigneFactureExtraite[]
  confiance: number
  alertes: string[]
}

export type ZoneColonneOcr = {
  xMin: number
  xMax: number
}

export type ProfilOcrFournisseur = {
  code: string
  nom: string
  aliases: string[]

  ligneArticleSurDeuxLignes?: boolean

  tableau?: {
    marqueursEntete?: string[]
    marqueursDebut?: string[]
    marqueursFin?: string[]
  }

  document?: {
  type?: "facture" | "bon_livraison"
  motifsNumero?: RegExp[]
  motifsDate?: RegExp[]
  motifsIceFournisseur?: RegExp[]
  motifsTotalHt?: RegExp[]
  motifsTotalTva?: RegExp[]
  motifsTotalTtc?: RegExp[]
  validation?: {
  exigeTotalHt?: boolean
  exigeTotalTva?: boolean
  exigeTotalTtc?: boolean
  exigeIceFournisseur?: boolean
}
}

  colonnes: {
    reference?: ZoneColonneOcr
    designation: ZoneColonneOcr
    tva?: ZoneColonneOcr
    remise?: ZoneColonneOcr
    puTtc: ZoneColonneOcr
    quantite: ZoneColonneOcr
    totalTtc: ZoneColonneOcr
  }
}