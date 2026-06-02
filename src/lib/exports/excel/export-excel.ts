// src/lib/exports/excel/export-excel.ts
// Export Excel côté client avec la librairie xlsx

type FactureExcel = {
  numeroFacture: string
  clientNom: string
  dateFacture: string
  totalLignes: number
  totalArticles: number
  totalHt: number
  totalTva: number
  totalTtc: number
  margeHt: number
  statut: string
  estPayee: boolean
  datePaiement?: string | null
  modeReglement?: string | null
  numeroPiece?: string | null
}

type PaiementExcel = {
  numeroFacture: string
  dateFacture: string
  clientNom: string
  montantHt: number
  montantTtc: number
  datePaiement?: string | null
  modeReglement?: string | null
  numeroPiece?: string | null
  remarque?: string | null
  estPayee: boolean
}

type ChargeExcel = {
  dateCharge: string
  numeroFacture?: string | null
  emetteur: string
  typeCharge: string
  montantHt: number
  tauxTva: number
  montantTva: number
  montantTtc: number
  remarque?: string | null
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

function formatNum(val: number): number {
  return Math.round(val * 100) / 100
}

export async function exporterFacturesExcel(factures: FactureExcel[]): Promise<void> {
  const { utils, writeFile } = await import('xlsx')

  const data = [
    // En-tête
    [
      'N° Facture', 'Client', 'Date', 'Nb Lignes', 'Nb Articles',
      'Total HT', 'Total TVA', 'Total TTC', 'Marge HT',
      'Statut', 'Payée', 'Date paiement', 'Mode règlement', 'N° pièce'
    ],
    // Données
    ...factures.map(f => [
      f.numeroFacture.replace(/\//g, '-'),
      f.clientNom,
      formatDate(f.dateFacture),
      f.totalLignes,
      formatNum(f.totalArticles),
      formatNum(f.totalHt),
      formatNum(f.totalTva),
      formatNum(f.totalTtc),
      formatNum(f.margeHt),
      f.statut === 'validee' ? 'Validée' : f.statut === 'brouillon' ? 'Brouillon' : 'Annulée',
      f.estPayee ? 'Oui' : 'Non',
      formatDate(f.datePaiement),
      f.modeReglement ?? '',
      f.numeroPiece ?? '',
    ]),
    // Ligne totaux
    [
      'TOTAUX', '', '', '', '',
      formatNum(factures.reduce((s, f) => s + f.totalHt, 0)),
      formatNum(factures.reduce((s, f) => s + f.totalTva, 0)),
      formatNum(factures.reduce((s, f) => s + f.totalTtc, 0)),
      formatNum(factures.reduce((s, f) => s + f.margeHt, 0)),
      '', '', '', '', ''
    ]
  ]

  const ws = utils.aoa_to_sheet(data)

  // Largeurs colonnes
  ws['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 16 }
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Factures')

  const date = new Date().toISOString().split('T')[0]
  writeFile(wb, `Factures_${date}.xlsx`)
}

export async function exporterPaiementsExcel(paiements: PaiementExcel[]): Promise<void> {
  const { utils, writeFile } = await import('xlsx')

  const payees = paiements.filter(p => p.estPayee)
  const nonPayees = paiements.filter(p => !p.estPayee)

  const data = [
    [
      'N° Facture', 'Date facture', 'Client',
      'Montant HT', 'Montant TTC',
      'Date encaissement', 'Mode règlement', 'N° pièce', 'Remarque', 'Statut'
    ],
    ...paiements.map(p => [
      p.numeroFacture,
      formatDate(p.dateFacture),
      p.clientNom,
      formatNum(p.montantHt),
      formatNum(p.montantTtc),
      formatDate(p.datePaiement),
      p.modeReglement ?? '',
      p.numeroPiece ?? '',
      p.remarque ?? '',
      p.estPayee ? 'Payée' : 'Non payée',
    ]),
    // Totaux
    [
      'TOTAL ENCAISSÉ', '', '',
      formatNum(payees.reduce((s, p) => s + p.montantHt, 0)),
      formatNum(payees.reduce((s, p) => s + p.montantTtc, 0)),
      '', '', '', '', ''
    ],
    [
      'TOTAL NON ENCAISSÉ', '', '',
      formatNum(nonPayees.reduce((s, p) => s + p.montantHt, 0)),
      formatNum(nonPayees.reduce((s, p) => s + p.montantTtc, 0)),
      '', '', '', '', ''
    ],
  ]

  const ws = utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 35 },
    { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 12 }
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Paiements')

  const date = new Date().toISOString().split('T')[0]
  writeFile(wb, `Paiements_${date}.xlsx`)
}

export async function exporterChargesExcel(charges: ChargeExcel[]): Promise<void> {
  const { utils, writeFile } = await import('xlsx')

  const data = [
    [
      'Date', 'N° Facture', 'Emetteur', 'Type de charge',
      'Montant HT', 'Taux TVA', 'Montant TVA', 'Montant TTC', 'Remarque'
    ],
    ...charges.map(c => [
      formatDate(c.dateCharge),
      c.numeroFacture ?? '',
      c.emetteur,
      c.typeCharge,
      formatNum(c.montantHt),
      `${c.tauxTva}%`,
      formatNum(c.montantTva),
      formatNum(c.montantTtc),
      c.remarque ?? '',
    ]),
    // Totaux
    [
      'TOTAUX', '', '', '',
      formatNum(charges.reduce((s, c) => s + c.montantHt, 0)),
      '',
      formatNum(charges.reduce((s, c) => s + c.montantTva, 0)),
      formatNum(charges.reduce((s, c) => s + c.montantTtc, 0)),
      ''
    ]
  ]

  const ws = utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 30 },
    { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 25 }
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Charges')

  const date = new Date().toISOString().split('T')[0]
  writeFile(wb, `Charges_${date}.xlsx`)
}
