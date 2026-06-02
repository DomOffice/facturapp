// src/app/(dashboard)/charges/page.tsx
import prisma from '@/lib/db/prisma'
import ChargesClient from './page-client'

export const dynamic = 'force-dynamic'

export default async function ChargesPage() {
  const [charges, typesCharge, tauxTva] = await Promise.all([
    prisma.charge.findMany({
      include: { typeCharge: { select: { libelle: true } } },
      orderBy: { dateCharge: 'desc' },
    }),
    prisma.parametre.findMany({
      where: { type: { code: 'type_charge' }, actif: true },
      orderBy: { ordreAffichage: 'asc' },
      select: { id: true, libelle: true },
    }),
    prisma.parametre.findMany({
      where: { type: { code: 'taux_tva' }, actif: true },
      orderBy: { ordreAffichage: 'asc' },
      select: { id: true, libelle: true, valeurNum: true },
    }),
  ])

  const totalTtc = charges.reduce((s, c) => s + Number(c.montantTtc), 0)

  return (
    <ChargesClient
      charges={charges.map(c => ({
        id: c.id,
        dateCharge: c.dateCharge.toISOString(),
        numeroFacture: c.numeroFacture,
        emetteur: c.emetteur,
        typeChargeLibelle: c.typeCharge.libelle,
        typeChargeId: c.typeChargeId,
        montantHt: Number(c.montantHt),
        tauxTva: Number(c.tauxTva),
        montantTva: Number(c.montantTva),
        montantTtc: Number(c.montantTtc),
        remarque: c.remarque,
      }))}
      typesCharge={typesCharge}
      tauxTva={tauxTva.map(t => ({ ...t, valeurNum: t.valeurNum ? Number(t.valeurNum) : null }))}
      totalTtc={totalTtc}
    />
  )
}
