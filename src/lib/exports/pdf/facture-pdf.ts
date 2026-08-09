// src/lib/exports/pdf/facture-pdf.ts
// Génération PDF — Facture / Devis / Avoir / BL

import { formatMontant } from "@/lib/utils/currency";

export type TypeDocument = "facture" | "devis" | "avoir" | "bl";

type Ligne = {
  ordreLigne: number;
  reference?: string;
  unite?: string;
  designation: string;
  quantite: number;
  prixUnitaireHt: number;
  remisePourcentage: number;
  tauxTva: number;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
};

type DocumentPDF = {
  typeDoc?: TypeDocument;
  numeroFacture: string;
  dateFacture: string;
  client: {
    id?: number;
    raisonSociale: string;
    adresse?: string | null;
    codePostal?: string | null;
    ville?: string | null;
    telephone?: string | null;
    ice?: string | null;
    email?: string | null;
    echeanceJours?: number | null;
  };
  lignes: Ligne[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  totalArticles: number;
  totalLignes: number;
  afficherEcheance?: boolean;
  echeanceValeur?: string;
  modeReglement?: string;
};

type Entreprise = {
  raisonSociale: string;
  adresse?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email?: string | null;
  ice?: string | null;
  identifiantFiscal?: string | null;
  rc?: string | null;
  patente?: string | null;
  compteBancaire?: string | null;
  logoUrl?: string | null;
};

function labelDoc(type: TypeDocument): { titre: string; prefixe: string } {
  switch (type) {
    case "devis":
      return { titre: "DEVIS N°", prefixe: "DV" };
    case "avoir":
      return { titre: "AVOIR N°", prefixe: "AV" };
    case "bl":
      return { titre: "BON DE LIVRAISON N°", prefixe: "BL" };
    default:
      return { titre: "FACTURE N°", prefixe: "F" };
  }
}

function montantEnLettres(montant: number): string {
  const unites = [
    "",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dix-sept",
    "dix-huit",
    "dix-neuf",
  ];

  const dizaines = [
    "",
    "",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "soixante",
    "quatre-vingt",
    "quatre-vingt",
  ];

  function centaines(n: number): string {
    if (n === 0) return "";
    if (n < 20) return unites[n];

    const d = Math.floor(n / 10);
    const u = n % 10;

    if (d === 7) return "soixante-" + unites[10 + u];
    if (d === 9) return "quatre-vingt-" + (u === 0 ? "" : unites[u]);

    return (
      dizaines[d] + (u === 1 && d !== 8 ? "-et-" : u ? "-" : "") + unites[u]
    );
  }

  function parCentaines(n: number): string {
    if (n === 0) return "zéro";

    const c = Math.floor(n / 100);
    const r = n % 100;

    const partCent =
      c === 0
        ? ""
        : c === 1
          ? "cent"
          : unites[c] + " cent" + (r === 0 ? "s" : "");

    return (partCent + (r ? " " + centaines(r) : "")).trim();
  }

  const entier = Math.floor(montant);
  const cents = Math.round((montant - entier) * 100);
  const milliers = Math.floor(entier / 1000);
  const reste = entier % 1000;

  let result = "";

  if (milliers > 0) {
    result += milliers === 1 ? "mille" : parCentaines(milliers) + " mille";
  }

  if (reste > 0) {
    result += (result ? " " : "") + parCentaines(reste);
  }

  if (!result) result = "zéro";

  result = result.charAt(0).toUpperCase() + result.slice(1) + " Dirhams";

  if (cents > 0) {
    result += " " + parCentaines(cents) + " Cents";
  }

  return result;
}

async function chargerLogoViaAPI(): Promise<string | null> {
  try {
    const res = await fetch("/api/logo");
    if (!res.ok) return null;
    const data = await res.json();
    return data.dataUrl ?? null;
  } catch {
    return null;
  }
}

function textMultiLigne(
  doc: unknown,
  texte: string,
  x: number,
  y: number,
  largeurMax: number,
  interligne: number,
): number {
  const d = doc as {
    splitTextToSize: (t: string, w: number) => string[];
    text: (t: string, x: number, y: number) => void;
  };

  const lignes = d.splitTextToSize(texte, largeurMax);

  for (const ligne of lignes) {
    d.text(ligne, x, y);
    y += interligne;
  }

  return y;
}

function cleanText(s?: string | null): string {
  return (s ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function genererDocumentPDF(
  facture: DocumentPDF,
  entreprise: Entreprise,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const typeDoc = facture.typeDoc ?? "facture";
  const { titre } = labelDoc(typeDoc);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 12;
  const marginR = 12;
  const contentW = pageW - marginL - marginR;

  const BLEU = [0, 70, 127] as [number, number, number];
  const VERT = [33, 145, 80] as [number, number, number];
  const VERT_CLAIR = [224, 239, 215] as [number, number, number];
  const GRIS_CLAIR = [242, 244, 246] as [number, number, number];
  const GRIS_TEXTE = [70, 70, 70] as [number, number, number];
  const NOIR = [20, 20, 20] as [number, number, number];
  const BLANC = [255, 255, 255] as [number, number, number];

  let y = 8;

  // ── EN-TÊTE STYLE FACTURE HISTORIQUE ───────────────────────
  const colGauche = marginL;
  const colDroite = pageW / 2 + 4;

  const largeurColGauche = colDroite - marginL - 4;

  const largeurColDroite = pageW - marginR - colDroite;

  // Logo en haut à gauche
  // On tente systématiquement de le charger via l'API.
  const logoBase64 = await chargerLogoViaAPI();

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", colGauche, 7, 28, 18);
    } catch (e) {
      console.warn("Logo non chargé dans le PDF :", e);
    }
  } else {
    console.warn("Aucun logo retourné par /api/logo");
  }

  // Titre en haut à droite
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...GRIS_TEXTE);

  doc.text(`${titre}  ${facture.numeroFacture}`, pageW - marginR, 12, {
    align: "right",
  });

  // Mise en évidence légère du document
  doc.setDrawColor(...VERT);
  doc.setLineWidth(0.6);
  doc.line(pageW - marginR - 72, 15, pageW - marginR, 15);

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text("Date :", pageW - marginR - 72, 21);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NOIR);
  doc.text(
    new Date(facture.dateFacture).toLocaleDateString("fr-FR"),
    pageW - marginR,
    21,
    { align: "right" },
  );

  y = 31;

  // ── BLOC SOCIÉTÉ ───────────────────────────────────────────
  const hauteurBloc = 42;

  doc.setFillColor(...VERT_CLAIR);
  doc.rect(colGauche, y, largeurColGauche, hauteurBloc, "F");

  let ySociete = y + 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GRIS_TEXTE);
  doc.text(cleanText(entreprise.raisonSociale), colGauche + 2, ySociete);

  ySociete += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...GRIS_TEXTE);

  const lignesSociete = [
    cleanText(entreprise.adresse),
    cleanText(
      [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" "),
    ),
    entreprise.telephone
      ? `Téléphone : ${cleanText(entreprise.telephone)}`
      : "",
    entreprise.email ? `Email : ${cleanText(entreprise.email)}` : "",
    [
      entreprise.patente ? `Patente : ${cleanText(entreprise.patente)}` : "",
      entreprise.identifiantFiscal
        ? `IF : ${cleanText(entreprise.identifiantFiscal)}`
        : "",
    ]
      .filter(Boolean)
      .join("    "),
    [
      entreprise.rc ? `RC : ${cleanText(entreprise.rc)}` : "",
      entreprise.ice ? `ICE : ${cleanText(entreprise.ice)}` : "",
    ]
      .filter(Boolean)
      .join("    "),
    entreprise.compteBancaire
      ? `Compte CIH : ${cleanText(entreprise.compteBancaire)}`
      : "",
  ].filter(Boolean);

  for (const ligne of lignesSociete) {
    doc.text(ligne, colGauche + 2, ySociete);
    ySociete += 4.1;
  }

  // ── BLOC CLIENT ─────────────────────────────────────────────
  doc.setFillColor(...VERT_CLAIR);
  doc.rect(colDroite, y, largeurColDroite, hauteurBloc, "F");

  let yClient = y + 5;

  const xLabelClient = colDroite + 2;
  const xValeurClient = colDroite + 24;
  const largeurValeurClient = largeurColDroite - 27;

  const champsClient = [
    {
      label: "Client :",
      valeur: cleanText(facture.client.raisonSociale),
      gras: true,
    },
    {
      label: "Adresse :",
      valeur: cleanText(facture.client.adresse),
      multiline: true,
    },
    {
      label: "",
      valeur: cleanText(
        [facture.client.codePostal, facture.client.ville]
          .filter(Boolean)
          .join(" "),
      ),
    },
    {
      label: "Téléphone :",
      valeur: cleanText(facture.client.telephone),
    },
    {
      label: "Email :",
      valeur: cleanText(facture.client.email),
    },
    {
      label: "Code client :",
      valeur: facture.client.id != null ? String(facture.client.id) : "",
    },
    {
      label: "ICE :",
      valeur: cleanText(facture.client.ice),
    },
  ].filter((champ) => champ.valeur);

  doc.setFontSize(7.2);

  for (const champ of champsClient) {
    if (champ.label) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GRIS_TEXTE);
      doc.text(champ.label, xLabelClient, yClient);
    }

    doc.setFont("helvetica", champ.gras ? "bold" : "normal");
    doc.setTextColor(...NOIR);

    if (champ.multiline && champ.valeur.length > 28) {
      yClient = textMultiLigne(
        doc,
        champ.valeur,
        xValeurClient,
        yClient,
        largeurValeurClient,
        4,
      );
    } else {
      doc.text(champ.valeur, xValeurClient, yClient);
      yClient += 4.2;
    }
  }

  // Position de départ du tableau
  y += hauteurBloc + 5;

  // ── TABLEAU DES LIGNES ─────────────────────────────────────
  const estBL = typeDoc === "bl";
  const headBL = [["Référence", "Description", "Unité", "Quantité"]];
  const headNormal = [
    [
      "Référence",
      "Description",
      "Unité",
      "PU HT",
      "Quantité",
      "Montant HT",
      "Taux TVA",
    ],
  ];

  const lignesTableau = facture.lignes.map((l) =>
    estBL
      ? [
          l.reference ?? String(l.ordreLigne),
          l.designation,
          l.unite ?? "",
          l.quantite,
        ]
      : [
          l.reference ?? String(l.ordreLigne),
          l.designation,
          l.unite ?? "",
          l.prixUnitaireHt.toFixed(2),
          l.quantite,
          l.montantHt.toFixed(2),
          `${l.tauxTva.toFixed(2)} %`,
        ],
  );

  // On conserve une hauteur visuelle minimale proche du modèle VB6.
  // Les lignes vides sont uniquement graphiques.

  const positionsColonnes: Array<{ x: number; width: number }> = [];
  autoTable(doc, {
    theme: "plain",
    startY: y,
    margin: {
      left: marginL,
      right: marginR,
      top: 22,
      bottom: 25,
    },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    head: estBL ? headBL : headNormal,
    body: lignesTableau,
    headStyles: {
      fillColor: VERT_CLAIR,
      textColor: NOIR,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [150, 160, 150],
      lineWidth: 0.25,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: NOIR,
      minCellHeight: 6,
      lineWidth: 0,
    },
    styles: {
      fillColor: BLANC,
    },

    // Alternance des couleurs de lignes

    //alternateRowStyles: {
    //  fillColor: [248, 250, 248],
    //},
    columnStyles: estBL
      ? {
          0: { cellWidth: 30, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 25, halign: "center" },
        }
      : {
          0: { cellWidth: 20, halign: "center" },
          1: { cellWidth: 64, halign: "left" },
          2: { cellWidth: 16, halign: "center" },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 16, halign: "center" },
          5: { cellWidth: 28, halign: "right" },
          6: { cellWidth: 22, halign: "center" },
        },
    didDrawCell: (data) => {
      const index = data.column.index;

      // Mémoriser les positions exactes des colonnes depuis l'en-tête.
      if (data.section === "head") {
        positionsColonnes[index] = {
          x: data.cell.x,
          width: data.cell.width,
        };
      }

      // Attendre la dernière cellule de la ligne avant de tracer toutes
      // les verticales : aucune cellule suivante ne peut alors les recouvrir.
      if (
        data.section === "body" &&
        positionsColonnes.length > 0 &&
        index === positionsColonnes.length - 1
      ) {
        const colonnes = positionsColonnes.filter(Boolean);

        if (colonnes.length > 0) {
          const yHaut = data.cell.y;
          const yBas = data.cell.y + data.cell.height;

          doc.setDrawColor(170, 175, 170);
          doc.setLineWidth(0.2);

          // Bord gauche.
          doc.line(colonnes[0].x, yHaut, colonnes[0].x, yBas);

          // Séparations de colonnes + bord droit.
          for (const colonne of colonnes) {
            const xDroite = colonne.x + colonne.width;
            doc.line(xDroite, yHaut, xDroite, yBas);
          }
        }
      }
    },
  });

  const tableFinalY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;

  let finalY = tableFinalY + 4;

  // Prolongement visuel du tableau sans fausses lignes d'articles
  if (!estBL) {
    const tableBottomY = 160;

    if (tableFinalY < tableBottomY) {
      doc.setDrawColor(170, 175, 170);
      doc.setLineWidth(0.2);

      // Positions verticales correspondant aux colonnes :
      // Positions réelles calculées par autoTable
      if (positionsColonnes.length > 0) {
        const colonnes = positionsColonnes.filter(Boolean);

        doc.setDrawColor(170, 175, 170);
        doc.setLineWidth(0.2);

        // Bord gauche
        doc.line(colonnes[0].x, tableFinalY, colonnes[0].x, tableBottomY);

        // Bord droit réel de chaque colonne
        for (const colonne of colonnes) {
          const xDroite = colonne.x + colonne.width;

          doc.line(xDroite, tableFinalY, xDroite, tableBottomY);
        }

        // Fermeture basse du tableau
        const derniereColonne = colonnes[colonnes.length - 1];

        doc.line(
          colonnes[0].x,
          tableBottomY,
          derniereColonne.x + derniereColonne.width,
          tableBottomY,
        );
      }

      finalY = tableBottomY + 4;
    }
  }

  // ── ZONE TOTAUX (sauf BL) ─────────────────────────────────
  // ── ZONE BAS DE FACTURE ────────────────────────────────────
  if (!estBL) {
    let yBase = finalY + 1;

    // Vérifier l'espace réellement nécessaire avant de forcer une nouvelle page.
    // L'ancienne marge fixe était trop prudente et pouvait envoyer les totaux
    // sur une page 2 alors qu'ils tenaient encore sur la page courante.
    const tauxTvaDistincts = new Set(
      facture.lignes
        .map((ligne) => Number(ligne.tauxTva))
        .filter((taux) => taux > 0),
    );

    const nbTauxTva = tauxTvaDistincts.size;

    const texteMontantPrevision = `Arrêté la présente facture à ${montantEnLettres(
      facture.totalTtc,
    )}`;

    const nbLignesMontantPrevision = doc.splitTextToSize(
      texteMontantPrevision,
      contentW - 4,
    ).length;

    // Hauteur estimée depuis yBase :
    // - colonne gauche (échéance / règlement / mentions)
    // - bloc TOTAL MAD, variable selon le nombre de taux de TVA
    // - espace avant le montant en lettres
    // - montant en lettres lui-même
    const hauteurGauchePrevue = facture.client.echeanceJours ? 36 : 30;
    const hauteurTotalPrevue = 7 + 6 * (nbTauxTva + 3);
    const hauteurZonePrincipale = Math.max(
      hauteurGauchePrevue,
      hauteurTotalPrevue,
    );
    const espaceNecessaireBas =
      hauteurZonePrincipale + 18 + nbLignesMontantPrevision * 4;

    // Le pied de page commence plus bas ; on garde encore quelques millimètres
    // de sécurité sans gaspiller une grande zone blanche.
    const limiteContenuBas = pageH - 27;

    if (yBase + espaceNecessaireBas > limiteContenuBas) {
      doc.addPage();
      yBase = 28;
    }

    // ---------------------------------------------------------
    // COLONNE GAUCHE : échéance / règlement / mentions
    // ---------------------------------------------------------
    let yGauche = yBase + 4;

    doc.setFontSize(8);
    doc.setTextColor(...GRIS_TEXTE);

    doc.setFont("helvetica", "bold");
    doc.text("Échéance :", marginL, yGauche);

    if (facture.echeanceValeur) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...NOIR);
      doc.text(facture.echeanceValeur, marginL + 22, yGauche);
    }

    yGauche += 6;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GRIS_TEXTE);
    doc.text("Règlement :", marginL, yGauche);

    if (facture.modeReglement) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...NOIR);
      doc.text(facture.modeReglement, marginL + 22, yGauche);
    }

    yGauche += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS_TEXTE);

    if (facture.client.echeanceJours) {
      doc.text(
        `Facture payable sous ${facture.client.echeanceJours} jours`,
        marginL,
        yGauche,
      );
      yGauche += 6;
    }

    doc.setFont("helvetica", "italic");
    doc.text("Merci pour votre confiance", marginL, yGauche);
    yGauche += 6;

    doc.text("Sauf erreur ou omission", marginL, yGauche);

    // ---------------------------------------------------------
    // COLONNE DROITE : TOTAL MAD + ventilation TVA intégrée
    // ---------------------------------------------------------
    const xTot = pageW / 2 + 4;
    const largeurTot = pageW - marginR - xTot;
    const largeurLabel = 31;

    let yTot = yBase + 7;

    // Calcul de la TVA par taux réellement présent sur la facture
    const tvaParTaux: Record<string, number> = {};

    for (const l of facture.lignes) {
      const taux = Number(l.tauxTva);

      if (taux <= 0) continue;

      const key = taux.toString();

      if (!tvaParTaux[key]) {
        tvaParTaux[key] = 0;
      }

      // On privilégie le montant TVA enregistré sur la ligne
      tvaParTaux[key] += l.montantTva;
    }

    const lignesTva = Object.entries(tvaParTaux)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([taux, montant]) => ({
        label: `TVA ${Number(taux).toLocaleString("fr-FR")} %`,
        montant: Math.round(montant * 100) / 100,
      }));

    // Lignes réellement affichées dans TOTAL MAD
    const lignesTotal = [
      {
        label: "HT",
        montant: facture.totalHt,
        bold: false,
      },
      ...lignesTva.map((ligne) => ({
        ...ligne,
        bold: false,
      })),
      {
        label: "TTC",
        montant: facture.totalTtc,
        bold: true,
      },
    ];

    const hauteurLigneTotal = 6;
    const hauteurBlocTotal = hauteurLigneTotal * (lignesTotal.length + 1);

    // Colonne verte TOTAL MAD
    doc.setFillColor(...VERT_CLAIR);
    doc.setDrawColor(150, 160, 150);
    doc.setLineWidth(0.25);

    doc.rect(xTot, yTot, largeurLabel, hauteurBlocTotal, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...NOIR);

    doc.text("TOTAL MAD", xTot + largeurLabel / 2, yTot + 4, {
      align: "center",
    });

    // Partie droite
    doc.setFillColor(...BLANC);

    doc.rect(
      xTot + largeurLabel,
      yTot,
      largeurTot - largeurLabel,
      hauteurBlocTotal,
      "FD",
    );

    const xLabelValeur = xTot + largeurLabel + 3;

    const xMontant = xTot + largeurTot - 2;

    // Première séparation sous le titre TOTAL MAD
    doc.line(
      xTot + largeurLabel,
      yTot + hauteurLigneTotal,
      xTot + largeurTot,
      yTot + hauteurLigneTotal,
    );

    let yValeur = yTot + hauteurLigneTotal + 4;

    for (let i = 0; i < lignesTotal.length; i++) {
      const ligne = lignesTotal[i];

      if (i > 0) {
        doc.line(
          xTot + largeurLabel,
          yValeur - 4,
          xTot + largeurTot,
          yValeur - 4,
        );
      }

      doc.setFont("helvetica", ligne.bold ? "bold" : "normal");

      doc.setFontSize(ligne.bold ? 8.5 : 8);

      doc.setTextColor(...NOIR);

      doc.text(ligne.label, xLabelValeur, yValeur);

      doc.text(formatMontant(ligne.montant), xMontant, yValeur, {
        align: "right",
      });

      yValeur += hauteurLigneTotal;
    }

    yTot += hauteurBlocTotal;

    // ---------------------------------------------------------
    // MONTANT EN LETTRES
    // ---------------------------------------------------------
    // Plus d'air sous les mentions et les totaux, sans ligne horizontale.
    const yLettres = Math.max(yGauche, yTot) + 18;

    const lettres = montantEnLettres(facture.totalTtc);

    const texteLettres = `Arrêté la présente facture à ${lettres}`;

    const lettresLignes = doc.splitTextToSize(texteLettres, contentW - 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NOIR);

    let yL = yLettres;

    for (const ligne of lettresLignes) {
      doc.text(ligne, marginL + 2, yL);

      yL += 4;
    }
  }

  // ── EN-TÊTES DE CONTINUATION + PIEDS DE PAGE ───────────────
  // Le tableau peut créer plusieurs pages. Une fois toutes les pages connues,
  // on ajoute un rappel discret sur les pages 2+ et un pied de page
  // rigoureusement centré sur toutes les pages.
  const totalPages = doc.getNumberOfPages();

  for (let numeroPage = 1; numeroPage <= totalPages; numeroPage++) {
    doc.setPage(numeroPage);

    // Pages 2 et suivantes : rappel de facture et client.
    if (numeroPage > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...GRIS_TEXTE);
      doc.text(`${titre} ${facture.numeroFacture}`, marginL, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(cleanText(facture.client.raisonSociale), pageW - marginR, 10, {
        align: "right",
      });

      doc.setDrawColor(180, 185, 180);
      doc.setLineWidth(0.2);
      doc.line(marginL, 14, pageW - marginR, 14);
    }

    // ---------------------------------------------------------
    // PIED DE PAGE CENTRÉ
    // ---------------------------------------------------------
    // Centre exact de la zone imprimable, et non simple perception visuelle
    // liée à la longueur différente des lignes.
    const xCentreFooter = marginL + contentW / 2;
    const largeurFooter = contentW - 12;

    const footerAdresse = [
      cleanText(entreprise.adresse),
      cleanText(
        [entreprise.codePostal, entreprise.ville].filter(Boolean).join(" "),
      ),
      entreprise.telephone ? `Tél : ${cleanText(entreprise.telephone)}` : "",
    ]
      .filter(Boolean)
      .join(" - ");

    const footerLegal = [
      entreprise.ice ? `ICE : ${cleanText(entreprise.ice)}` : "",
      entreprise.identifiantFiscal
        ? `IF : ${cleanText(entreprise.identifiantFiscal)}`
        : "",
      entreprise.rc ? `RC : ${cleanText(entreprise.rc)}` : "",
      entreprise.patente ? `Patente : ${cleanText(entreprise.patente)}` : "",
    ]
      .filter(Boolean)
      .join("   ");

    const footerCompte = entreprise.compteBancaire
      ? `Compte CIH : ${cleanText(entreprise.compteBancaire)}`
      : "";

    const lignesFooter: Array<{
      texte: string;
      bold: boolean;
      taille: number;
    }> = [
      {
        texte: cleanText(entreprise.raisonSociale),
        bold: true,
        taille: 7,
      },
      {
        texte: footerAdresse,
        bold: false,
        taille: 6.2,
      },
      {
        texte: footerLegal,
        bold: false,
        taille: 6.2,
      },
      {
        texte: footerCompte,
        bold: false,
        taille: 6.2,
      },
    ].filter((ligne) => ligne.texte);

    // Développer les lignes trop longues avant de calculer la hauteur finale.
    const lignesFooterFinales: Array<{
      texte: string;
      bold: boolean;
      taille: number;
    }> = [];

    for (const ligne of lignesFooter) {
      doc.setFont("helvetica", ligne.bold ? "bold" : "normal");
      doc.setFontSize(ligne.taille);

      const morceaux = doc.splitTextToSize(ligne.texte, largeurFooter);

      for (const morceau of morceaux) {
        lignesFooterFinales.push({
          texte: cleanText(morceau),
          bold: ligne.bold,
          taille: ligne.taille,
        });
      }
    }

    const interligneFooter = 3.6;
    const hauteurTexteFooter = lignesFooterFinales.length * interligneFooter;

    const yPagination = pageH - 4;
    const yDerniereLigneFooter = yPagination - 4;
    const yPremiereLigneFooter =
      yDerniereLigneFooter -
      Math.max(0, lignesFooterFinales.length - 1) * interligneFooter;

    const ySeparateur = yPremiereLigneFooter - 4;

    doc.setDrawColor(170, 175, 170);
    doc.setLineWidth(0.25);
    doc.line(marginL, ySeparateur, pageW - marginR, ySeparateur);

    doc.setTextColor(...GRIS_TEXTE);

    let yFooter = yPremiereLigneFooter;

    for (
      let indexFooter = 0;
      indexFooter < lignesFooterFinales.length;
      indexFooter++
    ) {
      const ligne = lignesFooterFinales[indexFooter];

      doc.setFont("helvetica", ligne.bold ? "bold" : "normal");
      doc.setFontSize(ligne.taille);

      if (indexFooter === 1) {
        // Correction optique uniquement pour la ligne adresse / téléphone,
        // qui apparaît légèrement décalée vers la droite.
        const correctionOptiqueAdresse = 21;

        doc.text(
          ligne.texte,
          xCentreFooter - correctionOptiqueAdresse,
          yFooter,
          {
            align: "center",
          },
        );
      } else {
        doc.text(ligne.texte, xCentreFooter, yFooter, {
          align: "center",
        });
      }

      yFooter += interligneFooter;
    }

    // Pagination elle aussi centrée pour que rien ne déséquilibre visuellement
    // le pied de page.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.text(`Page ${numeroPage} / ${totalPages}`, xCentreFooter, yPagination, {
      align: "center",
    });
  }

  const nomClient = facture.client.raisonSociale.replace(/[/\\?%*:|"<>]/g, "_");
  const numSafe = facture.numeroFacture.replace(/\//g, "-");
  const prefixFichier =
    typeDoc === "bl"
      ? "BL"
      : typeDoc === "devis"
        ? "DV"
        : typeDoc === "avoir"
          ? "AV"
          : "";

  doc.save(
    `${prefixFichier ? prefixFichier + "-" : ""}${numSafe} - ${nomClient}.pdf`,
  );
}

export const genererFacturePDF = (
  facture: DocumentPDF,
  entreprise: Entreprise,
) => genererDocumentPDF(facture, entreprise);
