// src/app/(dashboard)/factures-fournisseurs/page.tsx
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { formatMontant } from "@/lib/format";

export const dynamic = "force-dynamic";

function lireExtraction(
  donneesExtraites: unknown,
): Record<string, unknown> | null {
  if (
    !donneesExtraites ||
    typeof donneesExtraites !== "object" ||
    Array.isArray(donneesExtraites)
  ) {
    return null;
  }

  const extraction = (donneesExtraites as Record<string, unknown>).extraction;

  if (
    !extraction ||
    typeof extraction !== "object" ||
    Array.isArray(extraction)
  ) {
    return null;
  }

  return extraction as Record<string, unknown>;
}

function lireNombre(
  objet: Record<string, unknown> | null,
  cle: string,
): number | null {
  const valeur = objet?.[cle];

  if (typeof valeur === "number" && Number.isFinite(valeur)) {
    return valeur;
  }

  if (typeof valeur === "string") {
    const nombre = Number(valeur.trim().replace(/\s/g, "").replace(",", "."));

    return Number.isFinite(nombre) ? nombre : null;
  }

  return null;
}

function doitComptabiliserTva(
  extraction: Record<string, unknown> | null,
): boolean {
  const profilOcr =
    typeof extraction?.profilOcr === "string"
      ? extraction.profilOcr.trim().toLowerCase()
      : "";

  const typeDocument =
    typeof extraction?.typeDocument === "string"
      ? extraction.typeDocument.trim().toLowerCase()
      : "";

  const estMechouar =
    profilOcr === "mechouar" || profilOcr === "mechouar_facture";

  const estFactureMechouar =
    profilOcr === "mechouar_facture" ||
    (estMechouar && typeDocument === "facture");

  /*
   * Facture Mechouar :
   * TVA oui, stock non.
   */
  if (estFactureMechouar) {
    return true;
  }

  /*
   * BL Mechouar :
   * TVA non, stock oui.
   */
  if (estMechouar) {
    return false;
  }

  /*
   * Tous les autres fournisseurs :
   * TVA oui, stock oui.
   */
  return true;
}

function lireBooleen(
  objet: Record<string, unknown> | null,
  cle: string,
): boolean | null {
  const valeur = objet?.[cle];

  return typeof valeur === "boolean" ? valeur : null;
}

export default async function FacturesFournisseursPage() {
  const session = await auth();

  if (!session?.user) redirect("/connexion");

  // Extraire le rôle de manière sécurisée en traitant session.user comme un objet pouvant avoir un attribut role
  /*const userRole = (session.user as { role?: string }).role
    
    if (!['ADMIN', 'SAISIE'].includes(userRole || '')) redirect('/dashboard')
  */
  const userRole = String(
    (session.user as { role?: string }).role || "",
  ).toUpperCase();

  //console.log("ROLE FACTURES FOURNISSEURS =", userRole);

  if (!["ADMIN", "SAISIE"].includes(userRole)) redirect("/");

  // Récupération des charges fournisseurs (utilisation du modèle existant pour simuler les factures fournisseurs)
  const documentsImportes = await prisma.documentImporte.findMany({
    include: {
      fournisseur: {
        select: {
          raisonSociale: true,
        },
      },
      integrationStock: {
        select: {
          id: true,
          dateIntegration: true,
        },
      },
      lignes: {
        select: {
          montantTva: true,
        },
      },
      _count: {
        select: {
          lignes: true,
        },
      },
    },
    orderBy: {
      dateImport: "desc",
    },
  });

  const facturesFournisseurs = documentsImportes.map((document) => {
    const extraction = lireExtraction(document.donneesExtraites);

    const numeroFacture =
      typeof extraction?.numeroFacture === "string"
        ? extraction.numeroFacture
        : null;

    const dateFacture =
      typeof extraction?.dateFacture === "string"
        ? extraction.dateFacture
        : null;

    const comptabiliseTva = doitComptabiliserTva(extraction);

    const totalTvaExtraite = lireNombre(extraction, "totalTva");

    const totalTvaLignes = document.lignes.reduce(
      (total, ligne) => total + Number(ligne.montantTva),
      0,
    );

    const totalTva =
      totalTvaExtraite !== null && totalTvaExtraite > 0
        ? totalTvaExtraite
        : totalTvaLignes;

    return {
      id: document.id,
      numeroFacture,
      nomFichierOriginal: document.nomFichierOriginal,
      fournisseur: document.fournisseur.raisonSociale,
      dateFacture,
      dateImport: document.dateImport,
      totalHt: lireNombre(extraction, "totalHt"),
      totalTva,
      totalTtc: lireNombre(extraction, "totalTtc"),
      comptabiliseTva,
      statut: document.statut,
      estIntegree: document.integrationStock !== null,
      nombreLignes: document._count.lignes,
    };
  });

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/" className="hover:text-gray-700">
            Tableau de bord
          </Link>
          <span>/</span>
          <span className="text-gray-900">Factures fournisseurs</span>
        </nav>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Factures fournisseurs
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestion des factures émises par vos fournisseurs
            </p>
          </div>

          <Link
            href="/factures-fournisseurs/nouveau"
            className="btn-primary text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 1v14M1 8h14" />
            </svg>
            <span>Nouvelle facture</span>
          </Link>
        </div>
      </div>

      {/* Liste des factures fournisseurs */}
      <div className="card">
        {facturesFournisseurs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg
              width="48"
              height="48"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="mx-auto mb-4 opacity-50"
            >
              <path d="M12 4v10H3V3h6m4-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z" />
              <path d="M12 1h-4v3h4V1z" />
              <path d="M5 8h6M5 11h4M8 5v6" />
            </svg>
            <p>Aucune facture fournisseur importée</p>
            <p className="text-sm mt-1">
              Commencez par importer une facture fournisseur
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Facture</th>
                <th>Fournisseur</th>
                <th>Date</th>
                <th>Montant HT</th>
                <th>TVA</th>
                <th>Montant TTC</th>
                <th>Lignes</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {facturesFournisseurs.map((facture) => (
                <tr key={facture.id}>
                  <td>
                    <div className="font-medium text-gray-900">
                      {facture.numeroFacture || `IMP-${facture.id}`}
                    </div>

                    <div
                      className="max-w-xs truncate text-xs text-gray-500"
                      title={facture.nomFichierOriginal}
                    >
                      {facture.nomFichierOriginal}
                    </div>
                  </td>

                  <td>{facture.fournisseur}</td>

                  <td>
                    {facture.dateFacture
                      ? facture.dateFacture
                      : facture.dateImport.toLocaleDateString("fr-FR")}
                  </td>

                  <td className="text-right">
                    {facture.totalHt !== null
                      ? `${formatMontant(facture.totalHt)} MAD`
                      : "—"}
                  </td>

                  <td className="text-right">
                    {facture.comptabiliseTva
                      ? `${formatMontant(facture.totalTva)} MAD`
                      : "—"}
                  </td>

                  <td className="text-right font-medium">
                    {facture.totalTtc !== null
                      ? `${formatMontant(facture.totalTtc)} MAD`
                      : "—"}
                  </td>

                  <td className="text-center">{facture.nombreLignes}</td>

                  <td>
                    {facture.estIntegree ? (
                      <span className="badge badge-success">
                        Intégrée au stock
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        {facture.statut}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
