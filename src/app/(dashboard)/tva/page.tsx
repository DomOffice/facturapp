import Link from "next/link";

import prisma from "@/lib/db/prisma";
import { formatMontant } from "@/lib/utils/currency";

type TvaSearchParams = {
  debut?: string;
  fin?: string;
  clientId?: string;
  fournisseurId?: string;
};

type ExtractionFournisseur = {
  dateFacture?: string;
  numeroFacture?: string;
  numeroDocument?: string;
  totalHt?: number | string;
  totalTva?: number | string;
  totalTtc?: number | string;
  profilOcr?: string;
  typeDocument?: string;
};

type DonneesFournisseur = {
  extraction?: ExtractionFournisseur;
};

function lireNombre(valeur: unknown): number | null {
  if (typeof valeur === "number") {
    return Number.isFinite(valeur) ? valeur : null;
  }

  if (typeof valeur !== "string") {
    return null;
  }

  const nombre = Number(valeur.trim().replace(/\s/g, "").replace(",", "."));

  return Number.isFinite(nombre) ? nombre : null;
}

function lireDate(valeur: unknown, dateSecours: Date): Date {
  if (typeof valeur !== "string" || valeur.trim() === "") {
    return dateSecours;
  }

  const texte = valeur.trim();

  /*
   * Format ISO : 2026-07-31
   * On construit la date en heure locale afin d’éviter
   * un décalage dû au fuseau horaire.
   */
  const correspondanceIso = texte.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (correspondanceIso) {
    const [, annee, mois, jour] = correspondanceIso;

    const date = new Date(Number(annee), Number(mois) - 1, Number(jour));

    return Number.isNaN(date.getTime()) ? dateSecours : date;
  }

  /*
   * Format français utilisé par plusieurs OCR :
   * 31/07/2026
   */
  const correspondanceFrancaise = texte.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (correspondanceFrancaise) {
    const [, jour, mois, annee] = correspondanceFrancaise;

    const date = new Date(Number(annee), Number(mois) - 1, Number(jour));

    return Number.isNaN(date.getTime()) ? dateSecours : date;
  }

  /*
   * Dernier recours pour une date ISO complète contenant
   * éventuellement une heure.
   */
  const date = new Date(texte);

  return Number.isNaN(date.getTime()) ? dateSecours : date;
}
function formaterDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR").format(date);
}

function dateDepuisChamp(
  valeur: string | undefined,
  dateParDefaut: Date,
): Date {
  if (!valeur) {
    return dateParDefaut;
  }

  const correspondance = valeur.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!correspondance) {
    return dateParDefaut;
  }

  const [, annee, mois, jour] = correspondance;

  const date = new Date(Number(annee), Number(mois) - 1, Number(jour));

  return Number.isNaN(date.getTime()) ? dateParDefaut : date;
}
function dateFinExclusive(date: Date): Date {
  const resultat = new Date(date);
  resultat.setDate(resultat.getDate() + 1);

  return resultat;
}

function doitComptabiliserTvaFournisseur(
  extraction: ExtractionFournisseur | undefined,
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

function numeroDocumentFournisseur(
  extraction: ExtractionFournisseur | undefined,
  id: number,
): string {
  if (
    typeof extraction?.numeroFacture === "string" &&
    extraction.numeroFacture.trim() !== ""
  ) {
    return extraction.numeroFacture.trim();
  }

  if (
    typeof extraction?.numeroDocument === "string" &&
    extraction.numeroDocument.trim() !== ""
  ) {
    return extraction.numeroDocument.trim();
  }

  return `Import #${id}`;
}

export default async function TvaPage({
  searchParams,
}: {
  searchParams: TvaSearchParams;
}) {
  const maintenant = new Date();

  const debutParDefaut = new Date(maintenant.getFullYear(), 0, 1);

  const finParDefaut = new Date(maintenant.getFullYear(), 11, 31);

  const debut = dateDepuisChamp(searchParams.debut, debutParDefaut);

  const fin = dateDepuisChamp(searchParams.fin, finParDefaut);

  const finExclusive = dateFinExclusive(fin);

  const clientId =
    searchParams.clientId && Number.isFinite(Number(searchParams.clientId))
      ? Number(searchParams.clientId)
      : undefined;

  const fournisseurId =
    searchParams.fournisseurId &&
    Number.isFinite(Number(searchParams.fournisseurId))
      ? Number(searchParams.fournisseurId)
      : undefined;

  const [
    facturesClients,
    documentsFournisseurs,
    charges,
    clients,
    fournisseurs,
  ] = await Promise.all([
    prisma.facture.findMany({
      where: {
        statut: "validee",
        dateFacture: {
          gte: debut,
          lt: finExclusive,
        },
        ...(clientId ? { clientId } : {}),
      },
      select: {
        id: true,
        numeroFacture: true,
        dateFacture: true,
        totalHt: true,
        totalTva: true,
        totalTtc: true,
        client: {
          select: {
            raisonSociale: true,
          },
        },
        lignes: {
          select: {
            tauxTva: true,
            montantHt: true,
            montantTva: true,
          },
        },
      },
      orderBy: [{ dateFacture: "asc" }, { numeroFacture: "asc" }],
    }),

    prisma.documentImporte.findMany({
      where: {
        statut: {
          in: ["valide", "stock_integre"],
        },
        ...(fournisseurId ? { fournisseurId } : {}),
      },
      select: {
        id: true,
        dateImport: true,
        donneesExtraites: true,
        fournisseur: {
          select: {
            raisonSociale: true,
          },
        },
        lignes: {
          select: {
            montantTotal: true,
            montantTva: true,
            tauxTva: true,
          },
        },
      },
      orderBy: {
        dateImport: "asc",
      },
    }),

    prisma.charge.findMany({
      where: {
        dateCharge: {
          gte: debut,
          lt: finExclusive,
        },
        ...(fournisseurId ? { fournisseurId } : {}),
      },
      select: {
        id: true,
        dateCharge: true,
        numeroFacture: true,
        emetteur: true,
        montantHt: true,
        tauxTva: true,
        montantTva: true,
        montantTtc: true,
        fournisseur: {
          select: {
            raisonSociale: true,
          },
        },
      },
      orderBy: {
        dateCharge: "asc",
      },
    }),

    prisma.client.findMany({
      where: {
        actif: true,
      },
      select: {
        id: true,
        raisonSociale: true,
      },
      orderBy: {
        raisonSociale: "asc",
      },
    }),

    prisma.fournisseur.findMany({
      where: {
        actif: true,
      },
      select: {
        id: true,
        raisonSociale: true,
      },
      orderBy: {
        raisonSociale: "asc",
      },
    }),
  ]);

  /*
   * La date métier des documents fournisseurs est stockée
   * dans le JSON OCR. On filtre donc ces documents ici.
   */
  const facturesFournisseurs = documentsFournisseurs
    .map((document) => {
      const donnees = document.donneesExtraites as DonneesFournisseur | null;

      const extraction = donnees?.extraction;

      const dateFacture = lireDate(
        extraction?.dateFacture,
        document.dateImport,
      );

      if (dateFacture < debut || dateFacture >= finExclusive) {
        return null;
      }

      if (!doitComptabiliserTvaFournisseur(extraction)) {
        return null;
      }

      const tvaExtraite = lireNombre(extraction?.totalTva);

      const tvaLignes = document.lignes.reduce((total, ligne) => {
        const montant = Number(ligne.montantTva);

        return Number.isFinite(montant) ? total + montant : total;
      }, 0);

      const montantTva =
        tvaExtraite !== null && tvaExtraite > 0 ? tvaExtraite : tvaLignes;

      const htExtrait = lireNombre(extraction?.totalHt);
      const ttcExtrait = lireNombre(extraction?.totalTtc);

      const totalTtcLignes = document.lignes.reduce((total, ligne) => {
        const montant = Number(ligne.montantTotal);

        return Number.isFinite(montant) ? total + montant : total;
      }, 0);

      const montantTtc =
        ttcExtrait !== null && ttcExtrait > 0 ? ttcExtrait : totalTtcLignes;

      const montantHt =
        htExtrait !== null && htExtrait > 0
          ? htExtrait
          : Math.max(0, montantTtc - montantTva);

      return {
        id: document.id,
        numero: numeroDocumentFournisseur(extraction, document.id),
        fournisseur: document.fournisseur.raisonSociale,
        dateFacture,
        montantHt,
        montantTva,
        montantTtc,
        profilOcr:
          typeof extraction?.profilOcr === "string"
            ? extraction.profilOcr
            : "non identifié",
      };
    })
    .filter(
      (document): document is NonNullable<typeof document> => document !== null,
    );

  const tvaPercue = facturesClients.reduce(
    (total, facture) => total + Number(facture.totalTva),
    0,
  );

  const htPercu = facturesClients.reduce(
    (total, facture) => total + Number(facture.totalHt),
    0,
  );

  const tvaFournisseurs = facturesFournisseurs.reduce(
    (total, facture) => total + facture.montantTva,
    0,
  );

  const htFournisseurs = facturesFournisseurs.reduce(
    (total, facture) => total + facture.montantHt,
    0,
  );

  const tvaCharges = charges.reduce(
    (total, charge) => total + Number(charge.montantTva),
    0,
  );

  const htCharges = charges.reduce(
    (total, charge) => total + Number(charge.montantHt),
    0,
  );

  const tvaPayee = tvaFournisseurs + tvaCharges;
  const htPaye = htFournisseurs + htCharges;

  /*
   * On ne force pas le résultat à zéro :
   * une valeur négative représente un crédit de TVA.
   */
  const soldeTva = tvaPercue - tvaPayee;

  const repartitionTvaPercue: Record<
    string,
    {
      baseHt: number;
      montantTva: number;
      nombreLignes: number;
    }
  > = {};

  for (const facture of facturesClients) {
    for (const ligne of facture.lignes) {
      const taux = Number(ligne.tauxTva).toFixed(2);

      if (!repartitionTvaPercue[taux]) {
        repartitionTvaPercue[taux] = {
          baseHt: 0,
          montantTva: 0,
          nombreLignes: 0,
        };
      }

      repartitionTvaPercue[taux].baseHt += Number(ligne.montantHt);

      repartitionTvaPercue[taux].montantTva += Number(ligne.montantTva);

      repartitionTvaPercue[taux].nombreLignes += 1;
    }
  }

  function formaterDateChamp(date: Date): string {
    const annee = date.getFullYear();
    const mois = String(date.getMonth() + 1).padStart(2, "0");
    const jour = String(date.getDate()).padStart(2, "0");

    return `${annee}-${mois}-${jour}`;
  }

  const debutStr = formaterDateChamp(debut);
  const finStr = formaterDateChamp(fin);

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Situation TVA</h1>
          <p className="mt-1 text-sm text-slate-500">
            TVA perçue sur les ventes et TVA payée sur les factures fournisseurs
            et les charges.
          </p>
        </div>
      </div>

      <form
        method="GET"
        className="card mb-6 flex flex-wrap items-end gap-4 p-4"
      >
        <div>
          <label htmlFor="tva-debut" className="form-label">
            Date début
          </label>

          <input
            id="tva-debut"
            type="date"
            name="debut"
            defaultValue={debutStr}
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="tva-fin" className="form-label">
            Date fin
          </label>

          <input
            id="tva-fin"
            type="date"
            name="fin"
            defaultValue={finStr}
            className="form-input"
          />
        </div>

        <div>
          <label htmlFor="tva-client" className="form-label">
            Client
          </label>

          <select
            key={`client-${clientId ?? "tous"}`}
            id="tva-client"
            name="clientId"
            defaultValue={clientId ?? ""}
            className="form-select w-56"
          >
            <option value="">Tous les clients</option>

            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.raisonSociale}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="tva-fournisseur" className="form-label">
            Fournisseur
          </label>

          <select
            key={`fournisseur-${fournisseurId ?? "tous"}`}
            id="tva-fournisseur"
            name="fournisseurId"
            defaultValue={fournisseurId ?? ""}
            className="form-select w-56"
          >
            <option value="">Tous les fournisseurs</option>

            {fournisseurs.map((fournisseur) => (
              <option key={fournisseur.id} value={fournisseur.id}>
                {fournisseur.raisonSociale}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn-primary">
          Appliquer
        </button>

        <a href="/tva" className="btn-secondary">
          Réinitialiser
        </a>
      </form>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="kpi-card border-l-4 border-indigo-400">
          <div className="kpi-label">TVA perçue</div>

          <div className="kpi-value text-indigo-600">
            {formatMontant(tvaPercue)} MAD
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Base HT : {formatMontant(htPercu)} MAD
          </div>
        </div>

        <div className="kpi-card border-l-4 border-amber-400">
          <div className="kpi-label">TVA payée</div>

          <div className="kpi-value text-amber-600">
            {formatMontant(tvaPayee)} MAD
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Fournisseurs : {formatMontant(tvaFournisseurs)} MAD
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Charges : {formatMontant(tvaCharges)} MAD
          </div>

          <div className="mt-1 text-xs text-slate-400">
            Base HT : {formatMontant(htPaye)} MAD
          </div>
        </div>

        <div className="kpi-card border-l-4 border-emerald-400">
          <div className="kpi-label">
            {soldeTva >= 0 ? "TVA à régler" : "Crédit de TVA"}
          </div>

          <div
            className={`kpi-value ${
              soldeTva > 0 ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {formatMontant(Math.abs(soldeTva))} MAD
          </div>

          <div className="mt-1 text-xs text-slate-400">
            TVA perçue − TVA payée
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-slate-700">
              TVA perçue — Factures clients ({facturesClients.length})
            </h2>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>N° facture</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th className="text-right">HT</th>
                  <th className="text-right">TVA</th>
                  <th className="text-right">TTC</th>
                </tr>
              </thead>

              <tbody>
                {facturesClients.map((facture) => (
                  <tr key={facture.id}>
                    <td>
                      <Link
                        href={`/factures/${facture.id}`}
                        className="font-mono text-indigo-600 hover:underline"
                      >
                        {facture.numeroFacture}
                      </Link>
                    </td>

                    <td>{facture.client.raisonSociale}</td>

                    <td className="text-slate-500">
                      {formaterDate(facture.dateFacture)}
                    </td>

                    <td className="text-right">
                      {formatMontant(Number(facture.totalHt))}
                    </td>

                    <td className="text-right font-semibold text-indigo-600">
                      {formatMontant(Number(facture.totalTva))}
                    </td>

                    <td className="text-right">
                      {formatMontant(Number(facture.totalTtc))}
                    </td>
                  </tr>
                ))}

                {facturesClients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aucune facture client sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-slate-700">
              TVA payée — Factures fournisseurs ({facturesFournisseurs.length})
            </h2>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Fournisseur</th>
                  <th>Date</th>
                  <th className="text-right">HT</th>
                  <th className="text-right">TVA</th>
                  <th className="text-right">TTC</th>
                </tr>
              </thead>

              <tbody>
                {facturesFournisseurs.map((facture) => (
                  <tr key={facture.id}>
                    <td className="font-mono text-indigo-600">
                      {facture.numero}
                    </td>

                    <td>{facture.fournisseur}</td>

                    <td className="text-slate-500">
                      {formaterDate(facture.dateFacture)}
                    </td>

                    <td className="text-right">
                      {formatMontant(facture.montantHt)}
                    </td>

                    <td className="text-right font-semibold text-amber-600">
                      {formatMontant(facture.montantTva)}
                    </td>

                    <td className="text-right">
                      {formatMontant(facture.montantTtc)}
                    </td>
                  </tr>
                ))}

                {facturesFournisseurs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aucune facture fournisseur assujettie à la TVA sur cette
                      période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-slate-700">
              TVA payée — Charges ({charges.length})
            </h2>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Pièce</th>
                  <th>Émetteur</th>
                  <th>Date</th>
                  <th className="text-right">HT</th>
                  <th className="text-right">TVA</th>
                  <th className="text-right">TTC</th>
                </tr>
              </thead>

              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id}>
                    <td className="font-mono">
                      {charge.numeroFacture || `Charge #${charge.id}`}
                    </td>

                    <td>
                      {charge.fournisseur?.raisonSociale || charge.emetteur}
                    </td>

                    <td className="text-slate-500">
                      {formaterDate(charge.dateCharge)}
                    </td>

                    <td className="text-right">
                      {formatMontant(Number(charge.montantHt))}
                    </td>

                    <td className="text-right font-semibold text-amber-600">
                      {formatMontant(Number(charge.montantTva))}
                    </td>

                    <td className="text-right">
                      {formatMontant(Number(charge.montantTtc))}
                    </td>
                  </tr>
                ))}

                {charges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aucune charge sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-semibold text-slate-700">
              Répartition de la TVA perçue par taux
            </h2>
          </div>

          <table className="data-table text-xs">
            <thead>
              <tr>
                <th>Taux</th>
                <th className="text-right">Base HT</th>
                <th className="text-right">TVA</th>
                <th className="text-right">Nb lignes</th>
              </tr>
            </thead>

            <tbody>
              {Object.entries(repartitionTvaPercue)
                .sort(([tauxA], [tauxB]) => Number(tauxA) - Number(tauxB))
                .map(([taux, donnees]) => (
                  <tr key={taux}>
                    <td>
                      <span className="badge badge-info">
                        {formatMontant(Number(taux))} %
                      </span>
                    </td>

                    <td className="text-right">
                      {formatMontant(donnees.baseHt)}
                    </td>

                    <td className="text-right font-semibold text-indigo-600">
                      {formatMontant(donnees.montantTva)}
                    </td>

                    <td className="text-right text-slate-500">
                      {donnees.nombreLignes}
                    </td>
                  </tr>
                ))}

              {Object.keys(repartitionTvaPercue).length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    Aucune donnée.
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
