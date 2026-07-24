import type { ProfilOcrFournisseur } from '../types'

export const casinfoDriver: ProfilOcrFournisseur = {
  code: "casinfo",
  nom: "CASINFO",
  aliases: [
    "casinfo",
    "cas info",
    "cas-info",
  ],

  ligneArticleSurDeuxLignes: true,

  colonnes: {
    designation: { xMin: 0, xMax: 1120 },
    tva: { xMin: 900, xMax: 1180 },
    puTtc: { xMin: 1050, xMax: 1350 },
    quantite: { xMin: 1180, xMax: 1500 },
    totalTtc: { xMin: 1320, xMax: 1850 },
  },

  document: {
  type: "facture",

  motifsIceFournisseur: [
    /(?:ice|identifiant\s+commun\s+de\s+l['’]?entreprise)\s*:?\s*(\d{15})/i,
  ],
},
}