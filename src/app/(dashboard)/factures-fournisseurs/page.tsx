// src/app/(dashboard)/factures-fournisseurs/page.tsx
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

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
  const facturesFournisseurs = await prisma.charge.findMany({
    include: {
      fournisseur: true,
      typeCharge: true,
    },
    orderBy: { dateCharge: "desc" },
  });

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/dashboard" className="hover:text-gray-700">
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
            href="/charges/nouveau" // Changed link to match existing charges feature
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
            <p>Aucune facture fournisseur enregistrée</p>
            <p className="text-sm mt-1">
              Commencez par ajouter une charge depuis votre espace fournisseur
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Fournisseur</th>
                <th>Date</th>
                <th>Montant HT</th>
                <th>Montant TTC</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {facturesFournisseurs.map((charge) => (
                <tr key={charge.id}>
                  <td className="font-medium">
                    {charge.numeroFacture || `CHG-${charge.id}`}
                  </td>
                  <td>{charge.fournisseur?.raisonSociale || "N/A"}</td>
                  <td>
                    {new Date(charge.dateCharge).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="text-right">
                    {Number(charge.montantHt).toFixed(2)} MAD
                  </td>
                  <td className="text-right font-medium">
                    {Number(charge.montantTtc).toFixed(2)} MAD
                  </td>
                  <td>
                    <span className={`badge badge-warning`}>En attente</span>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/charges/${charge.id}`}
                      className="btn-ghost btn-sm"
                    >
                      Voir
                    </Link>
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
