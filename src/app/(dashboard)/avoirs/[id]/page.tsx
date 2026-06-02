// src/app/(dashboard)/avoirs/[id]/page.tsx
export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/db/prisma'
import { formatMontant } from '@/lib/utils/currency'
import AvoirActions from './avoir-actions'

export default async function AvoirDetailPage({ params }: { params: { id: string } }) {
  const [avoir, entreprise] = await Promise.all([
    prisma.avoir.findUnique({
      where: { id: Number(params.id) },
      include: {
        client: true,
        facture: { select: { numeroFacture: true } },
        lignes: { orderBy: { id: 'asc' } },
      },
    }),
    prisma.entreprise.findFirst(),
  ])
  if (!avoir) notFound()

  const avoirData = {
    id: avoir.id,
    numeroFacture: avoir.numeroAvoir,
    typeDoc: 'avoir' as const,
    dateFacture: avoir.dateAvoir.toISOString(),
    client: {
      id: avoir.client.id,
      raisonSociale: avoir.client.raisonSociale,
      adresse: avoir.client.adresse,
      codePostal: avoir.client.codePostal,
      ville: avoir.client.ville,
      telephone: avoir.client.telephone,
      ice: avoir.client.ice,
      email: avoir.client.email,
    },
    lignes: avoir.lignes.map((l, i) => ({
      ordreLigne: i + 1,
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaireHt: Number(l.prixUnitaireHt),
      remisePourcentage: Number(l.remisePourcentage),
      tauxTva: Number(l.tauxTva),
      montantHt: Number(l.montantHt),
      montantTva: Number(l.montantTva),
      montantTtc: Number(l.montantTtc),
    })),
    totalHt: Number(avoir.totalHt),
    totalTva: Number(avoir.totalTva),
    totalTtc: Number(avoir.totalTtc),
    totalArticles: avoir.lignes.length,
    totalLignes: avoir.lignes.length,
  }

  const entrepriseData = entreprise ? {
    raisonSociale: entreprise.raisonSociale,
    adresse: entreprise.adresse,
    codePostal: entreprise.codePostal,
    ville: entreprise.ville,
    telephone: entreprise.telephone,
    email: entreprise.email,
    ice: entreprise.ice,
    identifiantFiscal: entreprise.identifiantFiscal,
    rc: entreprise.rc,
    patente: entreprise.patente,
    logoUrl: entreprise.logoUrl,
    compteBancaire: entreprise.compteBancaire,
  } : { raisonSociale: 'Ma Société', adresse: null, codePostal: null, ville: null, telephone: null, email: null, ice: null, identifiantFiscal: null, rc: null, patente: null, logoUrl: null, compteBancaire: null }

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title font-mono text-amber-600">{avoir.numeroAvoir}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="badge badge-warning">Avoir</span>
            <span className="text-sm text-slate-400">→ Facture
              <Link href={`/factures/${avoir.factureId}`} className="text-indigo-600 font-mono ml-1 hover:underline">
                {avoir.facture.numeroFacture}
              </Link>
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link href="/avoirs" className="btn-ghost btn-sm">← Retour</Link>
          <Link href={`/avoirs/${avoir.id}/modifier`} className="btn-secondary btn-sm">
            Modifier
          </Link>
          <AvoirActions avoir={avoirData} entreprise={entrepriseData} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Client</div>
          <div className="font-semibold text-slate-800">{avoir.client.raisonSociale}</div>
          {avoir.client.adresse && <div className="text-sm text-slate-500 mt-1">{avoir.client.adresse}</div>}
          {avoir.client.ville && <div className="text-sm text-slate-500">{avoir.client.codePostal} {avoir.client.ville}</div>}
          {avoir.client.telephone && <div className="text-sm text-slate-500">{avoir.client.telephone}</div>}
          {avoir.client.ice && <div className="text-xs text-slate-400 mt-1 font-mono">ICE: {avoir.client.ice}</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Avoir</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Date :</span><span className="font-medium">{new Date(avoir.dateAvoir).toLocaleDateString('fr-FR')}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Nb lignes :</span><span>{avoir.lignes.length}</span></div>
          </div>
        </div>
        <div className="card p-4 bg-amber-50 border-amber-200">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Totaux</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total HT :</span><span>{formatMontant(Number(avoir.totalHt))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total TVA :</span><span>{formatMontant(Number(avoir.totalTva))}</span></div>
            <div className="flex justify-between text-base border-t border-amber-200 pt-1 mt-1">
              <span className="font-semibold text-amber-700">Total TTC :</span>
              <span className="font-bold text-amber-700">{formatMontant(Number(avoir.totalTtc))} MAD</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Lignes de l'avoir</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Désignation</th><th>Quantité</th><th>PU HT</th><th>TVA %</th><th>Montant HT</th><th>Montant TTC</th></tr>
            </thead>
            <tbody>
              {avoir.lignes.map((l, i) => (
                <tr key={l.id}>
                  <td className="text-slate-400 text-xs">{i + 1}</td>
                  <td className="font-medium">{l.designation}</td>
                  <td>{Number(l.quantite)}</td>
                  <td>{formatMontant(Number(l.prixUnitaireHt))}</td>
                  <td>{Number(l.tauxTva)}%</td>
                  <td>{formatMontant(Number(l.montantHt))}</td>
                  <td className="font-semibold text-amber-600">{formatMontant(Number(l.montantTtc))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
