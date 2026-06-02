// src/app/(dashboard)/parametres/page.tsx
import prisma from '@/lib/db/prisma'
import ParametresClient from './page-client'
export const dynamic = 'force-dynamic'

export default async function ParametresPage() {
  const [types, parametres] = await Promise.all([
    prisma.parametreType.findMany({ orderBy: { nom: 'asc' } }),
    prisma.parametre.findMany({
      include: { type: { select: { nom: true, code: true } } },
      orderBy: [{ typeId: 'asc' }, { ordreAffichage: 'asc' }],
    }),
  ])

  return (
    <ParametresClient
      types={types}
      parametres={parametres.map(p => ({
        id: p.id,
        typeId: p.typeId,
        typeNom: p.type.nom,
        typeCode: p.type.code,
        code: p.code,
        libelle: p.libelle,
        valeurNum: p.valeurNum ? Number(p.valeurNum) : null,
        actif: p.actif,
      }))}
    />
  )
}
