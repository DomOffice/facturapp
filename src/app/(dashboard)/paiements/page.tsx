// src/app/(dashboard)/paiements/page.tsx
import prisma from "@/lib/db/prisma";
import { formatMontant } from "@/lib/utils/currency";
import PaiementsClient from "./page-client";

export default async function PaiementsPage({
  searchParams,
}: {
  searchParams: {
    nonPayees?: string;
    clients?: string;
  };
}) {
  const nonPayeeSeulement = searchParams.nonPayees === "1";

  const clientIds = (searchParams.clients ?? "")
    .split(",")
    .map((valeur) => Number(valeur))
    .filter((id) => Number.isInteger(id) && id > 0);

  const [paiements, clients, modesReglement] = await Promise.all([
    prisma.paiement.findMany({
      where: {
        ...(nonPayeeSeulement
          ? {
              datePaiement: null,
            }
          : {}),

        ...(clientIds.length > 0
          ? {
              facture: {
                clientId: {
                  in: clientIds,
                },
              },
            }
          : {}),
      },
      include: {
        facture: {
          include: { client: { select: { id: true, raisonSociale: true } } },
        },
        modeReglement: { select: { libelle: true } },
      },
      orderBy: { facture: { numeroFacture: "asc" } },
    }),
    prisma.client
      .findMany({
        where: { actif: true },
        orderBy: { raisonSociale: "asc" },
        select: { id: true, raisonSociale: true },
      })
      .then((r) => r.map((c) => ({ id: c.id, libelle: c.raisonSociale }))),
    prisma.parametre.findMany({
      where: { type: { code: "mode_reglement" }, actif: true },
      orderBy: { ordreAffichage: "asc" },
      select: { id: true, libelle: true },
    }),
  ]);

  const sommeHt = paiements.reduce((s, p) => s + Number(p.montantHt), 0);
  const sommeTtc = paiements.reduce((s, p) => s + Number(p.montantTtc), 0);

  return (
    <PaiementsClient
      paiements={paiements.map((p) => ({
        id: p.id,
        factureId: p.facture.id,
        numeroFacture: p.facture.numeroFacture,
        dateFacture: p.facture.dateFacture.toISOString(),
        clientId: p.facture.client.id,
        clientNom: p.facture.client.raisonSociale,
        montantHt: Number(p.montantHt),
        montantTtc: Number(p.montantTtc),
        datePaiement: p.datePaiement?.toISOString() ?? null,
        modeReglementId: p.modeReglementId,
        modeReglementLibelle: p.modeReglement?.libelle ?? null,
        numeroPiece: p.numeroPiece,
        remarque: p.remarque,
        justificatifUrl: p.justificatifUrl,
      }))}
      clients={clients}
      modesReglement={modesReglement}
      sommeHt={sommeHt}
      sommeTtc={sommeTtc}
      filtreNonPaye={nonPayeeSeulement}
      filtreClientIds={clientIds}
    />
  );
}
