// scripts/sync-pg-to-mariadb.ts
// Synchronisation PostgreSQL (FacturApp) → MariaDB (VB6 backup)
// Sens : PostgreSQL = source de vérité → MariaDB = miroir lecture seule pour VB6
//
// CORRECTIONS APPLIQUÉES (v2) :
//   1. compte_bancaire aliasé en rib (colonne renommée dans Prisma)
//   2. Tables devis/avoir/devis_details/avoir_details ignorées si absentes dans MariaDB
//   3. Commentaire tauxTva ajouté pour vérification avant 1er lancement
//
// INSTALLATION :
//   npm install pg mysql2 @types/pg --save-dev
//
// VARIABLES D'ENV (ajouter dans ecosystem.config.js) :
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
//   MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
//
// LANCEMENT MANUEL :
//   npx tsx scripts/sync-pg-to-mariadb.ts
//
// ⚠️  AVANT LE 1ER LANCEMENT : vérifier format TVA dans MariaDB :
//   SELECT taux_tva FROM produits LIMIT 3;
//   → 0.20 = OK (garder /100)  |  20.00 = retirer le /100 dans buildLookups

import { Pool } from 'pg'
import mysql from 'mysql2/promise'

/**
 * V1 - Synchronisation PostgreSQL -> MariaDB
 *
 * Source de vérité   : PostgreSQL
 * Cible miroir VB6   : MariaDB
 * Stratégie          : full sync simple, sans DELETE global
 * Hors périmètre V1  : bon_commande / bon_commande_details
 *
 * Pré-requis npm:
 *   npm i pg mysql2 dotenv
 *
 * Variables d'environnement attendues:
 *   PGHOST=127.0.0.1
 *   PGPORT=5432
 *   PGDATABASE=facturapp_db
 *   PGUSER=postgres
 *   PGPASSWORD=secret
 *
 *   MYSQL_HOST=127.0.0.1
 *   MYSQL_PORT=3306
 *   MYSQL_DATABASE=erp2026
 *   MYSQL_USER=root
 *   MYSQL_PASSWORD=secret
 */

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback
  if (v === undefined) throw new Error(`Variable d'environnement manquante: ${name}`)
  return v
}

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function toNullableDate(v: unknown): string | null {
  if (!v) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function toNumber(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function keepMariaString(next: string | null | undefined, current: unknown): string | null {
  if (next !== null && next !== undefined) return next
  return toNullableString(current)
}

function coeffMarge(prixAchatHt: number, prixVenteHt: number, margeHtPg?: number): number {
  if (prixAchatHt > 0) return round2(prixVenteHt / prixAchatHt)
  if (margeHtPg !== undefined && Number.isFinite(margeHtPg)) return round2(margeHtPg)
  return 0
}


// Ignore gracieusement les tables absentes dans MariaDB
async function syncOptional(tableName: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("doesn't exist") || msg.includes("ER_NO_SUCH_TABLE") || msg.includes("Table")) {
      console.log(`  ⚠️  Table MariaDB "${tableName}" absente — ignorée`)
    } else {
      throw err
    }
  }
}

async function main(): Promise<void> {
  const pg = new Pool({
    host: env('PGHOST', '127.0.0.1'),
    port: Number(env('PGPORT', '5432')),
    database: env('PGDATABASE'),
    user: env('PGUSER'),
    password: env('PGPASSWORD'),
  })

  const mysqlConn = await mysql.createConnection({
    host: env('MYSQL_HOST', '127.0.0.1'),
    port: Number(env('MYSQL_PORT', '3306')),
    database: env('MYSQL_DATABASE'),
    user: env('MYSQL_USER'),
    password: env('MYSQL_PASSWORD'),
    decimalNumbers: true,
    namedPlaceholders: true,
  })

  console.log('🚀 Début sync PostgreSQL -> MariaDB')

  try {
    await mysqlConn.beginTransaction()

    const lookups = await buildLookups(pg)

    await syncParametres(pg, mysqlConn)
    await syncEntreprise(pg, mysqlConn)
    await syncClients(pg, mysqlConn, lookups)
    await syncFournisseurs(pg, mysqlConn, lookups)
    await syncProduits(pg, mysqlConn, lookups)
    await syncPrixProduits(pg, mysqlConn)
    await syncFactures(pg, mysqlConn)
    await syncFactureLignes(pg, mysqlConn, lookups)
    // Tables optionnelles — créées dans PostgreSQL mais absentes de VB6
    await syncOptional('devis', () => syncDevis(pg, mysqlConn))
    await syncOptional('devis_details', () => syncDevisLignes(pg, mysqlConn, lookups))
    await syncOptional('avoirs', () => syncAvoirs(pg, mysqlConn))
    await syncOptional('avoir_details', () => syncAvoirLignes(pg, mysqlConn, lookups))
    await syncPaiements(pg, mysqlConn, lookups)

    await reseedMariaIdentity(mysqlConn)
    await mysqlConn.commit()
    console.log('✅ Synchronisation terminée')
  } catch (err) {
    await mysqlConn.rollback()
    console.error('❌ Echec sync:', err)
    process.exitCode = 1
  } finally {
    await mysqlConn.end()
    await pg.end()
  }
}

type LookupMaps = {
  typeClientById: Map<number, string>
  typeFournisseurById: Map<number, string>
  uniteById: Map<number, string>
  modeReglementById: Map<number, string>
  tauxTvaById: Map<number, number>
}

async function buildLookups(pg: Pool): Promise<LookupMaps> {
  const sql = `
    SELECT p.id, pt.code AS type_code, p.libelle, p.valeur_num
    FROM public.parametres p
    JOIN public.parametre_types pt ON pt.id = p.type_id
  `
  const { rows } = await pg.query(sql)

  const typeClientById = new Map<number, string>()
  const typeFournisseurById = new Map<number, string>()
  const uniteById = new Map<number, string>()
  const modeReglementById = new Map<number, string>()
  const tauxTvaById = new Map<number, number>()

  for (const r of rows) {
    const id = Number(r.id)
    const typeCode = String(r.type_code)
    const libelle = toNullableString(r.libelle) ?? ''
    const valeurNum = r.valeur_num === null ? null : Number(r.valeur_num)

    if (typeCode === 'type_client') typeClientById.set(id, libelle)
    else if (typeCode === 'type_fournisseur') typeFournisseurById.set(id, libelle)
    else if (typeCode === 'unite') uniteById.set(id, libelle)
    else if (typeCode === 'mode_reglement') modeReglementById.set(id, libelle)
    else if (typeCode === 'taux_tva' && valeurNum !== null) {
      // valeurNum est en % (ex: 20 pour 20%)
      // MariaDB VB6 stocke 0.20 → on divise par 100. Si ta MariaDB stocke 20.00, retire le /100
      tauxTvaById.set(id, valeurNum / 100)
    }
  }

  return { typeClientById, typeFournisseurById, uniteById, modeReglementById, tauxTvaById }
}

async function syncParametres(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync parametres')
  const { rows } = await pg.query(`
    SELECT p.id, pt.code AS categorie, p.libelle AS valeur
    FROM public.parametres p
    JOIN public.parametre_types pt ON pt.id = p.type_id
    ORDER BY p.id
  `)

  for (const r of rows) {
    await db.execute(
      `INSERT INTO parametres (id, categorie, valeur)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         categorie = VALUES(categorie),
         valeur = VALUES(valeur)`,
      [Number(r.id), toNullableString(r.categorie), toNullableString(r.valeur)]
    )
  }
}

async function syncEntreprise(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync entreprise')
  const { rows } = await pg.query(`
    SELECT id, raison_sociale, adresse, code_postal, ville, telephone,
           patente, rc, ice, identifiant_fiscal, devise, email, compte_bancaire AS rib
    FROM public.entreprise
    ORDER BY id
  `)

  for (const r of rows) {
    await db.execute(
      `INSERT INTO entreprise
       (id, nom, adresse, code_postal, ville, telephone, patente, rc, ice, identifiant_fiscal, devise, email, rib)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nom = VALUES(nom),
         adresse = VALUES(adresse),
         code_postal = VALUES(code_postal),
         ville = VALUES(ville),
         telephone = VALUES(telephone),
         patente = VALUES(patente),
         rc = VALUES(rc),
         ice = VALUES(ice),
         identifiant_fiscal = VALUES(identifiant_fiscal),
         devise = VALUES(devise),
         email = VALUES(email),
         rib = VALUES(rib)`,
      [
        Number(r.id),
        toNullableString(r.raison_sociale),
        toNullableString(r.adresse),
        toNullableString(r.code_postal),
        toNullableString(r.ville),
        toNullableString(r.telephone),
        toNullableString(r.patente),
        toNullableString(r.rc),
        toNullableString(r.ice),
        toNullableString(r.identifiant_fiscal),
        toNullableString(r.devise),
        toNullableString(r.email),
        toNullableString(r.rib),
      ]
    )
  }
}

async function syncClients(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync clients')
  const { rows } = await pg.query(`
    SELECT id, type_client_id, raison_sociale, adresse, code_postal, ville, telephone, ice, email
    FROM public.clients
    ORDER BY id
  `)

  for (const r of rows) {
    const [[current]] = await db.query<any[]>(
      `SELECT portable, adresse_livraison, remarques FROM clients WHERE id = ?`,
      [Number(r.id)]
    )

    await db.execute(
      `INSERT INTO clients
       (id, type_client, nom, adresse, code_postal, ville, telephone, portable, ice, email, adresse_livraison, remarques)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         type_client = VALUES(type_client),
         nom = VALUES(nom),
         adresse = VALUES(adresse),
         code_postal = VALUES(code_postal),
         ville = VALUES(ville),
         telephone = VALUES(telephone),
         portable = VALUES(portable),
         ice = VALUES(ice),
         email = VALUES(email),
         adresse_livraison = VALUES(adresse_livraison),
         remarques = VALUES(remarques)`,
      [
        Number(r.id),
        r.type_client_id ? (lookups.typeClientById.get(Number(r.type_client_id)) ?? null) : null,
        toNullableString(r.raison_sociale),
        toNullableString(r.adresse),
        toNullableString(r.code_postal),
        toNullableString(r.ville),
        toNullableString(r.telephone),
        keepMariaString(null, current?.portable),
        toNullableString(r.ice),
        toNullableString(r.email),
        keepMariaString(null, current?.adresse_livraison),
        keepMariaString(null, current?.remarques),
      ]
    )
  }
}

async function syncFournisseurs(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync fournisseurs')
  const { rows } = await pg.query(`
    SELECT id, type_fournisseur_id, raison_sociale, adresse, code_postal, ville, telephone, ice, email
    FROM public.fournisseurs
    ORDER BY id
  `)

  for (const r of rows) {
    const [[current]] = await db.query<any[]>(
      `SELECT portable, identifiant_fiscal, adresse_livraison, remarques FROM fournisseurs WHERE id = ?`,
      [Number(r.id)]
    )

    await db.execute(
      `INSERT INTO fournisseurs
       (id, type, nom, adresse, code_postal, ville, telephone, portable, ice, email, identifiant_fiscal, adresse_livraison, remarques)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         type = VALUES(type),
         nom = VALUES(nom),
         adresse = VALUES(adresse),
         code_postal = VALUES(code_postal),
         ville = VALUES(ville),
         telephone = VALUES(telephone),
         portable = VALUES(portable),
         ice = VALUES(ice),
         email = VALUES(email),
         identifiant_fiscal = VALUES(identifiant_fiscal),
         adresse_livraison = VALUES(adresse_livraison),
         remarques = VALUES(remarques)`,
      [
        Number(r.id),
        r.type_fournisseur_id ? (lookups.typeFournisseurById.get(Number(r.type_fournisseur_id)) ?? null) : null,
        toNullableString(r.raison_sociale),
        toNullableString(r.adresse),
        toNullableString(r.code_postal),
        toNullableString(r.ville),
        toNullableString(r.telephone),
        keepMariaString(null, current?.portable),
        toNullableString(r.ice),
        toNullableString(r.email),
        keepMariaString(null, current?.identifiant_fiscal),
        keepMariaString(null, current?.adresse_livraison),
        keepMariaString(null, current?.remarques),
      ]
    )
  }
}

async function syncProduits(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync produits')
  const { rows } = await pg.query(`
    SELECT id, reference, description, fournisseur_id, unite_id, taux_tva_id,
           dernier_prix_achat_ht, prix_vente_ht, marge_ht
    FROM public.produits
    ORDER BY id
  `)

  for (const r of rows) {
    const [[current]] = await db.query<any[]>(
      `SELECT stock_initial, stock_actuel, seuil_alerte, remise_initiale, alerte, coeff_marge
         FROM produits WHERE id = ?`,
      [Number(r.id)]
    )

    const prixAchatHt = round2(toNumber(r.dernier_prix_achat_ht))
    const prixVenteHt = round2(toNumber(r.prix_vente_ht))
    const margeHt = round2(toNumber(r.marge_ht))

    await db.execute(
      `INSERT INTO produits
       (id, reference, article, prix_vente_ht, taux_tva, stock_initial, seuil_alerte, unite,
        remise_initiale, fournisseur_id, stock_actuel, alerte, prix_achat_HT, coeff_marge)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         reference = VALUES(reference),
         article = VALUES(article),
         prix_vente_ht = VALUES(prix_vente_ht),
         taux_tva = VALUES(taux_tva),
         stock_initial = VALUES(stock_initial),
         seuil_alerte = VALUES(seuil_alerte),
         unite = VALUES(unite),
         remise_initiale = VALUES(remise_initiale),
         fournisseur_id = VALUES(fournisseur_id),
         stock_actuel = VALUES(stock_actuel),
         alerte = VALUES(alerte),
         prix_achat_HT = VALUES(prix_achat_HT),
         coeff_marge = VALUES(coeff_marge)`,
      [
        Number(r.id),
        toNullableString(r.reference),
        toNullableString(r.description),
        prixVenteHt,
        r.taux_tva_id ? (lookups.tauxTvaById.get(Number(r.taux_tva_id)) ?? 0.2) : 0.2,
        current?.stock_initial ?? 0,
        current?.seuil_alerte ?? 0,
        r.unite_id ? (lookups.uniteById.get(Number(r.unite_id)) ?? null) : null,
        current?.remise_initiale ?? 0,
        r.fournisseur_id ? Number(r.fournisseur_id) : null,
        current?.stock_actuel ?? 0,
        current?.alerte ?? null,
        prixAchatHt,
        coeffMarge(prixAchatHt, prixVenteHt, margeHt),
      ]
    )
  }
}

async function syncPrixProduits(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync prix_produits')
  const { rows } = await pg.query(`
    SELECT id, produit_id, date_achat, prix_achat_ht, prix_vente_ht, marge_ht, fournisseur_id
    FROM public.prix_produits
    ORDER BY id
  `)

  for (const r of rows) {
    const prixAchatHt = round2(toNumber(r.prix_achat_ht))
    const prixVenteHt = round2(toNumber(r.prix_vente_ht))
    await db.execute(
      `INSERT INTO prix_produits
       (id, produit_id, prix_achat_ht, coeff_marge, prix_vente_ht, date_achat, fournisseur_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         produit_id = VALUES(produit_id),
         prix_achat_ht = VALUES(prix_achat_ht),
         coeff_marge = VALUES(coeff_marge),
         prix_vente_ht = VALUES(prix_vente_ht),
         date_achat = VALUES(date_achat),
         fournisseur_id = VALUES(fournisseur_id)`,
      [
        Number(r.id),
        Number(r.produit_id),
        prixAchatHt,
        coeffMarge(prixAchatHt, prixVenteHt, toNumber(r.marge_ht)),
        prixVenteHt,
        toNullableDate(r.date_achat),
        r.fournisseur_id ? Number(r.fournisseur_id) : null,
      ]
    )
  }
}

async function syncFactures(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync factures')
  const { rows } = await pg.query(`
    SELECT id, numero_sequence, client_id, date_facture, total_ht, total_ttc
    FROM public.factures
    ORDER BY id
  `)

  for (const r of rows) {
    await db.execute(
      `INSERT INTO factures
       (id, numero_facture, client_id, date_facture, total_ht, total_ttc)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         numero_facture = VALUES(numero_facture),
         client_id = VALUES(client_id),
         date_facture = VALUES(date_facture),
         total_ht = VALUES(total_ht),
         total_ttc = VALUES(total_ttc)`,
      [
        Number(r.id),
        Number(r.numero_sequence),
        Number(r.client_id),
        toNullableDate(r.date_facture),
        round2(toNumber(r.total_ht)),
        round2(toNumber(r.total_ttc)),
      ]
    )
  }
}

async function syncFactureLignes(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync facture_details')
  const { rows: factures } = await pg.query(`SELECT id FROM public.factures ORDER BY id`)

  for (const f of factures) {
    const factureId = Number(f.id)
    const { rows } = await pg.query(
      `SELECT id, facture_id, produit_id, designation, quantite, prix_unitaire_ht,
              remise_pourcentage, montant_remise_ht, taux_tva, montant_ht
         FROM public.facture_lignes
        WHERE facture_id = $1
        ORDER BY ordre_ligne ASC, id ASC`,
      [factureId]
    )

    await db.execute(`DELETE FROM facture_details WHERE facture_id = ?`, [factureId])

    for (const r of rows) {
      const quantite = round2(toNumber(r.quantite))
      const prixUnitaire = round2(toNumber(r.prix_unitaire_ht))
      const remisePct = round2(toNumber(r.remise_pourcentage) / 100)
      const remiseHt = round2(toNumber(r.montant_remise_ht))
      const tauxTva = round2(toNumber(r.taux_tva) / 100)
      const totalHt = round2(quantite * prixUnitaire)
      const totalHtNet = round2(toNumber(r.montant_ht))

      let unite: string | null = null
      if (r.produit_id) {
        const { rows: prod } = await pg.query(`SELECT unite_id FROM public.produits WHERE id = $1`, [Number(r.produit_id)])
        if (prod[0]?.unite_id) unite = lookups.uniteById.get(Number(prod[0].unite_id)) ?? null
      }

      await db.execute(
        `INSERT INTO facture_details
         (facture_id, produit_id, designation, unite, quantite, prix_unitaire, remise_pct, remise_ht, taux_tva, total_ht, total_ht_net)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          factureId,
          r.produit_id ? Number(r.produit_id) : null,
          toNullableString(r.designation),
          unite,
          quantite,
          prixUnitaire,
          remisePct,
          remiseHt,
          tauxTva,
          totalHt,
          totalHtNet,
        ]
      )
    }
  }
}

async function syncDevis(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync devis')
  const { rows } = await pg.query(`
    SELECT id, numero_sequence, client_id, date_devis, total_ht, total_ttc
    FROM public.devis
    ORDER BY id
  `)

  for (const r of rows) {
    await db.execute(
      `INSERT INTO devis
       (id, numero_devis, client_id, date_devis, total_ht, total_ttc)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         numero_devis = VALUES(numero_devis),
         client_id = VALUES(client_id),
         date_devis = VALUES(date_devis),
         total_ht = VALUES(total_ht),
         total_ttc = VALUES(total_ttc)`,
      [
        Number(r.id),
        Number(r.numero_sequence),
        Number(r.client_id),
        toNullableDate(r.date_devis),
        round2(toNumber(r.total_ht)),
        round2(toNumber(r.total_ttc)),
      ]
    )
  }
}

async function syncDevisLignes(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync devis_details')
  const { rows: devis } = await pg.query(`SELECT id FROM public.devis ORDER BY id`)

  for (const d of devis) {
    const devisId = Number(d.id)
    const { rows } = await pg.query(
      `SELECT id, devis_id, produit_id, designation, quantite, prix_unitaire_ht,
              remise_pourcentage, montant_remise_ht, taux_tva, montant_ht
         FROM public.devis_lignes
        WHERE devis_id = $1
        ORDER BY ordre_ligne ASC, id ASC`,
      [devisId]
    )

    await db.execute(`DELETE FROM devis_details WHERE devis_id = ?`, [devisId])

    for (const r of rows) {
      const quantite = round2(toNumber(r.quantite))
      const prixUnitaire = round2(toNumber(r.prix_unitaire_ht))
      const remisePct = round2(toNumber(r.remise_pourcentage) / 100)
      const remiseHt = round2(toNumber(r.montant_remise_ht))
      const tauxTva = round2(toNumber(r.taux_tva) / 100)
      const totalHt = round2(quantite * prixUnitaire)
      const totalHtNet = round2(toNumber(r.montant_ht))

      let unite: string | null = null
      if (r.produit_id) {
        const { rows: prod } = await pg.query(`SELECT unite_id FROM public.produits WHERE id = $1`, [Number(r.produit_id)])
        if (prod[0]?.unite_id) unite = lookups.uniteById.get(Number(prod[0].unite_id)) ?? null
      }

      await db.execute(
        `INSERT INTO devis_details
         (devis_id, produit_id, designation, unite, quantite, prix_unitaire, remise_pct, remise_ht, taux_tva, total_ht, total_ht_net)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          devisId,
          r.produit_id ? Number(r.produit_id) : null,
          toNullableString(r.designation),
          unite,
          quantite,
          prixUnitaire,
          remisePct,
          remiseHt,
          tauxTva,
          totalHt,
          totalHtNet,
        ]
      )
    }
  }
}

async function syncAvoirs(pg: Pool, db: mysql.Connection): Promise<void> {
  console.log('• Sync avoirs')
  const { rows } = await pg.query(`
    SELECT id, numero_sequence, facture_id, client_id, date_avoir, total_ht, total_ttc
    FROM public.avoirs
    ORDER BY id
  `)

  for (const r of rows) {
    await db.execute(
      `INSERT INTO avoirs
       (id, numero_avoir, facture_id, client_id, date_avoir, total_ht, total_ttc)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         numero_avoir = VALUES(numero_avoir),
         facture_id = VALUES(facture_id),
         client_id = VALUES(client_id),
         date_avoir = VALUES(date_avoir),
         total_ht = VALUES(total_ht),
         total_ttc = VALUES(total_ttc)`,
      [
        Number(r.id),
        Number(r.numero_sequence),
        Number(r.facture_id),
        Number(r.client_id),
        toNullableDate(r.date_avoir),
        round2(toNumber(r.total_ht)),
        round2(toNumber(r.total_ttc)),
      ]
    )
  }
}

async function syncAvoirLignes(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync avoir_details')
  const { rows: avoirs } = await pg.query(`SELECT id FROM public.avoirs ORDER BY id`)

  for (const a of avoirs) {
    const avoirId = Number(a.id)
    const { rows } = await pg.query(
      `SELECT id, avoir_id, produit_id, designation, quantite, prix_unitaire_ht,
              remise_pourcentage, taux_tva, montant_ht
         FROM public.avoir_lignes
        WHERE avoir_id = $1
        ORDER BY id ASC`,
      [avoirId]
    )

    await db.execute(`DELETE FROM avoir_details WHERE avoir_id = ?`, [avoirId])

    for (const r of rows) {
      const quantite = round2(toNumber(r.quantite))
      const prixUnitaire = round2(toNumber(r.prix_unitaire_ht))
      const remisePct = round2(toNumber(r.remise_pourcentage) / 100)
      const tauxTva = round2(toNumber(r.taux_tva) / 100)
      const totalHt = round2(quantite * prixUnitaire)
      const totalHtNet = round2(toNumber(r.montant_ht))

      let unite: string | null = null
      if (r.produit_id) {
        const { rows: prod } = await pg.query(`SELECT unite_id FROM public.produits WHERE id = $1`, [Number(r.produit_id)])
        if (prod[0]?.unite_id) unite = lookups.uniteById.get(Number(prod[0].unite_id)) ?? null
      }

      await db.execute(
        `INSERT INTO avoir_details
         (avoir_id, produit_id, designation, unite, quantite, prix_unitaire, remise_pct, remise_ht, taux_tva, total_ht, total_ht_net)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          avoirId,
          r.produit_id ? Number(r.produit_id) : null,
          toNullableString(r.designation),
          unite,
          quantite,
          prixUnitaire,
          remisePct,
          0,
          tauxTva,
          totalHt,
          totalHtNet,
        ]
      )
    }
  }
}

async function syncPaiements(pg: Pool, db: mysql.Connection, lookups: LookupMaps): Promise<void> {
  console.log('• Sync paiements')
  const { rows } = await pg.query(`
    SELECT id, facture_id, date_paiement, mode_reglement_id, numero_piece,
           remarque, justificatif_url, montant_ht, montant_ttc
    FROM public.paiements
    ORDER BY id
  `)

  for (const r of rows) {
    const [[current]] = await db.query<any[]>(
      `SELECT relance_1 FROM paiements WHERE id = ?`,
      [Number(r.id)]
    )

    await db.execute(
      `INSERT INTO paiements
       (id, facture_id, montant_HT, Montant_TTC, date_paiement, moyen_paiement, relance_1, Numero_Piece, remarques, justif_relpath)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         facture_id = VALUES(facture_id),
         montant_HT = VALUES(montant_HT),
         Montant_TTC = VALUES(Montant_TTC),
         date_paiement = VALUES(date_paiement),
         moyen_paiement = VALUES(moyen_paiement),
         relance_1 = VALUES(relance_1),
         Numero_Piece = VALUES(Numero_Piece),
         remarques = VALUES(remarques),
         justif_relpath = VALUES(justif_relpath)`,
      [
        Number(r.id),
        Number(r.facture_id),
        round2(toNumber(r.montant_ht)),
        round2(toNumber(r.montant_ttc)),
        toNullableDate(r.date_paiement),
        r.mode_reglement_id ? (lookups.modeReglementById.get(Number(r.mode_reglement_id)) ?? null) : null,
        current?.relance_1 ?? null,
        toNullableString(r.numero_piece),
        toNullableString(r.remarque),
        toNullableString(r.justificatif_url),
      ]
    )
  }
}

async function reseedMariaIdentity(db: mysql.Connection): Promise<void> {
  console.log('• Recalage AUTO_INCREMENT MariaDB')
  const tables = [
    'parametres',
    'entreprise',
    'clients',
    'fournisseurs',
    'produits',
    'prix_produits',
    'factures',
    'devis',
    'avoirs',
    'paiements',
  ]

  for (const table of tables) {
    const [rows] = await db.query<any[]>(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`)
    const nextId = Number(rows[0].max_id) + 1
    await db.query(`ALTER TABLE ${table} AUTO_INCREMENT = ${nextId}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
