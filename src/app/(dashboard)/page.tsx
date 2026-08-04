export const dynamic = "force-dynamic";
// src/app/(dashboard)/page.tsx
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { formatMontant } from "@/lib/utils/currency";

type DonneesFactureFournisseur = {
  extraction?: {
    dateFacture?: string;
    totalTva?: number | string;
    profilOcr?: string;
    typeDocument?: string;
  };
};

function formaterDateInput(date: Date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
}

function lireDateFiltre(valeur: string | undefined, valeurParDefaut: Date) {
  if (!valeur) {
    return valeurParDefaut;
  }

  const date = new Date(`${valeur}T00:00:00`);

  return Number.isNaN(date.getTime()) ? valeurParDefaut : date;
}

function lireDateFactureFournisseur(
  valeur: string | undefined,
  dateImport: Date,
) {
  if (!valeur) {
    return dateImport;
  }

  const dateIso = new Date(`${valeur}T00:00:00`);

  if (!Number.isNaN(dateIso.getTime())) {
    return dateIso;
  }

  const correspondanceFrancaise = valeur.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (correspondanceFrancaise) {
    const [, jour, mois, annee] = correspondanceFrancaise;

    return new Date(Number(annee), Number(mois) - 1, Number(jour));
  }

  return dateImport;
}

function doitComptabiliserTvaFournisseur(
  extraction: DonneesFactureFournisseur["extraction"],
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

  if (estFactureMechouar) {
    return true;
  }

  if (estMechouar) {
    return false;
  }

  return true;
}

// Removed duplicate export default function UtilisateursPage() { ... }

async function getDashboardData(dateDebut: Date, dateFinExclusive: Date) {
  const [
    totalFactures,
    facturesNonPayees,
    chiffreAffaires,
    tvaVentes,
    charges,
    documentsFournisseurs,
    dernieresFactures,
  ] = await Promise.all([
    prisma.facture.count({
      where: {
        statut: "validee",
      },
    }),

    prisma.paiement.count({
      where: {
        datePaiement: null,
      },
    }),

    prisma.facture.aggregate({
      where: {
        statut: "validee",
      },
      _sum: {
        totalTtc: true,
      },
    }),

    prisma.facture.aggregate({
      where: {
        statut: "validee",
        dateFacture: {
          gte: dateDebut,
          lt: dateFinExclusive,
        },
      },
      _sum: {
        totalTva: true,
      },
    }),

    prisma.charge.findMany({
      where: {
        dateCharge: {
          gte: dateDebut,
          lt: dateFinExclusive,
        },
      },
      select: {
        montantTva: true,
      },
    }),

    prisma.documentImporte.findMany({
      where: {
        statut: {
          in: ["valide", "stock_integre"],
        },
      },
      select: {
        dateImport: true,
        donneesExtraites: true,
        lignes: {
          select: {
            montantTva: true,
          },
        },
      },
    }),

    prisma.facture.findMany({
      take: 8,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        client: {
          select: {
            raisonSociale: true,
          },
        },
        paiement: true,
      },
    }),
  ]);

  const tvaCharges = charges.reduce(
    (total, charge) => total + Number(charge.montantTva),
    0,
  );

  const tvaFacturesFournisseurs = documentsFournisseurs.reduce(
    (total, document) => {
      const donnees =
        document.donneesExtraites as DonneesFactureFournisseur | null;

      const extraction = donnees?.extraction;

      /*
       * BL Mechouar : aucune TVA.
       * Facture Mechouar : TVA.
       * Autres fournisseurs : TVA.
       */
      if (!doitComptabiliserTvaFournisseur(extraction)) {
        return total;
      }

      const dateFacture = lireDateFactureFournisseur(
        extraction?.dateFacture,
        document.dateImport,
      );

      const factureDansPeriode =
        dateFacture >= dateDebut && dateFacture < dateFinExclusive;

      if (!factureDansPeriode) {
        return total;
      }

      const totalTvaExtraite =
        typeof extraction?.totalTva === "number"
          ? extraction.totalTva
          : typeof extraction?.totalTva === "string"
            ? Number(
                extraction.totalTva.trim().replace(/\s/g, "").replace(",", "."),
              )
            : Number.NaN;

      /*
       * Le montant OCR est utilisé uniquement lorsqu'il est
       * réellement exploitable et positif.
       */
      if (Number.isFinite(totalTvaExtraite) && totalTvaExtraite > 0) {
        return total + totalTvaExtraite;
      }

      /*
       * Sinon, on additionne les montants TVA enregistrés
       * lors de la validation des lignes.
       *
       * Aucun recalcul approximatif depuis le TTC n'est effectué.
       */
      const totalTvaLignes = document.lignes.reduce((totalLignes, ligne) => {
        const montantTva = Number(ligne.montantTva);

        return Number.isFinite(montantTva)
          ? totalLignes + montantTva
          : totalLignes;
      }, 0);

      return total + totalTvaLignes;
    },
    0,
  );

  return {
    totalFactures,
    facturesNonPayees,
    chiffreAffaires,
    tvaVentes,
    tvaCharges,
    tvaFacturesFournisseurs,
    dernieresFactures,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    debut?: string;
    fin?: string;
  };
}) {
  const maintenant = new Date();

  const debutParDefaut = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    1,
  );

  const finParDefaut = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  );

  const dateDebut = lireDateFiltre(searchParams.debut, debutParDefaut);

  const dateFin = lireDateFiltre(searchParams.fin, finParDefaut);

  /*
   * La borne supérieure est exclusive.
   * On ajoute donc un jour pour inclure toute la date de fin.
   */
  const dateFinExclusive = new Date(dateFin);
  dateFinExclusive.setDate(dateFinExclusive.getDate() + 1);

  const data = await getDashboardData(dateDebut, dateFinExclusive);

  const ca = Number(data.chiffreAffaires._sum.totalTtc ?? 0);

  const tvaPercue = Number(data.tvaVentes._sum.totalTva ?? 0);

  const tvaDepensee = data.tvaFacturesFournisseurs + data.tvaCharges;

  const debutStr = formaterDateInput(dateDebut);
  const finStr = formaterDateInput(dateFin);

  return (
    <div className="p-4 md:p-6">
      {/* En-tête */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="text-sm text-slate-400 mt-0.5 hidden md:block">
            Vue d'ensemble de votre activité
          </p>
        </div>
        <Link href="/factures/nouvelle" className="btn-primary text-sm">
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
          <span className="hidden sm:inline">Nouvelle facture</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      {/* KPIs — 2 colonnes sur mobile, 4 sur desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="kpi-card">
          <div className="kpi-label">CA TTC</div>
          <div className="kpi-value text-lg md:text-2xl">
            {formatMontant(ca)}
          </div>
          <div className="text-xs text-slate-400 mt-1">MAD</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Factures</div>
          <div className="kpi-value text-lg md:text-2xl">
            {data.totalFactures}
          </div>
          <div className="text-xs text-slate-400 mt-1">validées</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Non encaissées</div>
          <div className="kpi-value text-lg md:text-2xl text-amber-600">
            {data.facturesNonPayees}
          </div>
          <div className="text-xs text-slate-400 mt-1">en attente</div>
        </div>
        <div className="kpi-card">
          <form method="GET">
            <div className="kpi-label mb-2">Situation TVA</div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label
                  htmlFor="dashboard-tva-debut"
                  className="block text-[10px] text-slate-400 mb-1"
                >
                  Date début
                </label>

                <input
                  id="dashboard-tva-debut"
                  type="date"
                  name="debut"
                  defaultValue={debutStr}
                  className="form-input w-full px-2 py-1 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="dashboard-tva-fin"
                  className="block text-[10px] text-slate-400 mb-1"
                >
                  Date fin
                </label>

                <input
                  id="dashboard-tva-fin"
                  type="date"
                  name="fin"
                  defaultValue={finStr}
                  className="form-input w-full px-2 py-1 text-xs"
                />
              </div>
            </div>

            <button type="submit" className="btn-secondary btn-sm w-full mb-3">
              Actualiser
            </button>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">TVA perçue</span>

                <span className="text-sm font-semibold text-emerald-600">
                  {formatMontant(tvaPercue)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">TVA dépensée</span>

                <span className="text-sm font-semibold text-amber-600">
                  {formatMontant(tvaDepensee)}
                </span>
              </div>
              <div className="text-[10px] leading-4 text-slate-400">
                Fournisseurs : {formatMontant(data.tvaFacturesFournisseurs)}
                {" · "}
                Charges : {formatMontant(data.tvaCharges)}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Dernières factures */}
      <div className="card">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 font-display">
            Dernières factures
          </h2>
          <Link
            href="/factures"
            className="text-xs text-indigo-500 hover:text-indigo-700"
          >
            Voir tout →
          </Link>
        </div>

        {/* VERSION MOBILE — cartes */}
        <div className="md:hidden divide-y divide-slate-50">
          {data.dernieresFactures.map((f) => (
            <Link
              key={f.id}
              href={`/factures/${f.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 active:bg-slate-100"
            >
              <div>
                <div className="text-sm font-semibold text-indigo-600">
                  {f.numeroFacture}
                </div>
                <div className="text-xs text-slate-500 truncate max-w-40">
                  {f.client.raisonSociale}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(f.dateFacture).toLocaleDateString("fr-FR")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800">
                  {formatMontant(Number(f.totalTtc))}
                </div>
                <div className="mt-1">
                  {f.statut === "validee" && f.paiement?.datePaiement ? (
                    <span className="badge badge-success">Payée</span>
                  ) : f.statut === "validee" ? (
                    <span className="badge badge-warning">Attente</span>
                  ) : (
                    <span className="badge badge-neutral">Brouillon</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
          {data.dernieresFactures.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-sm">
              Aucune facture
            </div>
          )}
        </div>

        {/* VERSION DESKTOP — tableau */}
        <div className="hidden md:block overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total HT</th>
                <th>Total TTC</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {data.dernieresFactures.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link
                      href={`/factures/${f.id}`}
                      className="text-indigo-600 font-medium hover:underline"
                    >
                      {f.numeroFacture}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate">
                    {f.client.raisonSociale}
                  </td>
                  <td className="text-slate-500">
                    {new Date(f.dateFacture).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="font-medium">
                    {formatMontant(Number(f.totalHt))}
                  </td>
                  <td className="font-medium">
                    {formatMontant(Number(f.totalTtc))}
                  </td>
                  <td>
                    {f.statut === "validee" && f.paiement?.datePaiement ? (
                      <span className="badge badge-success">Payée</span>
                    ) : f.statut === "validee" ? (
                      <span className="badge badge-warning">En attente</span>
                    ) : (
                      <span className="badge badge-neutral">Brouillon</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.dernieresFactures.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-400 py-8">
                    Aucune facture
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
