// prisma/migrate-numerotation.ts
// Migre les anciens numéros F00001 → F2026/00001
// Lance avec : npx tsx prisma/migrate-numerotation.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔢 Migration des numéros de factures...\n')

  const factures = await prisma.facture.findMany({
    select: { id: true, numeroFacture: true, annee: true, numeroSequence: true, dateFacture: true },
    orderBy: { id: 'asc' },
  })

  let modifiees = 0
  let dejaMigrees = 0

  for (const f of factures) {
    // Si déjà au nouveau format (contient /)
    if (f.numeroFacture.includes('/')) {
      dejaMigrees++
      continue
    }

    // Extraire l'année depuis la date de facture
    const annee = new Date(f.dateFacture).getFullYear()
    const nouveauNumero = `F${annee}/${String(f.numeroSequence).padStart(5, '0')}`

    await prisma.facture.update({
      where: { id: f.id },
      data: {
        numeroFacture: nouveauNumero,
        annee: annee,
      },
    })

    console.log(`  ${f.numeroFacture} → ${nouveauNumero}`)
    modifiees++
  }

  console.log(`\n✅ ${modifiees} factures migrées`)
  console.log(`   ${dejaMigrees} factures déjà au bon format`)

  // Même chose pour les avoirs si existants
  const avoirs = await prisma.avoir.findMany({
    select: { id: true, numeroAvoir: true, annee: true, numeroSequence: true, dateAvoir: true },
  })

  for (const a of avoirs) {
    if (a.numeroAvoir.includes('/')) continue
    const annee = new Date(a.dateAvoir).getFullYear()
    const nouveauNumero = `AV${annee}/${String(a.numeroSequence).padStart(5, '0')}`
    await prisma.avoir.update({
      where: { id: a.id },
      data: { numeroAvoir: nouveauNumero, annee },
    })
    console.log(`  Avoir: ${a.numeroAvoir} → ${nouveauNumero}`)
  }

  console.log('\n🎉 Migration terminée !')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
