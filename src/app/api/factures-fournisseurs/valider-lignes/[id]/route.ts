import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LignePayload = {
  reference?: string
  designation?: string
  quantite?: number
  prixUnitaireTtc?: number
  tauxTva?: number
  totalTtc?: number
  produitId?: number | null
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userRole = String(
      (session.user as { role?: string }).role || '',
    ).toLowerCase()

    if (!['admin', 'saisie'].includes(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const documentId = Number(params.id)

    if (!Number.isInteger(documentId) || documentId <= 0) {
      return NextResponse.json({ error: 'Document invalide' }, { status: 400 })
    }

    const body = await req.json()
    const lignes = Array.isArray(body?.lignes) ? body.lignes as LignePayload[] : []

    if (lignes.length === 0) {
      return NextResponse.json(
        { error: 'Aucune ligne à valider' },
        { status: 400 },
      )
    }

    const document = await prisma.documentImporte.findUnique({
      where: { id: documentId },
      select: { id: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document importé introuvable' },
        { status: 404 },
      )
    }

    const lignesValides = lignes
      .map((ligne) => ({
        referenceDetectee: ligne.reference?.trim() || null,
        designation: ligne.designation?.trim() || '',
        quantite: toNumber(ligne.quantite, 0),
        prixUnitaire: toNumber(ligne.prixUnitaireTtc, 0),
        tauxTva: toNumber(ligne.tauxTva, 0),
        montantTotal: toNumber(ligne.totalTtc, 0),
        produitId:
          Number.isInteger(Number(ligne.produitId)) && Number(ligne.produitId) > 0
            ? Number(ligne.produitId)
            : null,
      }))
      .filter((ligne) => ligne.designation.length > 0)

    if (lignesValides.length === 0) {
      return NextResponse.json(
        { error: 'Aucune ligne exploitable à enregistrer' },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.ligneImportee.deleteMany({
        where: { documentImporteId: documentId },
      })

      await tx.ligneImportee.createMany({
        data: lignesValides.map((ligne) => ({
          documentImporteId: documentId,
          ...ligne,
          statut: ligne.produitId ? 'associee' : 'a_rapprocher',
        })),
      })

      await tx.documentImporte.update({
        where: { id: documentId },
        data: { statut: 'lignes_validees' },
      })
    })

    return NextResponse.json({
      success: true,
      documentId,
      lignesEnregistrees: lignesValides.length,
    })
  } catch (error) {
    console.error('[VALIDER_LIGNES_FACTURE_FOURNISSEUR]', error)

    return NextResponse.json(
      { error: 'Erreur serveur lors de la validation des lignes' },
      { status: 500 },
    )
  }
}