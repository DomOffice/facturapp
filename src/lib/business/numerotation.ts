// src/lib/business/numerotation.ts
import prisma from '@/lib/db/prisma'

/**
 * Génère le prochain numéro de facture
 * Format : F2026/00001, F2026/00002, ...
 * Repart de 1 chaque année
 */
export async function prochainNumeroFacture(): Promise<{
  annee: number
  numeroSequence: number
  numeroFacture: string
}> {
  const annee = new Date().getFullYear()

  const derniere = await prisma.facture.findFirst({
    where: { annee },
    orderBy: { numeroSequence: 'desc' },
    select: { numeroSequence: true },
  })

  const numeroSequence = (derniere?.numeroSequence ?? 0) + 1
  const numeroFacture = `F${annee}/${String(numeroSequence).padStart(5, '0')}`

  return { annee, numeroSequence, numeroFacture }
}

/**
 * Génère le prochain numéro d'avoir
 * Format : AV2026/00001
 */
export async function prochainNumeroAvoir(): Promise<{
  annee: number
  numeroSequence: number
  numeroAvoir: string
}> {
  const annee = new Date().getFullYear()

  const dernier = await prisma.avoir.findFirst({
    where: { annee },
    orderBy: { numeroSequence: 'desc' },
    select: { numeroSequence: true },
  })

  const numeroSequence = (dernier?.numeroSequence ?? 0) + 1
  const numeroAvoir = `A${annee}/${String(numeroSequence).padStart(5, '0')}`

  return { annee, numeroSequence, numeroAvoir }
}

/**
 * Génère le prochain numéro de devis
 * Format : DV2026/00001
 */
export async function prochainNumeroDevis(): Promise<{
  annee: number
  numeroSequence: number
  numeroDevis: string
}> {
  const annee = new Date().getFullYear()

  const dernierDevis = await prisma.devis.findFirst({
    where: { annee },
    orderBy: { numeroSequence: 'desc' },
    select: { numeroSequence: true },
  })
  const numeroSequence = (dernierDevis?.numeroSequence ?? 0) + 1
  const numeroDevis = `D${annee}/${String(numeroSequence).padStart(5, '0')}`

  return { annee, numeroSequence, numeroDevis }
}
