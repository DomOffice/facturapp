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
  const filtrePeriode = {
    dateFacture: {
      gte: dateDebut,
      lt: dateFinExclusive,
    },
  };

  const [
    facturesPeriode,
    totalBrouillons,
    facturesNonPayees,
    tvaVentes,
    charges,
    documentsFournisseurs,
    dernieresFactures,
  ] = await Promise.all([
    // Toutes les factures utiles au dashboard : validées + brouillons.
    // Les KPI CA et marge sont calculés ensuite à partir de cette même source
    // afin d'éviter tout décalage entre les indicateurs.
    prisma.facture.findMany({
      where: {
        statut: {
          in: ["validee", "brouillon"],
        },
        ...filtrePeriode,
      },
      select: {
        id: true,
        statut: true,
        totalHt: true,
        totalTtc: true,

        lignes: {
          select: {
            quantite: true,
            prixAchatHt: true,

            produit: {
              select: {
                dernierPrixAchatHt: true,
              },
            },
          },
        },
      },
    }),

    // Nombre total de brouillons actuellement présents en BDD.
    // Ce compteur est volontairement indépendant du filtre de période.
    prisma.facture.count({
      where: {
        statut: "brouillon",
      },
    }),

    // Nombre total de factures validées non encaissées.
    //
    // On compte les FACTURES et non les lignes de paiement.
    // Une facture est considérée non encaissée si :
    // - elle ne possède encore aucun enregistrement de paiement,
    // - ou son paiement existe mais n'a pas de date de paiement.
    //
    // Ce compteur est volontairement indépendant du filtre de période.
    prisma.facture.count({
      where: {
        statut: "validee",
        OR: [
          {
            paiement: {
              is: null,
            },
          },
          {
            paiement: {
              is: {
                datePaiement: null,
              },
            },
          },
        ],
      },
    }),

    // TVA perçue : uniquement les factures validées.
    prisma.facture.aggregate({
      where: {
        statut: "validee",
        ...filtrePeriode,
      },
      _sum: {
        totalTva: true,
      },
    }),

    // Charges sur la période.
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

    // Documents fournisseurs.
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

    // Dernières factures de la période, brouillons compris.
    prisma.facture.findMany({
      where: {
        statut: {
          in: ["validee", "brouillon"],
        },
        ...filtrePeriode,
      },
      take: 8,
      orderBy: {
        dateFacture: "desc",
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

  const facturesValidees = facturesPeriode.filter(
    (facture) => facture.statut === "validee",
  );

  const totalFactures = facturesValidees.length;

  const chiffreAffaires = facturesValidees.reduce(
    (total, facture) => total + Number(facture.totalTtc),
    0,
  );

  const chiffreAffairesAvecBrouillons = facturesPeriode.reduce(
    (total, facture) => total + Number(facture.totalTtc),
    0,
  );

  // Marge HT théorique = ventes HT - coût d'achat HT.
  // On privilégie le prix d'achat mémorisé sur la ligne de facture.
  // Pour les anciennes lignes où ce prix serait à 0,
  // on utilise en secours le dernier prix d'achat actuel du produit.
  const totalVenteHtAvecBrouillons = facturesPeriode.reduce(
    (total, facture) => total + Number(facture.totalHt),
    0,
  );

  const totalAchatHtAvecBrouillons = facturesPeriode.reduce(
    (totalFactures, facture) => {
      const totalAchatFacture = facture.lignes.reduce((totalLignes, ligne) => {
        const quantite = Number(ligne.quantite);

        const prixAchatLigne = Number(ligne.prixAchatHt);

        const dernierPrixAchatProduit = Number(
          ligne.produit?.dernierPrixAchatHt ?? 0,
        );

        const prixAchatRetenu =
          prixAchatLigne > 0 ? prixAchatLigne : dernierPrixAchatProduit;

        return totalLignes + quantite * prixAchatRetenu;
      }, 0);

      return totalFactures + totalAchatFacture;
    },
    0,
  );

  const margeTheorique =
    totalVenteHtAvecBrouillons - totalAchatHtAvecBrouillons;

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
    totalBrouillons,
    facturesNonPayees,
    chiffreAffaires,
    chiffreAffairesAvecBrouillons,
    margeTheorique,
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

  const ca = data.chiffreAffaires;

  const caAvecBrouillons = data.chiffreAffairesAvecBrouillons;

  const margeHtTheorique = data.margeTheorique;

  const tvaPercue = Number(data.tvaVentes._sum.totalTva ?? 0);

  const tvaDepensee = data.tvaFacturesFournisseurs + data.tvaCharges;

  const debutStr = formaterDateInput(dateDebut);
  const finStr = formaterDateInput(dateFin);

  const debutAnneeStr = `${maintenant.getFullYear()}-01-01`;
  const finAnneeStr = formaterDateInput(finParDefaut);
  const lienCetteAnnee = `/?debut=${debutAnneeStr}&fin=${finAnneeStr}`;

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

      {/* Filtre global de période */}
      <div className="card p-3 md:p-4 mb-4">
        <form
          method="GET"
          className="flex flex-col md:flex-row md:items-end gap-3"
        >
          <div>
            <label
              htmlFor="dashboard-debut"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Date début
            </label>
            <input
              id="dashboard-debut"
              type="date"
              name="debut"
              defaultValue={debutStr}
              className="form-input"
            />
          </div>

          <div>
            <label
              htmlFor="dashboard-fin"
              className="block text-xs font-medium text-slate-500 mb-1"
            >
              Date fin
            </label>
            <input
              id="dashboard-fin"
              type="date"
              name="fin"
              defaultValue={finStr}
              className="form-input"
            />
          </div>

          <button type="submit" className="btn-primary">
            Actualiser
          </button>

          <Link href="/" className="btn-secondary text-center">
            Ce mois
          </Link>

          <Link href={lienCetteAnnee} className="btn-secondary text-center">
            Cette année
          </Link>

          <div className="md:ml-auto text-xs text-slate-400">
            Période du{" "}
            <span className="font-medium text-slate-600">
              {dateDebut.toLocaleDateString("fr-FR")}
            </span>{" "}
            au{" "}
            <span className="font-medium text-slate-600">
              {dateFin.toLocaleDateString("fr-FR")}
            </span>
          </div>
        </form>
      </div>

      {/* KPIs — 2 colonnes sur mobile, 4 sur desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="kpi-card">
          <div className="kpi-label">CA TTC</div>

          <div className="kpi-value text-lg md:text-2xl">
            {formatMontant(ca)}
          </div>

          <div className="text-xs text-slate-400 mt-1">factures validées</div>

          <div className="mt-3 pt-2 border-t border-slate-100 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Avec brouillons</span>

              <span className="text-sm font-semibold text-indigo-600">
                {formatMontant(caAvecBrouillons)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Marge HT théorique</span>

              <span
                className={`text-sm font-semibold ${
                  margeHtTheorique >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {formatMontant(margeHtTheorique)}
              </span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Factures</div>

          <div className="kpi-value text-lg md:text-2xl">
            {data.totalFactures}
          </div>

          <div className="text-xs text-slate-400 mt-1">validées</div>

          <div className="mt-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Brouillons</span>

              <span className="text-sm font-semibold text-amber-600">
                {data.totalBrouillons}
              </span>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Non encaissées</div>
          <div className="kpi-value text-lg md:text-2xl text-amber-600">
            {data.facturesNonPayees}
          </div>
          <div className="text-xs text-slate-400 mt-1">en attente</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label mb-2">Situation TVA</div>

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
