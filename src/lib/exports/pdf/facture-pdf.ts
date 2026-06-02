// src/lib/exports/pdf/facture-pdf.ts
// Génération PDF — Facture / Devis / Avoir / BL

import { formatMontant } from '@/lib/utils/currency'

export type TypeDocument = 'facture' | 'devis' | 'avoir' | 'bl'

type Ligne = {
  ordreLigne: number
  designation: string
  quantite: number
  prixUnitaireHt: number
  remisePourcentage: number
  tauxTva: number
  montantHt: number
  montantTva: number
  montantTtc: number
}

type DocumentPDF = {
  typeDoc?: TypeDocument
  numeroFacture: string
  dateFacture: string
  client: {
    id?: number
    raisonSociale: string
    adresse?: string | null
    codePostal?: string | null
    ville?: string | null
    telephone?: string | null
    ice?: string | null
    email?: string | null
    echeanceJours?: number | null
  }
  lignes: Ligne[]
  totalHt: number
  totalTva: number
  totalTtc: number
  totalArticles: number
  totalLignes: number
  afficherEcheance?: boolean
  echeanceValeur?: string
  modeReglement?: string
}

type Entreprise = {
  raisonSociale: string
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
  telephone?: string | null
  email?: string | null
  ice?: string | null
  identifiantFiscal?: string | null
  rc?: string | null
  patente?: string | null
  compteBancaire?: string | null
  logoUrl?: string | null
}

function labelDoc(type: TypeDocument): { titre: string; prefixe: string } {
  switch (type) {
    case 'devis':
      return { titre: 'DEVIS N°', prefixe: 'DV' }
    case 'avoir':
      return { titre: 'AVOIR N°', prefixe: 'AV' }
    case 'bl':
      return { titre: 'BON DE LIVRAISON N°', prefixe: 'BL' }
    default:
      return { titre: 'FACTURE N°', prefixe: 'F' }
  }
}

function montantEnLettres(montant: number): string {
  const unites = [
    '',
    'un',
    'deux',
    'trois',
    'quatre',
    'cinq',
    'six',
    'sept',
    'huit',
    'neuf',
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
    'dix-sept',
    'dix-huit',
    'dix-neuf',
  ]

  const dizaines = [
    '',
    '',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante',
    'quatre-vingt',
    'quatre-vingt',
  ]

  function centaines(n: number): string {
    if (n === 0) return ''
    if (n < 20) return unites[n]

    const d = Math.floor(n / 10)
    const u = n % 10

    if (d === 7) return 'soixante-' + unites[10 + u]
    if (d === 9) return 'quatre-vingt-' + (u === 0 ? '' : unites[u])

    return dizaines[d] + (u === 1 && d !== 8 ? '-et-' : u ? '-' : '') + unites[u]
  }

  function parCentaines(n: number): string {
    if (n === 0) return 'zéro'

    const c = Math.floor(n / 100)
    const r = n % 100

    const partCent =
      c === 0 ? '' : c === 1 ? 'cent' : unites[c] + ' cent' + (r === 0 ? 's' : '')

    return (partCent + (r ? ' ' + centaines(r) : '')).trim()
  }

  const entier = Math.floor(montant)
  const cents = Math.round((montant - entier) * 100)
  const milliers = Math.floor(entier / 1000)
  const reste = entier % 1000

  let result = ''

  if (milliers > 0) {
    result += milliers === 1 ? 'mille' : parCentaines(milliers) + ' mille'
  }

  if (reste > 0) {
    result += (result ? ' ' : '') + parCentaines(reste)
  }

  if (!result) result = 'zéro'

  result = result.charAt(0).toUpperCase() + result.slice(1) + ' Dirhams'

  if (cents > 0) {
    result += ' ' + parCentaines(cents) + ' Cents'
  }

  return result
}

async function chargerLogoViaAPI(): Promise<string | null> {
  try {
    const res = await fetch('/api/logo')
    if (!res.ok) return null
    const data = await res.json()
    return data.dataUrl ?? null
  } catch {
    return null
  }
}

function textMultiLigne(
  doc: unknown,
  texte: string,
  x: number,
  y: number,
  largeurMax: number,
  interligne: number
): number {
  const d = doc as {
    splitTextToSize: (t: string, w: number) => string[]
    text: (t: string, x: number, y: number) => void
  }

  const lignes = d.splitTextToSize(texte, largeurMax)

  for (const ligne of lignes) {
    d.text(ligne, x, y)
    y += interligne
  }

  return y
}

function cleanText(s?: string | null): string {
  return (s ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function genererDocumentPDF(
  facture: DocumentPDF,
  entreprise: Entreprise
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const typeDoc = facture.typeDoc ?? 'facture'
  const { titre } = labelDoc(typeDoc)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginL = 12
  const marginR = 12
  const contentW = pageW - marginL - marginR

  const BLEU = [0, 70, 127] as [number, number, number]
  const GRIS_CLAIR = [235, 240, 245] as [number, number, number]
  const GRIS_TEXTE = [80, 80, 80] as [number, number, number]
  const NOIR = [20, 20, 20] as [number, number, number]
  const BLANC = [255, 255, 255] as [number, number, number]

  let y = 8

  // ── BANDEAU TITRE ──────────────────────────────────────────
  doc.setFillColor(...BLEU)
  doc.rect(0, 0, pageW, 18, 'F')
  doc.setTextColor(...BLANC)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(`${titre}  ${facture.numeroFacture}`, pageW / 2, 11, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Date :', pageW - marginR - 46, 11)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(new Date(facture.dateFacture).toLocaleDateString('fr-FR'), pageW - marginR - 28, 11)

  y = 22

  // ── LOGO + INFOS SOCIÉTÉ ───────────────────────────────────
  const colGauche = marginL
  const colDroite = pageW / 2 + 4
  const largeurCol = pageW / 2 - marginL - 4

  if (entreprise.logoUrl) {
    const logoBase64 = await chargerLogoViaAPI()
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', colGauche, y, 38, 20)
        y += 24
      } catch (e) {
        console.warn('Logo non chargé:', e)
      }
    }
  }

  doc.setTextColor(...BLEU)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(entreprise.raisonSociale, colGauche, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS_TEXTE)

  const lignesSociete = [
    cleanText(entreprise.adresse),
    cleanText([entreprise.codePostal, entreprise.ville].filter(Boolean).join(' ')),
    entreprise.telephone ? `Téléphone : ${cleanText(entreprise.telephone)}` : '',
    entreprise.email ? `Email : ${cleanText(entreprise.email)}` : '',
    entreprise.patente
      ? `Patente : ${cleanText(entreprise.patente)}    IF : ${cleanText(entreprise.identifiantFiscal)}`
      : '',
    entreprise.rc
      ? `RC : ${cleanText(entreprise.rc)}    ICE : ${cleanText(entreprise.ice)}`
      : '',
    entreprise.compteBancaire ? `Compte CIH : ${cleanText(entreprise.compteBancaire)}` : '',
  ].filter(Boolean)

  for (const ligne of lignesSociete) {
    doc.text(ligne, colGauche, y)
    y += 4.2
  }

  // ── INFOS CLIENT (droite) avec retour à la ligne ───────────
  let yClient = 22
  const hauteurBloc = 56
  doc.setFillColor(...GRIS_CLAIR)
  doc.roundedRect(colDroite - 2, yClient - 2, largeurCol + 2, hauteurBloc, 1, 1, 'F')

  doc.setTextColor(...GRIS_TEXTE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  yClient += 3

  const champsClient = [
    { label: 'Client :', valeur: cleanText(facture.client.raisonSociale), gras: true },
    { label: 'Adresse :', valeur: cleanText(facture.client.adresse), multiline: true },
    {
      label: '',
      valeur: cleanText([facture.client.codePostal, facture.client.ville].filter(Boolean).join(' ')),
    },
    { label: 'Téléphone :', valeur: cleanText(facture.client.telephone) },
    { label: 'Email :', valeur: cleanText(facture.client.email) },
    { label: 'Code client :', valeur: facture.client.id != null ? String(facture.client.id) : '' },
    { label: 'ICE :', valeur: cleanText(facture.client.ice) },
  ].filter((c) => c.valeur)

  for (const champ of champsClient) {
    if (champ.label) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRIS_TEXTE)
      doc.text(champ.label, colDroite, yClient)
    }

    doc.setFont('helvetica', champ.gras ? 'bold' : 'normal')
    doc.setTextColor(...NOIR)

    const xValeur = colDroite + 22
    const largeurValeur = largeurCol - 24

    if (champ.multiline && champ.valeur.length > 28) {
      yClient = textMultiLigne(doc, champ.valeur, xValeur, yClient, largeurValeur, 4.2)
    } else {
      doc.text(champ.valeur, xValeur, yClient)
      yClient += 4.5
    }
  }

  y = Math.max(y, yClient) + 4

  // ── TABLEAU DES LIGNES ─────────────────────────────────────
  const estBL = typeDoc === 'bl'
  const headBL = [['Référence', 'Description', 'Unité', 'Quantité']]
  const headNormal = [['Référence', 'Description', 'Unité', 'PU HT', 'Quantité', 'Montant HT', 'Taux TVA']]

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR },
    head: estBL ? headBL : headNormal,
    body: facture.lignes.map((l) =>
      estBL
        ? [String(l.ordreLigne), l.designation, '', l.quantite]
        : [
            String(l.ordreLigne),
            l.designation,
            '',
            l.prixUnitaireHt.toFixed(2),
            l.quantite,
            l.montantHt.toFixed(2),
            `${l.tauxTva.toFixed(2)} %`,
          ]
    ),
    headStyles: {
      fillColor: BLEU,
      textColor: BLANC,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: NOIR,
      minCellHeight: 6,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: estBL
      ? {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 25, halign: 'center' },
        }
      : {
          0: { cellWidth: 28, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 16, halign: 'center' },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 26, halign: 'right' },
          6: { cellWidth: 20, halign: 'center' },
        },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

  // ── ZONE TOTAUX (sauf BL) ─────────────────────────────────
  if (!estBL) {
    const xTot = pageW / 2 + 4
    let yTot = finalY

    if (facture.afficherEcheance) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRIS_TEXTE)
      doc.text('Échéance :', marginL, yTot + 4)

      if (facture.echeanceValeur) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...NOIR)
        doc.text(facture.echeanceValeur, marginL + 20, yTot + 4)
      }

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRIS_TEXTE)
      doc.text('Règlement :', marginL, yTot + 10)

      if (facture.modeReglement) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...NOIR)
        doc.text(facture.modeReglement, marginL + 20, yTot + 10)
      }
    }

    doc.setFillColor(...GRIS_CLAIR)
    doc.rect(xTot - 2, yTot - 1, contentW / 2 + 2, 8, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...GRIS_TEXTE)
    doc.text('HT MAD', xTot, yTot + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...NOIR)
    doc.text(formatMontant(facture.totalHt), pageW - marginR, yTot + 5, { align: 'right' })
    yTot += 10

    const tvaParTaux: Record<string, number> = {}
    for (const l of facture.lignes) {
      const key = `${l.tauxTva}`
      if (!tvaParTaux[key]) tvaParTaux[key] = 0
      tvaParTaux[key] += (l.montantHt * l.tauxTva) / 100
    }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...GRIS_TEXTE)

    for (const [taux, montant] of Object.entries(tvaParTaux).sort(([a], [b]) => Number(a) - Number(b))) {
      if (Number(taux) > 0) {
        doc.setFillColor(...GRIS_CLAIR)
        doc.rect(xTot - 2, yTot - 1, contentW / 2 + 2, 6, 'F')
        doc.text(`TVA à ${taux}% :`, xTot, yTot + 3)
        doc.text(formatMontant(Math.round(montant * 100) / 100), pageW - marginR, yTot + 3, {
          align: 'right',
        })
        yTot += 6
      }
    }

    doc.setFillColor(...BLEU)
    doc.rect(xTot - 2, yTot - 1, contentW / 2 + 2, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLANC)
    doc.text('TOTAL MAD', xTot, yTot + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('HT', xTot + 30, yTot + 4)
    doc.text(formatMontant(facture.totalHt), pageW - marginR, yTot + 4, { align: 'right' })
    doc.text('TVA', xTot + 30, yTot + 10)
    doc.text(formatMontant(facture.totalTva), pageW - marginR, yTot + 10, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('TTC', xTot + 30, yTot + 17)
    doc.text(formatMontant(facture.totalTtc), pageW - marginR, yTot + 17, { align: 'right' })
    yTot += 22

    let yMentions = finalY + 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS_TEXTE)

    if (facture.client.echeanceJours && !facture.afficherEcheance) {
      doc.text(`Facture payable sous ${facture.client.echeanceJours} jours`, marginL, yMentions + 14)
    }

    doc.setFont('helvetica', 'italic')
    doc.text('Merci pour votre confiance', marginL, yMentions + 20)
    doc.text('Sauf erreur ou omission', marginL, yMentions + 26)

    const yLettres = yTot + 6
    doc.setFillColor(...GRIS_CLAIR)
    doc.rect(marginL, yLettres - 3, contentW, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...NOIR)

    const lettres = montantEnLettres(facture.totalTtc)
    const lettresLignes = doc.splitTextToSize(`Arrêté la présente facture à ${lettres}`, contentW - 4)

    let yL = yLettres + 2
    for (const ligne of lettresLignes) {
      doc.text(ligne, marginL + 2, yL)
      yL += 4
    }
  }

  // ── PIED DE PAGE entièrement centré ──────────────────────
  const piedLignesBrutes: string[] = []

  if (cleanText(entreprise.raisonSociale)) {
    piedLignesBrutes.push(cleanText(entreprise.raisonSociale))
  }

  const l1Parts = [
    cleanText(entreprise.adresse),
    cleanText([entreprise.codePostal, entreprise.ville].filter(Boolean).join(' ')),
    entreprise.telephone ? `Tél : ${cleanText(entreprise.telephone)}` : '',
  ].filter(Boolean)

  if (l1Parts.length) {
    piedLignesBrutes.push(cleanText(l1Parts.join(' | ')))
  }

  const l2Parts = [
    entreprise.ice ? `ICE : ${cleanText(entreprise.ice)}` : '',
    entreprise.identifiantFiscal ? `IF : ${cleanText(entreprise.identifiantFiscal)}` : '',
    entreprise.rc ? `RC : ${cleanText(entreprise.rc)}` : '',
    entreprise.patente ? `Patente : ${cleanText(entreprise.patente)}` : '',
  ].filter(Boolean)

  if (l2Parts.length) {
    piedLignesBrutes.push(cleanText(l2Parts.join(' | ')))
  }

  if (entreprise.compteBancaire) {
    piedLignesBrutes.push(`Compte : ${cleanText(entreprise.compteBancaire)}`)
  }

  const largeurTextePied = pageW - 24
  const piedLignesFinales: Array<{ text: string; bold: boolean; fontSize: number }> = []

  for (let i = 0; i < piedLignesBrutes.length; i++) {
    const fontSize = i === 0 ? 9 : 7.5
    const bold = i === 0

    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(fontSize)

    const morceaux = doc.splitTextToSize(cleanText(piedLignesBrutes[i]), largeurTextePied)

    for (const morceau of morceaux) {
      piedLignesFinales.push({
        text: cleanText(morceau),
        bold,
        fontSize,
      })
    }
  }

  const interlignePied = 4.6
  const paddingPied = 4
  const hauteurPied = piedLignesFinales.length * interlignePied + paddingPied * 2
  const yPied = pageH - hauteurPied

  doc.setFillColor(...BLEU)
  doc.rect(0, yPied, pageW, hauteurPied, 'F')

  doc.setTextColor(...BLANC)

  let yTexte = yPied + paddingPied + 3.2

  for (let i = 0; i < piedLignesFinales.length; i++) {
  const ligne = piedLignesFinales[i]

  doc.setFont('helvetica', ligne.bold ? 'bold' : 'normal')
  doc.setFontSize(ligne.fontSize)

  const texte = cleanText(ligne.text)

  // 👉 Ligne 2 (index 1) NON centrée
  if (i === 1) {
    doc.text(texte, marginL + 15, yTexte) // alignement gauche
  } else {
    doc.text(texte, pageW / 2, yTexte, {
      align: 'center',
    })
  }

  yTexte += interlignePied
}

  const nomClient = facture.client.raisonSociale.replace(/[/\\?%*:|"<>]/g, '_')
  const numSafe = facture.numeroFacture.replace(/\//g, '-')
  const prefixFichier =
    typeDoc === 'bl' ? 'BL' : typeDoc === 'devis' ? 'DV' : typeDoc === 'avoir' ? 'AV' : ''

  doc.save(`${prefixFichier ? prefixFichier + '-' : ''}${numSafe} - ${nomClient}.pdf`)
}

export const genererFacturePDF = (facture: DocumentPDF, entreprise: Entreprise) =>
  genererDocumentPDF(facture, entreprise)