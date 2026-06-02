// prisma/migrate-from-mysql.ts
// Script de migration MariaDB -> PostgreSQL
// Toutes les donnees viennent de migration-data.ts (extrait du vrai fichier SQL)
// Lance avec : npx tsx prisma/migrate-from-mysql.ts

import { PrismaClient } from '@prisma/client'
import { CLIENTS_DATA, FOURNISSEURS_DATA, FACTURES_DATA, PAIEMENTS_DATA } from './migration-data'

const prisma = new PrismaClient()

function nettoyer(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (s === '' || s === '0' || s.toLowerCase() === 'null') return null
  return s
}

function formaterNumero(num: string | number): string {
  const n = parseInt(String(num))
  return `F${String(n).padStart(5, '0')}`
}

async function main() {
  console.log('\n🚀 Debut de la migration MariaDB → PostgreSQL')
  console.log('⚠️  Suppression des donnees existantes...\n')

  // Supprimer dans le bon ordre (contraintes FK)
  await prisma.journalAudit.deleteMany({})
  await prisma.avoirLigne.deleteMany({})
  await prisma.avoir.deleteMany({})
  await prisma.factureLigne.deleteMany({})
  await prisma.paiement.deleteMany({})
  await prisma.facture.deleteMany({})
  await prisma.prixProduit.deleteMany({})
  await prisma.produit.deleteMany({})
  await prisma.client.deleteMany({})
  await prisma.fournisseur.deleteMany({})
  console.log('  ✅ Tables videes')

  // Recuperer les parametres types clients
  const parametresTypeClient = await prisma.parametre.findMany({
    where: { type: { code: 'type_client' } },
    select: { id: true, libelle: true },
  })
  const typeClientIdMap: Record<string, number> = {}
  for (const p of parametresTypeClient) typeClientIdMap[p.libelle] = p.id

  // ── 1. CLIENTS ─────────────────────────────────────────────
  console.log(`\n👥 Migration de ${CLIENTS_DATA.length} clients...`)
  let ok = 0

  for (const row of CLIENTS_DATA) {
    const [id, typeClient, nom, adresse, , ville, telephone, , ice, email] = row as [number, string|null, string, string, string, string, string, string, string, string]
    const typeClientId = typeClient ? (typeClientIdMap[typeClient] ?? null) : null
    const villeNette = nettoyer(ville)

    try {
      await prisma.client.create({
        data: {
          id: Number(id),
          typeClientId,
          raisonSociale: String(nom).trim(),
          adresse: nettoyer(adresse),
          ville: villeNette === 'Null' ? null : villeNette,
          telephone: nettoyer(telephone),
          ice: nettoyer(ice) === '0' ? null : nettoyer(ice),
          email: nettoyer(email),
          actif: true,
        },
      })
      ok++
    } catch (e) {
      console.error(`  ❌ Client ${id} (${nom}):`, e)
    }
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"clients"', 'id'), MAX(id)) FROM "clients"`
  console.log(`  ✅ ${ok} clients migres`)

  // ── 2. FOURNISSEURS ────────────────────────────────────────
  console.log(`\n🏭 Migration de ${FOURNISSEURS_DATA.length} fournisseurs...`)
  ok = 0

  for (const row of FOURNISSEURS_DATA) {
    const [id, , nom, adresse, , ville, telephone, , , ice, email] = row as [number, null, string, string, string, string, string, string, string, string, string]
    try {
      await prisma.fournisseur.create({
        data: {
          id: Number(id),
          raisonSociale: String(nom).trim(),
          adresse: nettoyer(adresse),
          ville: nettoyer(ville),
          telephone: nettoyer(telephone),
          ice: nettoyer(ice),
          email: nettoyer(email),
          actif: true,
        },
      })
      ok++
    } catch (e) {
      console.error(`  ❌ Fournisseur ${id}:`, e)
    }
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"fournisseurs"', 'id'), MAX(id)) FROM "fournisseurs"`
  console.log(`  ✅ ${ok} fournisseurs migres`)

  // ── 3. FACTURES ────────────────────────────────────────────
  console.log(`\n🧾 Migration de ${FACTURES_DATA.length} factures...`)
  ok = 0

  for (const row of FACTURES_DATA) {
    const [id, numeroFacture, clientId, dateFacture, totalHt, totalTtc] = row as [number, string, number, string, number, number]
    const totalHtNum = Number(totalHt)
    const totalTtcNum = Number(totalTtc)
    const totalTva = Math.round((totalTtcNum - totalHtNum) * 100) / 100
    const annee = new Date(dateFacture).getFullYear()
    const numeroFormate = formaterNumero(numeroFacture)

    try {
      await prisma.facture.create({
        data: {
          id: Number(id),
          numeroFacture: numeroFormate,
          annee,
          numeroSequence: Number(numeroFacture),
          clientId: Number(clientId),
          dateFacture: new Date(dateFacture),
          statut: 'validee',
          totalHt: totalHtNum,
          totalTva,
          totalTtc: totalTtcNum,
          impressionStatut: 'OK',
        },
      })
      ok++
    } catch (e) {
      console.error(`  ❌ Facture ${id} (${numeroFormate}):`, e)
    }
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"factures"', 'id'), MAX(id)) FROM "factures"`
  console.log(`  ✅ ${ok} factures migrees`)

  // ── 4. PAIEMENTS ───────────────────────────────────────────
  console.log(`\n💰 Migration de ${PAIEMENTS_DATA.length} paiements...`)
  ok = 0

  const modeMap: Record<string, string> = {
    'cheque': 'Chèque', 'chèque': 'Chèque',
    'espece': 'Espèces', 'espèce': 'Espèces', 'especes': 'Espèces',
    'virement': 'Virement',
    'effet': 'Effet',
  }

  for (const row of PAIEMENTS_DATA) {
    const [, factureId, montantHt, montantTtc, datePaiement, moyenPaiement, numeroPiece, remarques] = row as [number, number, number, number, string|null, string|null, string|null, string|null]

    let modeReglementId: number | null = null
    if (moyenPaiement) {
      const modeNorm = moyenPaiement.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const modeLibelle = Object.entries(modeMap).find(([k]) => modeNorm.includes(k))?.[1]
      if (modeLibelle) {
        const mode = await prisma.parametre.findFirst({
          where: { type: { code: 'mode_reglement' }, libelle: { contains: modeLibelle } },
        })
        modeReglementId = mode?.id ?? null
      }
    }

    try {
      await prisma.paiement.create({
        data: {
          factureId: Number(factureId),
          datePaiement: datePaiement ? new Date(datePaiement) : null,
          modeReglementId,
          numeroPiece: nettoyer(numeroPiece),
          remarque: nettoyer(remarques),
          montantHt: Number(montantHt),
          montantTtc: Number(montantTtc),
        },
      })
      ok++
    } catch (e) {
      console.error(`  ❌ Paiement facture ${factureId}:`, e)
    }
  }
  console.log(`  ✅ ${ok} paiements migres`)

  // ── RÉSUMÉ ─────────────────────────────────────────────────
  const stats = await Promise.all([
    prisma.client.count(),
    prisma.fournisseur.count(),
    prisma.facture.count(),
    prisma.paiement.count(),
  ])

  console.log('\n' + '═'.repeat(50))
  console.log('✅ MIGRATION PRINCIPALE TERMINEE')
  console.log('═'.repeat(50))
  console.log(`  Clients      : ${stats[0]}`)
  console.log(`  Fournisseurs : ${stats[1]}`)
  console.log(`  Factures     : ${stats[2]}`)
  console.log(`  Paiements    : ${stats[3]}`)
  console.log('\n→ Lance maintenant : npx tsx prisma/migrate-produits.ts')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
