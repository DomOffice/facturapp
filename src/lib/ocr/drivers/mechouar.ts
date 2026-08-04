import type { ProfilOcrFournisseur } from "../types";

export const mechouarDriver: ProfilOcrFournisseur = {
  code: "mechouar",
  nom: "Mechouar",

  aliases: ["mechouar"],

  traitement: {
    integreStock: true,
    comptabiliseTva: false,
    rapprochementObligatoire: true,
    metAJourPrixAchat: true,
  },

  ligneArticleSurDeuxLignes: true,

  document: {
    type: "bon_livraison",

    motifsNumero: [/\b\d{2}\/BL\d+\b/i],

    motifsDate: [/\b\d{2}\/\d{2}\/\d{4}\b/],

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

    marqueursDebut: ["référence", "designation", "désignation"],

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
};

export const mechouarFactureDriver: ProfilOcrFournisseur = {
  ...mechouarDriver,

  code: "mechouar_facture",
  nom: "Mechouar — Facture",

  traitement: {
    integreStock: false,
    comptabiliseTva: true,
    rapprochementObligatoire: false,
    metAJourPrixAchat: false,
  },

  document: {
    type: "facture",

    motifsNumero: [/\b\d{2}\/FA\d+\b/i],

    motifsDate: [/\b\d{2}\/\d{2}\/\d{4}\b/],

    motifsIceFournisseur: [/\bICE\s*:?\s*(000198247000082)\b/i],

    motifsTotalHt: [
      /t\s*otal\s*ht[ \t]*:?[ \t]*(?:\r?\n[ \t]*)?(\d(?:[ \u00a0\u202f]?\d)*[,.]\d{2})/i,
    ],

    motifsTotalTva: [
      /t\s*otal\s*tva[ \t]*:?[ \t]*(?:\r?\n[ \t]*)?(\d(?:[ \u00a0\u202f]?\d)*[,.]\d{2})/i,
    ],

    motifsTotalTtc: [
      /total\s*ttc[ \t]*:?[ \t]*(?:\r?\n[ \t]*)?(\d(?:[ \u00a0\u202f]?\d)*[,.]\d{2})/i,
    ],

    validation: {
      exigeTotalHt: true,
      exigeTotalTva: true,
      exigeTotalTtc: true,
      exigeIceFournisseur: true,
    },
  },

  colonnes: {
    reference: {
      xMin: 70,
      xMax: 270,
    },

    designation: {
      xMin: 270,
      xMax: 900,
    },

    /*
     * La facture comporte deux colonnes de quantité :
     * - commandée : environ x=975
     * - livrée : environ x=1110
     *
     * La quantité livrée est la valeur comptabilisée.
     */
    quantite: {
      xMin: 1030,
      xMax: 1165,
    },

    puTtc: {
      xMin: 1165,
      xMax: 1305,
    },

    remise: {
      xMin: 1305,
      xMax: 1385,
    },

    tva: {
      xMin: 1385,
      xMax: 1475,
    },

    totalTtc: {
      xMin: 1475,
      xMax: 1645,
    },
  },
};
