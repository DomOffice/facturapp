import type { ProfilOcrFournisseur } from "../types";

export const mechouarDriver: ProfilOcrFournisseur = {
  code: "mechouar",
  nom: "Mechouar",

  aliases: [
    "mechouar",
  ],

  ligneArticleSurDeuxLignes: true,

  document: {
    type: "bon_livraison",

    motifsNumero: [
      /\b\d{2}\/BL\d+\b/i,
    ],

    motifsDate: [
      /\b\d{2}\/\d{2}\/\d{4}\b/,
    ],

    motifsTotalTtc: [
  /net\s+[àa]\s+payer[ \t]*:?[ \t]*(\d(?:[ \u00a0\u202f]?\d)*[,.]\d{2})/i,
  /(\d(?:[ \u00a0\u202f]?\d)*[,.]\d{2})(?:[ \t]*\r?\n[^\r\n]*){0,2}[ \t]*\r?\n[ \t]*net\s+[àa]\s+payer/i,
],

  validation: {
  exigeTotalHt: false,
  exigeTotalTva: false,
  exigeTotalTtc: true,
  exigeIceFournisseur: false,
},
  },

  tableau: {
    marqueursEntete: [
      "référence",
      "designation",
      "désignation",
      "quantité",
      "quantite",
      "prix de vente",
      "remise",
      "remist",
      "total par ligne",
    ],

    marqueursDebut: [
      "référence",
      "designation",
      "désignation",
    ],

    marqueursFin: [
      "remarque",
      "pointé par ligne",
      "pointe par ligne",
      "net a payer",
      "net à payer",
      "arrêté le présent bon de livraison",
      "arrete le present bon de livraison",
      "a reporter",
      "à reporter",
    ],
  },

  colonnes: {
    reference: {
      xMin: 20,
      xMax: 160,
    },

    designation: {
      xMin: 160,
      xMax: 720,
    },

    quantite: {
      xMin: 720,
      xMax: 830,
    },

    puTtc: {
      xMin: 830,
      xMax: 930,
    },

    remise: {
      xMin: 930,
      xMax: 1005,
    },

    totalTtc: {
      xMin: 1005,
      xMax: 1125,
    },
  },
}