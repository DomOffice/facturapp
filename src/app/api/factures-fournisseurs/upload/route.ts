import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { prisma } from '@/lib/db/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'factures-fournisseurs')

const MAX_SIZE_BYTES = 10 * 1024 * 1024

const MIME_AUTORISES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

const EXT_AUTORISEES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
}

function nettoyerNomFichier(valeur: string) {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userRole = String((session.user as { role?: string }).role || '').toLowerCase()

    if (!['admin', 'saisie'].includes(userRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const formData = await req.formData()

    const fichier = formData.get('fichier') as File | null
    const fournisseurId = Number(formData.get('fournisseurId'))
    const numeroFactureRaw = String(formData.get('numeroFacture') || 'sans-numero')

    if (!fichier) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
    }

    if (!Number.isInteger(fournisseurId) || fournisseurId <= 0) {
      return NextResponse.json({ error: 'Fournisseur invalide' }, { status: 400 })
    }

    if (!MIME_AUTORISES.includes(fichier.type)) {
      return NextResponse.json(
        { error: 'Format non autorisé. Formats acceptés : PDF, JPEG, PNG' },
        { status: 400 }
      )
    }

    if (fichier.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Taille maximale : 10 Mo' },
        { status: 400 }
      )
    }

    const fournisseur = await prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: {
        id: true,
        raisonSociale: true,
      },
    })

    if (!fournisseur) {
      return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })
    }

    const maintenant = new Date()
    const annee = String(maintenant.getFullYear())
    const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
    const dateFichier = maintenant.toISOString().slice(0, 10).replace(/-/g, '')

    const dossierDestination = path.join(UPLOAD_DIR, annee, mois)
    await mkdir(dossierDestination, { recursive: true })

    const extension = EXT_AUTORISEES[fichier.type]

    const numeroFacture = nettoyerNomFichier(numeroFactureRaw)
    const nomFournisseur = nettoyerNomFichier(fournisseur.raisonSociale)

    const nomStocke = `${dateFichier}_${numeroFacture}_${nomFournisseur}_${randomUUID().slice(0, 8)}${extension}`

    const cheminRelatif = path.join(annee, mois, nomStocke)
    const cheminComplet = path.join(UPLOAD_DIR, cheminRelatif)

    const buffer = Buffer.from(await fichier.arrayBuffer())
    await writeFile(cheminComplet, buffer)

    const utilisateurIdRaw = (session.user as { id?: string | number }).id
    const utilisateurId = utilisateurIdRaw ? Number(utilisateurIdRaw) : null

    const document = await prisma.documentImporte.create({
      data: {
        fournisseurId,
        nomFichierOriginal: fichier.name,
        nomFichierStocke: nomStocke,
        cheminFichier: cheminRelatif,
        typeMime: fichier.type,
        tailleFichier: fichier.size,
        statut: 'brouillon',
        utilisateurId: Number.isInteger(utilisateurId) ? utilisateurId : null,
      },
    })

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fichier: {
        nomOriginal: fichier.name,
        nomStocke,
        chemin: cheminRelatif,
        typeMime: fichier.type,
        taille: fichier.size,
      },
    })
  } catch (error) {
    console.error('[UPLOAD_FACTURE_FOURNISSEUR]', error)

    return NextResponse.json(
      { error: "Erreur serveur lors de l'upload" },
      { status: 500 }
    )
  }
}