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

export type ProfilOcrFournisseur = {
  code: 'generic' | 'generic_large' | 'casinfo'
  nom: string
  aliases: string[]
  ligneArticleSurDeuxLignes: boolean
  colonnes: {
    designation: { xMin: number; xMax: number }
    tva: { xMin: number; xMax: number }
    puTtc: { xMin: number; xMax: number }
    quantite: { xMin: number; xMax: number }
    totalTtc: { xMin: number; xMax: number }
  }
}