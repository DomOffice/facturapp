import type { ProfilOcrFournisseur } from '../types'

export const genericDriver: ProfilOcrFournisseur = {
  code: 'generic',
  nom: 'Générique',
  aliases: [],
  //ligneArticleSurDeuxLignes: true,
  colonnes: {
    designation: { xMin: 0, xMax: 1050 },
    tva: { xMin: 900, xMax: 1160 },
    puTtc: { xMin: 1050, xMax: 1320 },
    quantite: { xMin: 1200, xMax: 1480 },
    totalTtc: { xMin: 1350, xMax: 1900 },
  },
}

export const genericLargeDriver: ProfilOcrFournisseur = {
  code: 'generic_large',
  nom: 'Générique élargi',
  aliases: [],
  //ligneArticleSurDeuxLignes: true,
  colonnes: {
    designation: { xMin: 0, xMax: 1150 },
    tva: { xMin: 850, xMax: 1250 },
    puTtc: { xMin: 950, xMax: 1400 },
    quantite: { xMin: 1100, xMax: 1550 },
    totalTtc: { xMin: 1250, xMax: 2000 },
  },
}