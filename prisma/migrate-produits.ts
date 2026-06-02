// prisma/migrate-produits.ts
// Migration des produits (740) et lignes de facture (147)
// Lance avec : npx tsx prisma/migrate-produits.ts

import { PrismaClient } from '@prisma/client'
import { PRODUITS_DATA, DETAILS_DATA } from './migration-data'

const prisma = new PrismaClient()

async function main() {
  console.log('\n📦 Migration des produits et lignes de facture...')

  // Vider les tables
  await prisma.factureLigne.deleteMany({})
  await prisma.prixProduit.deleteMany({})
  await prisma.produit.deleteMany({})

  const [typesProduit, unites, tauxTvaParams] = await Promise.all([
    prisma.parametre.findMany({ where: { type: { code: 'type_produit' } }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'unite' } }, select: { id: true, libelle: true } }),
    prisma.parametre.findMany({ where: { type: { code: 'taux_tva' } }, select: { id: true, valeurNum: true } }),
  ])

  const typeProduitMap: Record<string, number> = {}
  for (const t of typesProduit) typeProduitMap[t.libelle.toLowerCase()] = t.id

  const uniteMap: Record<string, number> = {}
  for (const u of unites) uniteMap[u.libelle.toLowerCase()] = u.id

  const tauxTvaMap: Record<string, number> = {}
  for (const t of tauxTvaParams) {
    if (t.valeurNum !== null) tauxTvaMap[String(Number(t.valeurNum))] = t.id
  }

  function getTvaId(tauxDecimal: number): number | null {
    const pct = Math.round(tauxDecimal * 100)
    return tauxTvaMap[String(pct)] ?? tauxTvaMap['20'] ?? null
  }

  // ── 1. PRODUITS ──────────────────────────────────────────
  console.log(`Migration de ${PRODUITS_DATA.length} produits...`)
  let ok = 0, err = 0

  for (const row of PRODUITS_DATA) {
    const [id, reference, article, prixVenteHt, tauxTvaDecimal, , fournisseurId, unite, prixAchatHt] = row as [number, string, string, number, number, number, number|null, string|null, number|null, number|null]

    const tauxTvaVal = Math.round((tauxTvaDecimal ?? 0.20) * 100)
    const prixAchat = Number(prixAchatHt ?? 0)
    const prixVente = Number(prixVenteHt ?? 0)
    const marge = Math.round((prixVente - prixAchat) * 100) / 100
    const prixAchatTtc = Math.round(prixAchat * (1 + tauxTvaVal / 100) * 100) / 100
    const prixVenteTtc = Math.round(prixVente * (1 + tauxTvaVal / 100) * 100) / 100

    const refLower = String(reference ?? '').toLowerCase().trim()
    const typeProduitId = typeProduitMap[refLower] ?? null
    const uniteLower = String(unite ?? '').toLowerCase().trim()
    const uniteId = uniteLower ? (uniteMap[uniteLower] ?? null) : null
    const tauxTvaId = getTvaId(tauxTvaDecimal ?? 0.20)

    let fournisseurIdFinal: number | null = null
    if (fournisseurId) {
      const fExists = await prisma.fournisseur.findUnique({ where: { id: Number(fournisseurId) }, select: { id: true } })
      fournisseurIdFinal = fExists ? Number(fournisseurId) : null
    }

    try {
      await prisma.produit.create({
        data: {
          id: Number(id),
          reference: String(reference ?? '').trim(),
          description: String(article ?? '').trim(),
          typeProduitId,
          uniteId,
          tauxTvaId,
          fournisseurId: fournisseurIdFinal,
          dernierPrixAchatHt: prixAchat,
          dernierPrixAchatTtc: prixAchatTtc,
          prixVenteHt: prixVente,
          prixVenteTtc: prixVenteTtc,
          margeHt: marge,
          actif: true,
        },
      })
      ok++
    } catch (e) {
      err++
      if (err <= 5) console.error(`  ❌ Produit ${id}:`, e)
    }
  }

  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"produits"', 'id'), MAX(id)) FROM "produits"`
  console.log(`  ✅ ${ok} produits migres, ${err} erreurs`)

  // ── 2. LIGNES DE FACTURE ──────────────────────────────────
  console.log(`\nMigration de ${DETAILS_DATA.length} lignes de facture...`)
  let detOk = 0, detErr = 0

  for (let i = 0; i < DETAILS_DATA.length; i++) {
    const row = DETAILS_DATA[i]
    const [, factureId, produitId, designation, quantite, prixUnitaire, remisePct, remiseHt, tauxTvaDecimal, totalHt, totalHtNet] = row as [number, number, number, string, number, number, number, number, number, number, number]

    const tauxTvaVal = Math.round((tauxTvaDecimal ?? 0.20) * 100)
    const montantHt = Number(totalHtNet ?? totalHt ?? 0)
    const montantTva = Math.round(montantHt * tauxTvaVal / 100 * 100) / 100
    const montantTtc = Math.round((montantHt + montantTva) * 100) / 100

    // Verifier que la facture existe
    const factureExists = await prisma.facture.findUnique({ where: { id: Number(factureId) }, select: { id: true } })
    if (!factureExists) {
      detErr++
      continue
    }

    const prodExists = await prisma.produit.findUnique({ where: { id: Number(produitId) }, select: { id: true, dernierPrixAchatHt: true } })

    try {
      await prisma.factureLigne.create({
        data: {
          factureId: Number(factureId),
          ordreLigne: i + 1,
          produitId: prodExists ? Number(produitId) : null,
          designation: String(designation ?? '').trim(),
          quantite: Number(quantite ?? 1),
          prixAchatHt: prodExists ? Number(prodExists.dernierPrixAchatHt) : 0,
          prixUnitaireHt: Number(prixUnitaire ?? 0),
          remisePourcentage: Math.round(Number(remisePct ?? 0) * 100 * 100) / 100,
          montantRemiseHt: Number(remiseHt ?? 0),
          tauxTva: tauxTvaVal,
          montantHt,
          montantTva,
          montantTtc,
        },
      })
      detOk++
    } catch (e) {
      detErr++
      if (detErr <= 5) console.error(`  ❌ Ligne facture ${factureId}:`, e)
    }
  }

  // Mettre a jour totalLignes et totalArticles dans factures
  const factures = await prisma.facture.findMany({ select: { id: true } })
  for (const f of factures) {
    const lignes = await prisma.factureLigne.findMany({ where: { factureId: f.id } })
    await prisma.facture.update({
      where: { id: f.id },
      data: {
        totalLignes: lignes.length,
        totalArticles: lignes.reduce((s, l) => s + Number(l.quantite), 0),
      },
    })
  }

  console.log(`  ✅ ${detOk} lignes migrees, ${detErr} erreurs`)

  // RÉSUMÉ FINAL
  const stats = await Promise.all([
    prisma.client.count(),
    prisma.fournisseur.count(),
    prisma.produit.count(),
    prisma.facture.count(),
    prisma.factureLigne.count(),
    prisma.paiement.count(),
  ])

  console.log('\n' + '═'.repeat(50))
  console.log('🎉 MIGRATION COMPLETE !')
  console.log('═'.repeat(50))
  console.log(`  Clients       : ${stats[0]}`)
  console.log(`  Fournisseurs  : ${stats[1]}`)
  console.log(`  Produits      : ${stats[2]}`)
  console.log(`  Factures      : ${stats[3]}`)
  console.log(`  Lignes        : ${stats[4]}`)
  console.log(`  Paiements     : ${stats[5]}`)
  console.log('\n→ Ouvre http://localhost:3000 et verifie tes donnees !')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
