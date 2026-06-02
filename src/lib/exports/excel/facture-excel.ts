// src/lib/exports/excel/facture-excel.ts
// Export Excel d'une facture — mise en page similaire au PDF

type LigneExcel = {
  ordreLigne: number
  designation: string
  quantite: number
  prixUnitaireHt: number
  remisePourcentage: number
  montantRemiseHt?: number
  tauxTva: number
  montantHt: number
  montantTva?: number
  montantTtc: number
}

type FactureExcelDetail = {
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
  }
  lignes: LigneExcel[]
  totalHt: number
  totalTva: number
  totalTtc: number
  totalArticles: number
  totalLignes: number
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
}

function montantEnLettres(montant: number): string {
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']
  function centaines(n: number): string {
    if (n === 0) return ''
    if (n < 20) return unites[n]
    const d = Math.floor(n / 10), u = n % 10
    if (d === 7) return 'soixante-' + unites[10 + u]
    if (d === 9) return 'quatre-vingt-' + (u === 0 ? '' : unites[u])
    return dizaines[d] + (u === 1 && d !== 8 ? '-et-' : u ? '-' : '') + unites[u]
  }
  function parCentaines(n: number): string {
    if (n === 0) return 'zéro'
    const c = Math.floor(n / 100), r = n % 100
    const pc = c === 0 ? '' : c === 1 ? 'cent' : unites[c] + ' cent' + (r === 0 ? 's' : '')
    return (pc + (r ? ' ' + centaines(r) : '')).trim()
  }
  const entier = Math.floor(montant)
  const cents = Math.round((montant - entier) * 100)
  const milliers = Math.floor(entier / 1000)
  const reste = entier % 1000
  let result = ''
  if (milliers > 0) result += milliers === 1 ? 'mille' : parCentaines(milliers) + ' mille'
  if (reste > 0) result += (result ? ' ' : '') + parCentaines(reste)
  if (!result) result = 'zéro'
  result = result.charAt(0).toUpperCase() + result.slice(1) + ' Dirhams'
  if (cents > 0) result += ' ' + parCentaines(cents) + ' Cents'
  return result
}

export async function exporterFactureExcel(
  facture: FactureExcelDetail,
  entreprise: Entreprise
): Promise<void> {
  const { utils, writeFile } = await import('xlsx')
  const wb = utils.book_new()
  const rows: unknown[][] = []

  rows.push([entreprise.raisonSociale])
  if (entreprise.adresse) rows.push([entreprise.adresse])
  const villeCP = [entreprise.codePostal, entreprise.ville].filter(Boolean).join(' ')
  if (villeCP) rows.push([villeCP])
  if (entreprise.telephone) rows.push([`Tél : ${entreprise.telephone}`])
  if (entreprise.email) rows.push([`Email : ${entreprise.email}`])
  const idFiscaux = [
    entreprise.patente ? `Patente : ${entreprise.patente}` : '',
    entreprise.identifiantFiscal ? `IF : ${entreprise.identifiantFiscal}` : '',
    entreprise.rc ? `RC : ${entreprise.rc}` : '',
    entreprise.ice ? `ICE : ${entreprise.ice}` : '',
  ].filter(Boolean).join('   ')
  if (idFiscaux) rows.push([idFiscaux])
  if (entreprise.compteBancaire) rows.push([`Compte : ${entreprise.compteBancaire}`])
  rows.push([])

  rows.push([`FACTURE N°  ${facture.numeroFacture}`, '', '', '', '', '', '', `Date : ${new Date(facture.dateFacture).toLocaleDateString('fr-FR')}`])
  rows.push([])

  rows.push(['FACTURÉ À :'])
  rows.push([facture.client.raisonSociale])
  if (facture.client.adresse) rows.push([facture.client.adresse])
  const villeClient = [facture.client.codePostal, facture.client.ville].filter(Boolean).join(' ')
  if (villeClient) rows.push([villeClient])
  if (facture.client.telephone) rows.push([`Tél : ${facture.client.telephone}`])
  if (facture.client.ice) rows.push([`ICE : ${facture.client.ice}`])
  rows.push([])

  rows.push(['Référence', 'Description', 'Unité', 'PU HT', 'Quantité', 'Remise %', 'Remise HT', 'TVA %', 'Montant HT', 'Montant TTC'])

  for (const l of facture.lignes) {
    rows.push([
      String(l.ordreLigne), l.designation, '',
      l.prixUnitaireHt, l.quantite,
      l.remisePourcentage, l.montantRemiseHt ?? 0,
      l.tauxTva, l.montantHt, l.montantTtc,
    ])
  }
  rows.push([])

  rows.push(['', '', '', '', '', '', '', 'HT MAD', '', facture.totalHt])

  const tvaParTaux: Record<string, number> = {}
  for (const l of facture.lignes) {
    const k = String(l.tauxTva)
    tvaParTaux[k] = (tvaParTaux[k] ?? 0) + l.montantHt * l.tauxTva / 100
  }
  for (const [taux, montant] of Object.entries(tvaParTaux).sort(([a], [b]) => Number(a) - Number(b))) {
    if (Number(taux) > 0) {
      rows.push(['', '', '', '', '', '', '', `TVA ${taux}% :`, '', Math.round(montant * 100) / 100])
    }
  }

  rows.push(['', '', '', '', '', '', '', 'Total HT :', '', facture.totalHt])
  rows.push(['', '', '', '', '', '', '', 'Total TVA :', '', facture.totalTva])
  rows.push(['', '', '', '', '', '', '', 'TOTAL TTC :', '', facture.totalTtc])
  rows.push([])
  rows.push([`Arrêté la présente facture à ${montantEnLettres(facture.totalTtc)}`])
  rows.push(['Merci pour votre confiance'])
  rows.push(['Sauf erreur ou omission'])

  const ws = utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 14 }, { wch: 38 }, { wch: 10 }, { wch: 14 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
  ]

  const numSafe = facture.numeroFacture.replace(/\//g, '-')
  const nomSafe = facture.client.raisonSociale.replace(/[/\\?%*:|"<>]/g, '_')
  utils.book_append_sheet(wb, ws, `Facture ${numSafe}`.slice(0, 31))
  writeFile(wb, `${numSafe} - ${nomSafe}.xlsx`)
}
