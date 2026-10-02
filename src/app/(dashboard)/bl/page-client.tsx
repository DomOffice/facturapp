"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LigneBl = {
  id: number;
  ordreLigne: number;
  produitId: number | null;
  designation: string;
  quantite: number;
  produit: { id: number; reference: string; description: string } | null;
};

type BonLivraisonItem = {
  id: number;
  numeroBl: string;
  clientId: number;
  dateLivraison: string;
  statut: string;
  estIncomplet: boolean;
  articlesManquants: string | null;
  factureId: number | null;
  remarque: string | null;
  client: { id: number; raisonSociale: string; ville: string | null };
  lignes: LigneBl[];
  facture: { id: number; numeroFacture: string } | null;
};

type ColonneTri = "numeroBl" | "dateLivraison" | "client" | "statut";

export default function BonsLivraisonClient({
  bonsLivraisonInitiaux,
  clients,
}: {
  bonsLivraisonInitiaux: BonLivraisonItem[];
  clients: { id: number; raisonSociale: string }[];
}) {
  const router = useRouter();

  // Filtres
  const [clientIdFiltre, setClientIdFiltre] = useState<number | "">("");
  const [statutFiltre, setStatutFiltre] = useState<string>("livre");

  // Tri
  const [colonneTri, setColonneTri] = useState<ColonneTri>("dateLivraison");
  const [directionTri, setDirectionTri] = useState<"asc" | "desc">("desc");

  // Sélection
  const [blSelectionnes, setBlSelectionnes] = useState<number[]>([]);

  // Modale avertissement BL oubliés
  const [blOublies, setBlOublies] = useState<BonLivraisonItem[]>([]);
  const [blIncompletsEnAttente, setBlIncompletsEnAttente] = useState<
    BonLivraisonItem[]
  >([]);
  const [modaleAvertissementOuverte, setModaleAvertissementOuverte] =
    useState(false);

  function alternerTri(colonne: ColonneTri) {
    if (colonneTri === colonne) {
      setDirectionTri((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setColonneTri(colonne);
      setDirectionTri("asc");
    }
  }

  // Filtrage et Tri combinés
  const bonsFiltresEtTries = useMemo(() => {
    const filtres = bonsLivraisonInitiaux.filter((bl) => {
      const matchClient = !clientIdFiltre || bl.clientId === clientIdFiltre;
      const matchStatut = statutFiltre === "tous" || bl.statut === statutFiltre;
      return matchClient && matchStatut;
    });

    return [...filtres].sort((a, b) => {
      let comp = 0;
      if (colonneTri === "numeroBl")
        comp = a.numeroBl.localeCompare(b.numeroBl);
      else if (colonneTri === "dateLivraison")
        comp =
          new Date(a.dateLivraison).getTime() -
          new Date(b.dateLivraison).getTime();
      else if (colonneTri === "client")
        comp = a.client.raisonSociale.localeCompare(b.client.raisonSociale);
      else if (colonneTri === "statut") comp = a.statut.localeCompare(b.statut);

      return directionTri === "asc" ? comp : -comp;
    });
  }, [
    bonsLivraisonInitiaux,
    clientIdFiltre,
    statutFiltre,
    colonneTri,
    directionTri,
  ]);

  // Cohérence client unique
  const clientUniqueSelection = useMemo(() => {
    if (blSelectionnes.length === 0) return null;
    const selection = bonsLivraisonInitiaux.filter((b) =>
      blSelectionnes.includes(b.id),
    );
    const clientIds = Array.from(new Set(selection.map((b) => b.clientId)));
    return clientIds.length === 1 ? clientIds[0] : "multiple";
  }, [blSelectionnes, bonsLivraisonInitiaux]);

  function basculerSelection(id: number) {
    setBlSelectionnes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function basculerTout() {
    const idsEligibles = bonsFiltresEtTries
      .filter((bl) => bl.statut === "livre" && !bl.estIncomplet)
      .map((bl) => bl.id);

    if (blSelectionnes.length === idsEligibles.length) {
      setBlSelectionnes([]);
    } else {
      setBlSelectionnes(idsEligibles);
    }
  }

  function lancerVerificationConversion() {
    if (clientUniqueSelection === "multiple") {
      alert(
        "Tous les bons de livraison sélectionnés doivent appartenir au même client.",
      );
      return;
    }
    if (!clientUniqueSelection) return;

    // 1. Détecter les BL livrés complets non cochés
    const completsOublies = bonsLivraisonInitiaux.filter(
      (b) =>
        b.clientId === clientUniqueSelection &&
        b.statut === "livre" &&
        !b.estIncomplet &&
        !blSelectionnes.includes(b.id),
    );

    // 2. Détecter les BL livrés INCOMPLETS en attente pour ce même client
    const incomplets = bonsLivraisonInitiaux.filter(
      (b) =>
        b.clientId === clientUniqueSelection &&
        b.statut === "livre" &&
        b.estIncomplet,
    );

    if (completsOublies.length > 0 || incomplets.length > 0) {
      setBlOublies(completsOublies);
      setBlIncompletsEnAttente(incomplets);
      setModaleAvertissementOuverte(true);
    } else {
      poursuivreConversion(blSelectionnes);
    }
  }

  function poursuivreConversion(ids: number[]) {
    router.push(`/bl/convertir?ids=${ids.join(",")}`);
  }

  function inclureToutEtConvertir() {
    const tousLesIds = [...blSelectionnes, ...blOublies.map((b) => b.id)];
    poursuivreConversion(tousLesIds);
  }

  function formaterDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Bons de livraison
          </h1>
          <p className="text-xs text-slate-500">
            Gestion des livraisons terrain et conversion groupée en factures
          </p>
        </div>

        <Link
          href="/bl/nouveau"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Nouveau BL
        </Link>
      </div>

      {/* Barre d'action et filtres */}
      <div className="card p-3 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={clientIdFiltre}
            onChange={(e) =>
              setClientIdFiltre(e.target.value ? Number(e.target.value) : "")
            }
            className="form-select py-1.5 px-3 text-sm min-w-[200px]"
          >
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <span>Statut :</span>
            <select
              value={statutFiltre}
              onChange={(e) => setStatutFiltre(e.target.value)}
              className="form-select py-1.5 px-3 text-sm"
            >
              <option value="livre">À facturer (Livré)</option>
              <option value="facture">Déjà facturé</option>
              <option value="tous">Tous</option>
            </select>
          </div>

          {(clientIdFiltre !== "" || statutFiltre !== "livre") && (
            <button
              type="button"
              onClick={() => {
                setClientIdFiltre("");
                setStatutFiltre("livre");
              }}
              className="btn-ghost btn-sm text-xs text-slate-500"
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {blSelectionnes.length} BL sélectionné(s)
          </span>
          <button
            type="button"
            onClick={lancerVerificationConversion}
            disabled={
              blSelectionnes.length === 0 ||
              clientUniqueSelection === "multiple"
            }
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Convertir en facture
          </button>
        </div>
      </div>

      {clientUniqueSelection === "multiple" && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
          Attention : vous avez sélectionné des BL de clients différents.
          Veuillez ne cocher que des BL d'un même client.
        </div>
      )}

      {/* VUE TABLEAU (Desktop) */}
      <div className="hidden md:block card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 select-none">
              <tr>
                <th className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    onChange={basculerTout}
                    checked={
                      bonsFiltresEtTries.length > 0 &&
                      bonsFiltresEtTries.filter((b) => b.statut === "livre")
                        .length > 0 &&
                      blSelectionnes.length ===
                        bonsFiltresEtTries.filter((b) => b.statut === "livre")
                          .length
                    }
                    className="h-4 w-4 rounded"
                  />
                </th>
                <th
                  onClick={() => alternerTri("numeroBl")}
                  className="px-3 py-2 text-left cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>N° BL</span>
                    {colonneTri === "numeroBl" &&
                      (directionTri === "asc" ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => alternerTri("dateLivraison")}
                  className="px-3 py-2 text-left cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {colonneTri === "dateLivraison" &&
                      (directionTri === "asc" ? " ↑" : " ↓")}
                  </div>
                </th>
                <th
                  onClick={() => alternerTri("client")}
                  className="px-3 py-2 text-left cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Client</span>
                    {colonneTri === "client" &&
                      (directionTri === "asc" ? " ↑" : " ↓")}
                  </div>
                </th>
                <th className="px-3 py-2 text-left">Articles livrés</th>
                <th
                  onClick={() => alternerTri("statut")}
                  className="px-3 py-2 text-center cursor-pointer hover:bg-slate-100"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Statut</span>
                    {colonneTri === "statut" &&
                      (directionTri === "asc" ? " ↑" : " ↓")}
                  </div>
                </th>
                <th className="px-3 py-2 text-left">Facture</th>
                <th className="w-16 px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bonsFiltresEtTries.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-slate-400"
                  >
                    Aucun bon de livraison trouvé.
                  </td>
                </tr>
              ) : (
                bonsFiltresEtTries.map((bl) => {
                  const estLivre = bl.statut === "livre";
                  const peutEtreFacture = estLivre && !bl.estIncomplet;

                  return (
                    <tr
                      key={bl.id}
                      className={`hover:bg-slate-50 ${
                        blSelectionnes.includes(bl.id) ? "bg-indigo-50/50" : ""
                      } ${bl.estIncomplet && estLivre ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-3 py-2 text-center">
                        {peutEtreFacture ? (
                          <input
                            type="checkbox"
                            checked={blSelectionnes.includes(bl.id)}
                            onChange={() => basculerSelection(bl.id)}
                            className="h-4 w-4 rounded"
                          />
                        ) : bl.estIncomplet && estLivre ? (
                          <span
                            className="inline-flex items-center justify-center text-amber-600 font-bold text-sm cursor-help"
                            title={`BL Incomplet : ${bl.articlesManquants || "Articles non référencés"}`}
                          >
                            ⚠️
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800">
                        {bl.numeroBl}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {formaterDate(bl.dateLivraison)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {bl.client.raisonSociale}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        <div className="max-w-md text-xs">
                          <div className="truncate">
                            {bl.lignes
                              .map((l) => `${l.quantite}x ${l.designation}`)
                              .join(", ")}
                          </div>
                          {bl.estIncomplet && bl.articlesManquants && (
                            <div className="text-amber-700 font-medium truncate mt-0.5 flex items-center gap-1">
                              <span>⚠️ Manquant(s) :</span>
                              <span className="italic">
                                {bl.articlesManquants}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {estLivre ? (
                          bl.estIncomplet ? (
                            <span className="badge bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">
                              Incomplet
                            </span>
                          ) : (
                            <span className="badge badge-warning text-xs">
                              À facturer
                            </span>
                          )
                        ) : (
                          <span className="badge badge-success text-xs">
                            Facturé
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {bl.facture && bl.factureId ? (
                          <Link
                            href={`/factures/${bl.factureId}`}
                            className="text-indigo-600 font-semibold hover:underline"
                            title="Ouvrir la facture"
                          >
                            {bl.facture.numeroFacture}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {estLivre ? (
                          <Link
                            href={`/bl/${bl.id}`}
                            className="text-slate-500 hover:text-indigo-600 p-1 inline-block"
                            title="Modifier le BL"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </Link>
                        ) : (
                          <span
                            className="text-slate-300 p-1 inline-block cursor-not-allowed"
                            title="Facturé : modifiez directement la facture"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VUE MOBILE */}
      <div className="md:hidden space-y-3">
        {bonsFiltresEtTries.map((bl) => {
          const estLivre = bl.statut === "livre";
          return (
            <div
              key={bl.id}
              className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {estLivre && (
                    <input
                      type="checkbox"
                      checked={blSelectionnes.includes(bl.id)}
                      onChange={() => basculerSelection(bl.id)}
                      className="h-5 w-5 rounded"
                    />
                  )}
                  <span className="font-mono font-bold text-sm text-slate-800">
                    {bl.numeroBl}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {estLivre ? (
                    <Link
                      href={`/bl/${bl.id}`}
                      className="text-xs text-indigo-600 font-medium"
                    >
                      Modifier
                    </Link>
                  ) : null}
                  <span
                    className={`badge text-[11px] ${estLivre ? "badge-warning" : "badge-success"}`}
                  >
                    {estLivre ? "À facturer" : "Facturé"}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {bl.client.raisonSociale}
                </span>
                <span>{formaterDate(bl.dateLivraison)}</span>
              </div>

              <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-600 divide-y divide-slate-100">
                {bl.lignes.map((l) => (
                  <div key={l.id} className="py-1 flex justify-between">
                    <span className="truncate pr-2">{l.designation}</span>
                    <span className="font-semibold shrink-0">
                      Qté : {l.quantite}
                    </span>
                  </div>
                ))}
              </div>

              {bl.facture && bl.factureId && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  Facture :{" "}
                  <Link
                    href={`/factures/${bl.factureId}`}
                    className="font-mono font-bold text-indigo-600 underline"
                  >
                    {bl.facture.numeroFacture}
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modale d'avertissement intelligente (BL incomplets & BL oubliés) */}
      {modaleAvertissementOuverte && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Attention : d'autres bons de livraison existent pour ce client
                </h3>
                <p className="text-xs text-slate-500">
                  Vérifiez la situation avant de lancer la facturation.
                </p>
              </div>
            </div>

            {/* Avertissement spécifique : BL Incomplets */}
            {blIncompletsEnAttente.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide">
                  <span>BL incomplets en cours ({blIncompletsEnAttente.length}) :</span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-amber-200/60 text-xs">
                  {blIncompletsEnAttente.map((b) => (
                    <div key={b.id} className="py-1.5 flex flex-col gap-0.5">
                      <div className="flex justify-between font-medium text-amber-950">
                        <span className="font-mono font-semibold">{b.numeroBl}</span>
                        <span>{formaterDate(b.dateLivraison)}</span>
                      </div>
                      {b.articlesManquants && (
                        <p className="text-[11px] text-amber-800 italic">
                          Manquants : {b.articlesManquants}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-amber-700">
                  Ces bons ne peuvent pas être facturés en l'état. Vous pouvez les compléter d'abord ou continuer la facturation sans eux.
                </p>
              </div>
            )}

            {/* Avertissement : BL Complets non sélectionnés */}
            {blOublies.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">
                  BL prêts à facturer non cochés ({blOublies.length}) :
                </p>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 p-2 text-xs">
                  {blOublies.map((b) => (
                    <div key={b.id} className="py-1 flex justify-between">
                      <span className="font-mono font-semibold text-slate-700">{b.numeroBl}</span>
                      <span className="text-slate-500">{formaterDate(b.dateLivraison)}</span>
                      <span className="text-slate-500">{b.lignes.length} article(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Boutons d'action clairs */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModaleAvertissementOuverte(false)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Revenir et compléter les BL
              </button>

              <button
                type="button"
                onClick={() => {
                  setModaleAvertissementOuverte(false);
                  poursuivreConversion(blSelectionnes);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Continuer sans les BL incomplets
              </button>

              {blOublies.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setModaleAvertissementOuverte(false);
                    inclureToutEtConvertir();
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  Inclure les BL prêts
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
