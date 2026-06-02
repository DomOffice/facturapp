// prisma/sync-mariadb-to-pg.ts
// Synchronisation MariaDB (VB6) → PostgreSQL (FacturApp)
// VERSION COMPLÈTE CORRIGÉE — updated_at ajouté partout

console.log("PGDATABASE =", process.env.PGDATABASE);
console.log("MYSQL_HOST =", process.env.MYSQL_HOST);

import { Pool } from "pg";
import mysql from "mysql2/promise";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Variable manquante: ${name}`);
  return v;
}

function toNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main() {
  const pg = new Pool({
    host: env("PGHOST", "127.0.0.1"),
    port: Number(env("PGPORT", "5432")),
    database: env("PGDATABASE"),
    user: env("PGUSER"),
    password: env("PGPASSWORD"),
  });

  const db = await mysql.createConnection({
    host: env("MYSQL_HOST", "127.0.0.1"),
    port: Number(env("MYSQL_PORT", "3306")),
    database: env("MYSQL_DATABASE"),
    user: env("MYSQL_USER"),
    password: env("MYSQL_PASSWORD"),
    decimalNumbers: true,
    namedPlaceholders: true,
  });

  console.log("🚀 Début sync MariaDB → PostgreSQL");
  const pgClient = await pg.connect();

  try {
    await pgClient.query("BEGIN");

    // ── 1. CLIENTS ─────────────────────────────────────────────
    console.log("• Sync clients");
    const [clients] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id, type_client, nom, adresse, code_postal, ville, telephone, portable, ice, email FROM clients ORDER BY id",
    );
    const { rows: typeParams } = await pgClient.query(
      `SELECT p.id, p.libelle FROM parametres p
       JOIN parametre_types pt ON pt.id = p.type_id
       WHERE pt.code = 'type_client'`,
    );
    const typeClientMap: Record<string, number> = {};
    for (const r of typeParams) typeClientMap[r.libelle] = r.id;

    for (const c of clients) {
      const typeClientId = c.type_client
        ? (typeClientMap[c.type_client] ?? null)
        : null;
      await pgClient.query(
        `INSERT INTO clients
         (id, type_client_id, raison_sociale, adresse, code_postal, ville, telephone, ice, email, actif, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           type_client_id = EXCLUDED.type_client_id,
           raison_sociale = EXCLUDED.raison_sociale,
           adresse = EXCLUDED.adresse,
           code_postal = EXCLUDED.code_postal,
           ville = EXCLUDED.ville,
           telephone = EXCLUDED.telephone,
           ice = EXCLUDED.ice,
           email = EXCLUDED.email,
           updated_at = NOW()`,
        [
          c.id,
          typeClientId,
          toNull(c.nom),
          toNull(c.adresse),
          toNull(c.code_postal),
          toNull(c.ville),
          toNull(c.telephone),
          toNull(c.ice),
          toNull(c.email),
        ],
      );
    }
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('clients','id'), COALESCE(MAX(id),1)) FROM clients`,
    );
    console.log(`  ✅ ${clients.length} clients`);

    // ── 2. FOURNISSEURS ────────────────────────────────────────
    console.log("• Sync fournisseurs");
    const [fournisseurs] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id, type, nom, adresse, code_postal, ville, telephone, ice, email FROM fournisseurs ORDER BY id",
    );
    for (const f of fournisseurs) {
      await pgClient.query(
        `INSERT INTO fournisseurs
         (id, raison_sociale, adresse, code_postal, ville, telephone, ice, email, actif, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           raison_sociale = EXCLUDED.raison_sociale,
           adresse = EXCLUDED.adresse,
           code_postal = EXCLUDED.code_postal,
           ville = EXCLUDED.ville,
           telephone = EXCLUDED.telephone,
           ice = EXCLUDED.ice,
           email = EXCLUDED.email,
           updated_at = NOW()`,
        [
          f.id,
          toNull(f.nom),
          toNull(f.adresse),
          toNull(f.code_postal),
          toNull(f.ville),
          toNull(f.telephone),
          toNull(f.ice),
          toNull(f.email),
        ],
      );
    }
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('fournisseurs','id'), COALESCE(MAX(id),1)) FROM fournisseurs`,
    );
    console.log(`  ✅ ${fournisseurs.length} fournisseurs`);

    // ── 3. PRODUITS ────────────────────────────────────────────
    console.log("• Sync produits");
    const [produits] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, reference, article, prix_vente_ht, taux_tva, fournisseur_id,
              unite, prix_achat_HT, coeff_marge
       FROM produits ORDER BY id`,
    );
    const { rows: tvaParams } = await pgClient.query(
      `SELECT p.id, p.valeur_num FROM parametres p
       JOIN parametre_types pt ON pt.id = p.type_id
       WHERE pt.code = 'taux_tva'`,
    );
    const tvaMap: Record<number, number> = {};
    for (const r of tvaParams) {
      tvaMap[round2(toNum(r.valeur_num) / 100)] = r.id;
    }
    const { rows: uniteParams } = await pgClient.query(
      `SELECT p.id, p.libelle FROM parametres p
       JOIN parametre_types pt ON pt.id = p.type_id
       WHERE pt.code = 'unite'`,
    );
    const uniteMap: Record<string, number> = {};
    for (const r of uniteParams) uniteMap[r.libelle] = r.id;

    for (const p of produits) {
      const tauxTvaId = tvaMap[round2(toNum(p.taux_tva))] ?? null;
      const uniteId = p.unite ? (uniteMap[p.unite] ?? null) : null;
      const prixAchatHt = round2(toNum(p.prix_achat_HT));
      const prixVenteHt = round2(toNum(p.prix_vente_ht));
      const margeHt = round2(prixVenteHt - prixAchatHt);
      const tauxNum = toNum(p.taux_tva);
      await pgClient.query(
        `INSERT INTO produits
         (id, reference, description, fournisseur_id, unite_id, taux_tva_id,
          dernier_prix_achat_ht, prix_vente_ht, marge_ht,
          dernier_prix_achat_ttc, prix_vente_ttc, actif, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           reference = EXCLUDED.reference,
           description = EXCLUDED.description,
           fournisseur_id = EXCLUDED.fournisseur_id,
           unite_id = EXCLUDED.unite_id,
           taux_tva_id = EXCLUDED.taux_tva_id,
           dernier_prix_achat_ht = EXCLUDED.dernier_prix_achat_ht,
           prix_vente_ht = EXCLUDED.prix_vente_ht,
           marge_ht = EXCLUDED.marge_ht,
           dernier_prix_achat_ttc = EXCLUDED.dernier_prix_achat_ttc,
           prix_vente_ttc = EXCLUDED.prix_vente_ttc,
           updated_at = NOW()`,
        [
          p.id,
          toNull(p.reference),
          toNull(p.article),
          p.fournisseur_id ? Number(p.fournisseur_id) : null,
          uniteId,
          tauxTvaId,
          prixAchatHt,
          prixVenteHt,
          margeHt,
          round2(prixAchatHt * (1 + tauxNum)),
          round2(prixVenteHt * (1 + tauxNum)),
        ],
      );
    }
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('produits','id'), COALESCE(MAX(id),1)) FROM produits`,
    );
    console.log(`  ✅ ${produits.length} produits`);

    // ── 4. FACTURES ────────────────────────────────────────────
    console.log("• Sync factures");
    const [factures] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id, numero_facture, client_id, date_facture, total_ht, total_ttc FROM factures ORDER BY id",
    );
    for (const f of factures) {
      const annee =
        toDate(f.date_facture)?.getFullYear() ?? new Date().getFullYear();
      const seq = Number(f.numero_facture);
      const numeroFormate = `F${annee}/${String(seq).padStart(5, "0")}`;
      const totalHt = round2(toNum(f.total_ht));
      const totalTtc = round2(toNum(f.total_ttc));
      const totalTva = round2(totalTtc - totalHt);
      await pgClient.query(
        `INSERT INTO factures
         (id, numero_facture, annee, numero_sequence, client_id, date_facture,
          statut, total_ht, total_tva, total_ttc, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'validee',$7,$8,$9,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET
           numero_facture = EXCLUDED.numero_facture,
           client_id = EXCLUDED.client_id,
           date_facture = EXCLUDED.date_facture,
           total_ht = EXCLUDED.total_ht,
           total_tva = EXCLUDED.total_tva,
           total_ttc = EXCLUDED.total_ttc,
           updated_at = NOW()`,
        [
          f.id,
          numeroFormate,
          annee,
          seq,
          Number(f.client_id),
          toDate(f.date_facture),
          totalHt,
          totalTva,
          totalTtc,
        ],
      );
    }
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('factures','id'), COALESCE(MAX(id),1)) FROM factures`,
    );
    console.log(`  ✅ ${factures.length} factures`);

    // ── 5. LIGNES FACTURE ──────────────────────────────────────
    console.log("• Sync lignes factures");
    const [details] = await db.query<mysql.RowDataPacket[]>(
      `SELECT facture_id, produit_id, designation, unite, quantite,
              prix_unitaire, remise_pct, remise_ht, taux_tva, total_ht, total_ht_net
       FROM facture_details ORDER BY facture_id`,
    );
    const facIds = Array.from(new Set(details.map((d) => d.facture_id)));
    for (const fid of facIds) {
      await pgClient.query("DELETE FROM facture_lignes WHERE facture_id = $1", [
        fid,
      ]);
    }
    const ordreLigne: Record<number, number> = {};
    for (const d of details) {
      const fid = Number(d.facture_id);
      ordreLigne[fid] = (ordreLigne[fid] ?? 0) + 1;
      const qte = round2(toNum(d.quantite));
      const pu = round2(toNum(d.prix_unitaire));
      const remisePct = round2(toNum(d.remise_pct) * 100);
      const remiseHt = round2(toNum(d.remise_ht));
      const tauxTva = round2(toNum(d.taux_tva) * 100);
      const montantHt = round2(toNum(d.total_ht_net));
      const montantTva = round2(montantHt * toNum(d.taux_tva));
      const montantTtc = round2(montantHt + montantTva);
      await pgClient.query(
        `INSERT INTO facture_lignes
         (facture_id, produit_id, ordre_ligne, designation, quantite,
          prix_unitaire_ht, remise_pourcentage, montant_remise_ht, taux_tva,
          montant_ht, montant_tva, montant_ttc, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
        [
          fid,
          d.produit_id ? Number(d.produit_id) : null,
          ordreLigne[fid],
          toNull(d.designation),
          qte,
          pu,
          remisePct,
          remiseHt,
          tauxTva,
          montantHt,
          montantTva,
          montantTtc,
        ],
      );
    }
    console.log(`  ✅ ${details.length} lignes`);

    // ── 6. PAIEMENTS ───────────────────────────────────────────

    console.log("• Sync paiements");
    const [paiements] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, facture_id, montant_HT, Montant_TTC, date_paiement,
              moyen_paiement, Numero_Piece, remarques
       FROM paiements ORDER BY id`,
    );
    const { rows: modeParams } = await pgClient.query(
      `SELECT p.id, p.libelle FROM parametres p
       JOIN parametre_types pt ON pt.id = p.type_id
       WHERE pt.code = 'mode_reglement'`,
    );
    const modeMap: Record<string, number> = {};
    for (const r of modeParams) modeMap[r.libelle.toLowerCase()] = r.id;

    // Supprimer tous les paiements existants et recréer
    await pgClient.query("DELETE FROM paiements");

    for (const p of paiements) {
      let modeId: number | null = null;
      if (p.moyen_paiement) {
        const modeNorm = String(p.moyen_paiement)
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        modeId =
          Object.entries(modeMap).find(([k]) => modeNorm.includes(k))?.[1] ??
          null;
      }
      await pgClient.query(
        `INSERT INTO paiements
         (id, facture_id, montant_ht, montant_ttc, date_paiement,
          mode_reglement_id, numero_piece, remarque, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())`,
        [
          p.id,
          Number(p.facture_id),
          round2(toNum(p.montant_HT)),
          round2(toNum(p.Montant_TTC)),
          toDate(p.date_paiement),
          modeId,
          toNull(p.Numero_Piece),
          toNull(p.remarques),
        ],
      );
    }
    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('paiements','id'), COALESCE(MAX(id),1)) FROM paiements`,
    );
    console.log(`  ✅ ${paiements.length} paiements`);

    // ── 7. DEVIS ───────────────────────────────────────────────
    console.log("• Sync devis");
    try {
      const [devis] = await db.query<mysql.RowDataPacket[]>(
        "SELECT id, numero_devis, client_id, date_devis, total_ht, total_ttc FROM devis ORDER BY id",
      );
      for (const d of devis) {
        const annee =
          toDate(d.date_devis)?.getFullYear() ?? new Date().getFullYear();
        const seq = Number(d.numero_devis);
        const numeroFormate = `D${annee}/${String(seq).padStart(5, "0")}`;
        await pgClient.query(
          `INSERT INTO devis
           (id, numero_devis, annee, numero_sequence, client_id, date_devis,
            statut, total_ht, total_tva, total_ttc, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'brouillon',$7,$8,$9,NOW(),NOW())
           ON CONFLICT (id) DO UPDATE SET
             numero_devis = EXCLUDED.numero_devis,
             client_id = EXCLUDED.client_id,
             date_devis = EXCLUDED.date_devis,
             total_ht = EXCLUDED.total_ht,
             total_tva = EXCLUDED.total_tva,
             total_ttc = EXCLUDED.total_ttc,
             updated_at = NOW()`,
          [
            d.id,
            numeroFormate,
            annee,
            seq,
            Number(d.client_id),
            toDate(d.date_devis),
            round2(toNum(d.total_ht)),
            round2(toNum(d.total_ttc) - toNum(d.total_ht)),
            round2(toNum(d.total_ttc)),
          ],
        );
      }
      await pgClient.query(
        `SELECT setval(pg_get_serial_sequence('devis','id'), COALESCE(MAX(id),1)) FROM devis`,
      );

      const [devisDetails] = await db.query<mysql.RowDataPacket[]>(
        `SELECT devis_id, produit_id, designation, quantite, prix_unitaire,
                remise_pct, remise_ht, taux_tva, total_ht, total_ht_net
         FROM devis_details ORDER BY devis_id`,
      );
      const devisIds = Array.from(new Set(devisDetails.map((d) => d.devis_id)));
      for (const did of devisIds) {
        await pgClient.query("DELETE FROM devis_lignes WHERE devis_id = $1", [
          did,
        ]);
      }
      const ordreDevis: Record<number, number> = {};
      for (const d of devisDetails) {
        const did = Number(d.devis_id);
        ordreDevis[did] = (ordreDevis[did] ?? 0) + 1;
        const montantHt = round2(toNum(d.total_ht_net));
        const montantTva = round2(montantHt * toNum(d.taux_tva));
        await pgClient.query(
          `INSERT INTO devis_lignes
   (devis_id, produit_id, ordre_ligne, designation, quantite,
    prix_unitaire_ht, remise_pourcentage, montant_remise_ht, taux_tva,
    montant_ht, montant_tva, montant_ttc, created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())`,
          [
            did,
            d.produit_id ? Number(d.produit_id) : null,
            ordreDevis[did],
            toNull(d.designation),
            round2(toNum(d.quantite)),
            round2(toNum(d.prix_unitaire)),
            round2(toNum(d.remise_pct) * 100),
            round2(toNum(d.remise_ht)),
            round2(toNum(d.taux_tva) * 100),
            montantHt,
            montantTva,
            round2(montantHt + montantTva),
          ],
        );
      }
      console.log(`  ✅ ${devis.length} devis, ${devisDetails.length} lignes`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("doesn't exist") || msg.includes("ER_NO_SUCH_TABLE")) {
        console.log("  ⚠️  Table devis absente dans MariaDB — ignorée");
      } else throw err;
    }

    // ── 8. AVOIRS ──────────────────────────────────────────────
    console.log("• Sync avoirs");
    try {
      const [avoirs] = await db.query<mysql.RowDataPacket[]>(
        "SELECT id, numero_avoir, facture_id, client_id, date_avoir, total_ht, total_ttc FROM avoirs ORDER BY id",
      );

      const avoirIdMap: Record<number, number> = {};
      for (const a of avoirs) {
        const annee =
          toDate(a.date_avoir)?.getFullYear() ?? new Date().getFullYear();
        const seq = Number(a.numero_avoir);
        const numeroFormate = `A${annee}/${String(seq).padStart(5, "0")}`;

        await pgClient.query(
          `DELETE FROM avoir_lignes
   WHERE avoir_id IN (
     SELECT id FROM avoirs
     WHERE id = $1 OR numero_avoir = $2
   )`,
          [Number(a.id), numeroFormate],
        );

        await pgClient.query(
          `DELETE FROM avoirs
   WHERE id = $1 OR numero_avoir = $2`,
          [Number(a.id), numeroFormate],
        );

        const { rows } = await pgClient.query(
          `INSERT INTO avoirs
   (id, numero_avoir, annee, numero_sequence, facture_id, client_id,
    date_avoir, statut, total_ht, total_tva, total_ttc, created_at, updated_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
   RETURNING id`,
          [
            Number(a.id),
            numeroFormate,
            annee,
            seq,
            Number(a.facture_id),
            Number(a.client_id),
            toDate(a.date_avoir),
            "valide",
            round2(toNum(a.total_ht)),
            round2(toNum(a.total_ttc) - toNum(a.total_ht)),
            round2(toNum(a.total_ttc)),
          ],
        );

        avoirIdMap[Number(a.id)] = Number(rows[0].id);
      }
      await pgClient.query(
        `SELECT setval(pg_get_serial_sequence('avoirs','id'), COALESCE(MAX(id),1)) FROM avoirs`,
      );

      const [avoirDetails] = await db.query<mysql.RowDataPacket[]>(
        `SELECT avoir_id, produit_id, designation, quantite, prix_unitaire,
                remise_pct, remise_ht, taux_tva, total_ht, total_ht_net
         FROM avoir_details ORDER BY avoir_id`,
      );
      const avoirIds = Array.from(
        new Set(
          avoirDetails.map(
            (a) => avoirIdMap[Number(a.avoir_id)] ?? Number(a.avoir_id),
          ),
        ),
      );
      for (const aid of avoirIds) {
        await pgClient.query("DELETE FROM avoir_lignes WHERE avoir_id = $1", [
          aid,
        ]);
      }
      const ordreAvoir: Record<number, number> = {};
      for (const a of avoirDetails) {
        const aid = avoirIdMap[Number(a.avoir_id)] ?? Number(a.avoir_id);
        ordreAvoir[aid] = (ordreAvoir[aid] ?? 0) + 1;
        const montantHt = round2(toNum(a.total_ht_net));
        const montantTva = round2(montantHt * toNum(a.taux_tva));
        await pgClient.query(
          `INSERT INTO avoir_lignes
           (avoir_id, produit_id, designation, quantite,
            prix_unitaire_ht, remise_pourcentage, taux_tva,
            montant_ht, montant_tva, montant_ttc)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            aid,
            a.produit_id ? Number(a.produit_id) : null,
            toNull(a.designation),
            round2(toNum(a.quantite)),
            round2(toNum(a.prix_unitaire)),
            round2(toNum(a.remise_pct) * 100),
            round2(toNum(a.taux_tva) * 100),
            montantHt,
            montantTva,
            round2(montantHt + montantTva),
          ],
        );
      }
      console.log(
        `  ✅ ${avoirs.length} avoirs, ${avoirDetails.length} lignes`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("doesn't exist") || msg.includes("ER_NO_SUCH_TABLE")) {
        console.log("  ⚠️  Table avoirs absente dans MariaDB — ignorée");
      } else throw err;
    }

    await pgClient.query("COMMIT");

    console.log("\n" + "═".repeat(50));
    console.log("✅ SYNC MARIADB → POSTGRESQL TERMINÉE");
    console.log("═".repeat(50));
  } catch (err) {
    await pgClient.query("ROLLBACK");
    console.error("❌ Erreur — rollback effectué:", err);
    process.exitCode = 1;
  } finally {
    pgClient.release();
    await pg.end();
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
