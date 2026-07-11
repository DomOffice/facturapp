import { construireLigneArticleDepuisGroupes } from "./article-builder";
import { chargerDriverOcr, genericLargeDriver } from "./drivers";
import type {
  FactureFournisseurExtraite,
  LigneFactureExtraite,
  MotOcrNormalise,
  ProfilOcrFournisseur,
  ResultatOcr,
  StrategieExtractionLignes,
} from "./types";

export type { FactureFournisseurExtraite, LigneFactureExtraite };

function parseMontant(value: string): number | undefined {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const montant = Number(normalized);
  return Number.isFinite(montant) ? montant : undefined;
}

function chercher(regex: RegExp, texte: string): string | undefined {
  const match = texte.match(regex);
  return match && match[1] ? match[1].trim() : undefined;
}

function normaliserTexte(value: string): string {
  return value.replace(/\r/g, "\n");
}

function extraireMotsOcr(resultatOcr?: ResultatOcr): MotOcrNormalise[] {
  const mots: MotOcrNormalise[] = [];

  if (!resultatOcr || !Array.isArray(resultatOcr.pages)) return mots;

  for (const page of resultatOcr.pages) {
    if (!page || !Array.isArray(page.lignes)) continue;

    for (const ligne of page.lignes) {
      const texte = String(ligne.texte || ligne.text || "").trim();
      if (!texte) continue;

      const position = ligne.position;
      if (!Array.isArray(position) || position.length === 0) continue;

      const xs = position.map((p) => p[0]);
      const ys = position.map((p) => p[1]);

      mots.push({
        texte,
        x: Math.min.apply(null, xs),
        y: ys.reduce((sum, val) => sum + val, 0) / ys.length,
        score: ligne.score ?? ligne.confiance,
      });
    }
  }

  return mots.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 8) return a.y - b.y;
    return a.x - b.x;
  });
}

function grouperParLignes(mots: MotOcrNormalise[]): MotOcrNormalise[][] {
  const groupes: MotOcrNormalise[][] = [];
  const toleranceY = 12;

  for (const mot of mots) {
    let groupeTrouve: MotOcrNormalise[] | undefined;

    for (const groupe of groupes) {
      const yMoyen =
        groupe.reduce((sum, item) => sum + item.y, 0) / groupe.length;

      if (Math.abs(yMoyen - mot.y) <= toleranceY) {
        groupeTrouve = groupe;
        break;
      }
    }

    if (groupeTrouve) groupeTrouve.push(mot);
    else groupes.push([mot]);
  }

  return groupes.map((groupe) => groupe.sort((a, b) => a.x - b.x));
}

function extraireReferenceDepuisDesignation(designation: string): {
  reference?: string;
  designation: string;
} {
  const texte = designation.trim();
  const match = texte.match(/^([A-Z0-9][A-Z0-9._/-]{2,})\s*[-–:]?\s+(.+)$/i);

  if (!match) return { designation: texte };

  return {
    reference: match[1].trim(),
    designation: match[2].trim(),
  };
}

function calculerConfianceLigne(ligne: LigneFactureExtraite): number {
  let points = 30;

  if (ligne.designation && ligne.designation.length >= 5) points += 20;
  if (ligne.reference) points += 10;
  if (ligne.quantite !== undefined) points += 15;
  if (ligne.prixUnitaireTtc !== undefined) points += 10;
  if (ligne.totalTtc !== undefined) points += 15;

  if (
    ligne.quantite !== undefined &&
    ligne.prixUnitaireTtc !== undefined &&
    ligne.totalTtc !== undefined
  ) {
    const attendu = ligne.quantite * ligne.prixUnitaireTtc;
    const ecart = Math.abs(attendu - ligne.totalTtc);

    if (ecart <= 0.05) points += 10;
    else if (ecart > 1) points -= 20;
  }

  return Math.max(0, Math.min(100, points));
}

function extraireLignesParProfil(
  resultatOcr: ResultatOcr | undefined,
  profil: ProfilOcrFournisseur,
): LigneFactureExtraite[] {
  const mots = extraireMotsOcr(resultatOcr);
  const lignes: LigneFactureExtraite[] = [];

  const headerDesignation = mots.find((m) =>
    /désignation|designation/i.test(m.texte),
  );

  const debutTableauY = headerDesignation ? headerDesignation.y + 10 : 0;

  const totalHt = mots.find(
    (m) => /total\s*ht/i.test(m.texte) && m.y > debutTableauY + 100,
  );

  const finTableauY = totalHt ? totalHt.y - 15 : Number.MAX_SAFE_INTEGER;

  const groupes = grouperParLignes(
    mots.filter((m) => m.y >= debutTableauY && m.y <= finTableauY),
  );

  let groupesArticleEnCours: MotOcrNormalise[][] = [];

  for (const groupe of groupes) {
    const texteGroupe = groupe
      .map((m) => m.texte)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!texteGroupe) continue;

    const ligneBasse = texteGroupe.toLowerCase();

    if (
      ligneBasse.includes("total ht") ||
      ligneBasse.includes("total tva") ||
      ligneBasse === "total ttc" ||
      ligneBasse.includes("arrêtée la présente") ||
      ligneBasse.includes("arretee la presente") ||
      ligneBasse.includes("magasinier") ||
      ligneBasse.includes("nos marchandises") ||
      ligneBasse.includes("garantie") ||
      ligneBasse.includes("siège social") ||
      ligneBasse.includes("siege social") ||
      ligneBasse.includes("téléphone") ||
      ligneBasse.includes("telephone")
    ) {
      continue;
    }

    groupesArticleEnCours.push(groupe);

    const ligneConstruite = construireLigneArticleDepuisGroupes(
      groupesArticleEnCours,
      profil,
    );

    if (ligneConstruite) {
      lignes.push(ligneConstruite);
      groupesArticleEnCours = [];
    }
  }

  return lignes;
}

function extraireLignesDepuisTexte(texteOcr: string): LigneFactureExtraite[] {
  const lignesTexte = normaliserTexte(texteOcr)
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(Boolean);

  const lignes: LigneFactureExtraite[] = [];

  for (let i = 0; i < lignesTexte.length; i += 1) {
    const ligneReference = lignesTexte[i];

    if (!/^[A-Z0-9][A-Z0-9._/-]{2,}\s*[-–:]/i.test(ligneReference)) {
      continue;
    }

    const tvaTexte = lignesTexte[i + 1];
    const puTexte = lignesTexte[i + 2];
    const qteTexte = lignesTexte[i + 3];
    const totalTexte = lignesTexte[i + 4];

    if (
      !tvaTexte ||
      !puTexte ||
      !qteTexte ||
      !totalTexte ||
      !/\b(20|10|7)\s*%/.test(tvaTexte) ||
      !/^\d[\d\s]*[,.]\d{2}$/.test(puTexte.replace(/\s/g, "")) ||
      !/^\d+$/.test(qteTexte) ||
      !/^\d[\d\s]*[,.]\d{2}$/.test(totalTexte.replace(/\s/g, ""))
    ) {
      continue;
    }

    const refEtDesignation = extraireReferenceDepuisDesignation(ligneReference);

    const tauxTvaMatch = tvaTexte.match(/\b(20|10|7)\s*%/);

    const ligneExtraite: LigneFactureExtraite = {
      reference: refEtDesignation.reference,
      designation: refEtDesignation.designation,
      quantite: Number(qteTexte),
      prixUnitaireTtc: parseMontant(puTexte),
      tauxTva: tauxTvaMatch ? Number(tauxTvaMatch[1]) : undefined,
      totalTtc: parseMontant(totalTexte),
      confiance: 0,
      alertes: ["Extraction fallback texte brut"],
    };

    ligneExtraite.confiance = Math.min(
      80,
      calculerConfianceLigne(ligneExtraite),
    );

    lignes.push(ligneExtraite);

    i += 4;
  }

  return lignes;
}
function extraireLignesAvecFallback(
  texteOcr: string,
  resultatOcr: ResultatOcr | undefined,
  profil: ProfilOcrFournisseur,
): {
  lignes: LigneFactureExtraite[];
  strategie: StrategieExtractionLignes;
  fallbackUtilise: boolean;
  qualite: "A" | "B" | "C" | "D";
} {
  const lignesProfil = extraireLignesParProfil(resultatOcr, profil);

  if (lignesProfil.length > 0) {
    return {
      lignes: lignesProfil,
      strategie: "profil",
      fallbackUtilise: false,
      qualite: lignesProfil.every((ligne) => ligne.confiance > 95)
        ? "A"
        : "B",
    };
  }

  const lignesGenerique = extraireLignesParProfil(
    resultatOcr,
    genericLargeDriver,
  );

  if (lignesGenerique.length > 0) {
    return {
      lignes: lignesGenerique,
      strategie: "fallback_generique",
      fallbackUtilise: true,
      qualite: "C",
    };
  }

  const lignesTexte = extraireLignesDepuisTexte(texteOcr);

  if (lignesTexte.length > 0) {
    return {
      lignes: lignesTexte,
      strategie: "fallback_texte",
      fallbackUtilise: true,
      qualite: "D",
    };
  }

  const lignesBl = extraireLignesBlDepuisTexte(texteOcr);

  return {
    lignes: lignesBl,
    strategie: "fallback_texte",
    fallbackUtilise: true,
    qualite: lignesBl.length > 0 ? "C" : "D",
  };
}

export function extraireFactureFournisseurDepuisOcr(
  texteOcr: string,
  resultatOcr?: ResultatOcr,
  fournisseurSelectionneNom?: string,
): FactureFournisseurExtraite {
  const texte = normaliserTexte(texteOcr);

  const numeroFacture =
    chercher(
      /(?:BL\s*\/\s*)?FACTURE\s*N[°º�]?\s*:?\s*([A-Z]{1,5}\d{4}[-/]\d{3,8})/i,
      texte,
    ) ||
    chercher(/(?:N[°º�]\s*:?\s*)([A-Z]{1,5}\d{4}[-/]\d{3,8})/i, texte) ||
    chercher(/\b([A-Z]{1,5}\d{4}[-/]\d{3,8})\b/i, texte);

  const dateFacture = chercher(
    /(?:date\s*(?:facturation|facture)?\s*:?\s*)(\d{2}\/\d{2}\/\d{4})/i,
    texte,
  );

  const iceMatches = Array.from(texte.matchAll(/ICE\s*:?\s*(\d{10,20})/gi));
  const iceFournisseur =
    iceMatches.length > 0 ? iceMatches[iceMatches.length - 1][1] : undefined;

  const totalHt = parseMontant(
    chercher(/total\s*ht\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || "",
  );

  const totalTva = parseMontant(
    chercher(/total\s*tva(?:\s*\d+%)?\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) ||
      "",
  );

  const totalTtc = parseMontant(
    chercher(/total\s*ttc\s*\n?\s*([\d\s]+[,.]\d{2})/i, texte) || "",
  );

  const fournisseurNom =
    fournisseurSelectionneNom ||
    texte
      .split("\n")
      .map((ligne) => ligne.trim())
      .find((ligne) => ligne.length >= 3 && /^[A-Z0-9\s&.-]+$/.test(ligne));

  const devise = /dirham|mad|dh/i.test(texte) ? "MAD" : undefined;

  const profil = chargerDriverOcr(fournisseurNom);

  const extractionLignes = extraireLignesAvecFallback(
    texte,
    resultatOcr,
    profil,
  );
  const lignes = extractionLignes.lignes;

  const alertes: string[] = [];

  if (!numeroFacture) alertes.push("Numéro de facture non détecté");
  if (!dateFacture) alertes.push("Date de facture non détectée");
  if (!totalTtc) alertes.push("Total TTC non détecté");
  if (!totalHt) alertes.push("Total HT non détecté");
  if (!iceFournisseur) alertes.push("ICE fournisseur non détecté");
  if (lignes.length === 0) alertes.push("Aucune ligne article détectée");
  if (extractionLignes.fallbackUtilise && lignes.length > 0) {
    alertes.push(`Fallback utilisé : ${extractionLignes.strategie}`);
  }

  let points = 0;
  if (numeroFacture) points += 20;
  if (dateFacture) points += 20;
  if (totalHt) points += 15;
  if (totalTva) points += 15;
  if (totalTtc) points += 20;
  if (iceFournisseur) points += 10;

  return {
    fournisseurNom,
    numeroFacture,
    dateFacture,
    iceFournisseur,
    totalHt,
    totalTva,
    totalTtc,
    devise,
    profilOcr: profil.code,
    strategieExtractionLignes: extractionLignes.strategie,
    fallbackUtilise: extractionLignes.fallbackUtilise,
    qualiteExtraction: extractionLignes.qualite,
    lignes,
    confiance: points,
    alertes,
  };
}

function extraireLignesBlDepuisTexte(texteOcr: string): LigneFactureExtraite[] {
  const lignesTexte = normaliserTexte(texteOcr)
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(Boolean)

  const lignes: LigneFactureExtraite[] = []

  for (let i = 0; i < lignesTexte.length - 4; i += 1) {
    const reference = lignesTexte[i]
    const designation = lignesTexte[i + 1]
    const quantiteTexte = lignesTexte[i + 2]
    const prixTexte = lignesTexte[i + 3]
    const totalTexte = lignesTexte[i + 4]

    const estReference =
      /^[A-Z0-9][A-Z0-9._/-]{4,}$/i.test(reference)

    const estDesignation =
      designation.length >= 5 &&
      !/^(remarque|net à payer|net a payer|arrêté|arrete)$/i.test(designation)

    const estQuantite = /^\d+$/.test(quantiteTexte)

    const estPrix = /^\d[\d\s]*[,.]\d{2}$/.test(
      prixTexte.replace(/\s/g, ""),
    )

    const estTotal = /^\d[\d\s]*[,.]\d{2}$/.test(
      totalTexte.replace(/\s/g, ""),
    )

    if (!estReference || !estDesignation || !estQuantite || !estPrix || !estTotal) {
      continue
    }

    const ligneExtraite: LigneFactureExtraite = {
      reference,
      designation,
      quantite: Number(quantiteTexte),
      prixUnitaireTtc: parseMontant(prixTexte),
      tauxTva: undefined,
      totalTtc: parseMontant(totalTexte),
      confiance: 0,
      alertes: ["Extraction fallback BL texte brut", "TVA non détectée"],
    }

    ligneExtraite.confiance = Math.min(85, calculerConfianceLigne(ligneExtraite))

    lignes.push(ligneExtraite)

    i += 4
  }

  return lignes
}