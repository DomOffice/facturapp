"use client";
// src/app/(dashboard)/paiements/page-client.tsx
import { useEffect, useMemo, useState } from "react";
import { exporterPaiementsExcel } from "@/lib/exports/excel/export-excel";
import { useRouter } from "next/navigation";
import { formatMontant } from "@/lib/utils/currency";

type Paiement = {
  id: number;
  factureId: number;
  numeroFacture: string;
  dateFacture: string;
  clientId: number;
  clientNom: string;
  montantHt: number;
  montantTtc: number;
  datePaiement: string | null;
  modeReglementId: number | null;
  modeReglementLibelle: string | null;
  numeroPiece: string | null;
  remarque: string | null;
  justificatifUrl: string | null;
};

type Option = { id: number; libelle: string };

type ColonneTri =
  | "numeroFacture"
  | "dateFacture"
  | "clientNom"
  | "montantHt"
  | "montantTtc"
  | "datePaiement"
  | "modeReglement"
  | "numeroPiece";

type DirectionTri = "asc" | "desc";
export default function PaiementsClient({
  paiements,
  clients,
  modesReglement,
  sommeHt,
  sommeTtc,
  filtreNonPaye,
  filtreClientIds,
}: {
  paiements: Paiement[];
  clients: Option[];
  modesReglement: Option[];
  sommeHt: number;
  sommeTtc: number;
  filtreNonPaye: boolean;
  filtreClientIds: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Paiement | null>(null);
  const [datePaiement, setDatePaiement] = useState("");
  const [modeReglementId, setModeReglementId] = useState<number | null>(null);
  const [numeroPiece, setNumeroPiece] = useState("");
  const [remarque, setRemarque] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const [clientsSelectionnes, setClientsSelectionnes] =
    useState<number[]>(filtreClientIds);

  const [nonPayeesSeulement, setNonPayeesSeulement] = useState(filtreNonPaye);

  const [rechercheClient, setRechercheClient] = useState("");

  const [lignesSelectionnees, setLignesSelectionnees] = useState<number[]>([]);

  const [colonneTri, setColonneTri] = useState<ColonneTri>("numeroFacture");

  const [directionTri, setDirectionTri] = useState<DirectionTri>("asc");

  const clientsFiltres = useMemo(() => {
    const normaliser = (valeur: string) =>
      valeur
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    const rechercheNormalisee = normaliser(rechercheClient);

    if (!rechercheNormalisee) {
      return clients;
    }

    const fragments = rechercheNormalisee.split(/\s+/).filter(Boolean);

    return clients.filter((client) => {
      const libelleNormalise = normaliser(client.libelle);

      return fragments.every((fragment) => libelleNormalise.includes(fragment));
    });
  }, [clients, rechercheClient]);

  function changerTri(colonne: ColonneTri) {
    if (colonneTri === colonne) {
      setDirectionTri((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setColonneTri(colonne);
    setDirectionTri("asc");
  }

  function indicateurTri(colonne: ColonneTri) {
    if (colonneTri !== colonne) {
      return "↕";
    }

    return directionTri === "asc" ? "↑" : "↓";
  }

  const paiementsAffiches = useMemo(() => {
    const resultat = paiements.filter((paiement) => {
      const clientSelectionne =
        clientsSelectionnes.length === 0 ||
        clientsSelectionnes.includes(paiement.clientId);

      const estNonPaye = !nonPayeesSeulement || paiement.datePaiement === null;

      return clientSelectionne && estNonPaye;
    });

    return [...resultat].sort((a, b) => {
      let comparaison = 0;

      switch (colonneTri) {
        case "numeroFacture":
          comparaison = a.numeroFacture.localeCompare(b.numeroFacture, "fr", {
            numeric: true,
            sensitivity: "base",
          });
          break;

        case "dateFacture":
          comparaison =
            new Date(a.dateFacture).getTime() -
            new Date(b.dateFacture).getTime();
          break;

        case "clientNom":
          comparaison = a.clientNom.localeCompare(b.clientNom, "fr", {
            sensitivity: "base",
          });
          break;

        case "montantHt":
          comparaison = a.montantHt - b.montantHt;
          break;

        case "montantTtc":
          comparaison = a.montantTtc - b.montantTtc;
          break;

        case "datePaiement": {
          const dateA = a.datePaiement ? new Date(a.datePaiement).getTime() : 0;

          const dateB = b.datePaiement ? new Date(b.datePaiement).getTime() : 0;

          comparaison = dateA - dateB;
          break;
        }

        case "modeReglement":
          comparaison = (a.modeReglementLibelle ?? "").localeCompare(
            b.modeReglementLibelle ?? "",
            "fr",
            {
              sensitivity: "base",
            },
          );
          break;

        case "numeroPiece":
          comparaison = (a.numeroPiece ?? "").localeCompare(
            b.numeroPiece ?? "",
            "fr",
            {
              numeric: true,
              sensitivity: "base",
            },
          );
          break;
      }

      return directionTri === "asc" ? comparaison : -comparaison;
    });
  }, [
    paiements,
    clientsSelectionnes,
    nonPayeesSeulement,
    colonneTri,
    directionTri,
  ]);

  useEffect(() => {
    setLignesSelectionnees(paiementsAffiches.map((paiement) => paiement.id));
  }, [paiementsAffiches]);

  /*
  const totauxAffiches = useMemo(() => {
    return paiementsAffiches.reduce(
      (totaux, paiement) => {
        totaux.ht += paiement.montantHt;
        totaux.ttc += paiement.montantTtc;

        return totaux;
      },
      {
        ht: 0,
        ttc: 0,
      },
    );
  }, [paiementsAffiches]);
*/

  const paiementsSelectionnes = useMemo(() => {
    return paiementsAffiches.filter((paiement) =>
      lignesSelectionnees.includes(paiement.id),
    );
  }, [paiementsAffiches, lignesSelectionnees]);

  const totauxAffiches = useMemo(() => {
    return paiementsSelectionnes.reduce(
      (totaux, paiement) => {
        totaux.ht += paiement.montantHt;
        totaux.ttc += paiement.montantTtc;

        return totaux;
      },
      {
        ht: 0,
        ttc: 0,
      },
    );
  }, [paiementsSelectionnes]);
  function basculerClient(clientId: number) {
    setClientsSelectionnes((selectionActuelle) =>
      selectionActuelle.includes(clientId)
        ? selectionActuelle.filter((id) => id !== clientId)
        : [...selectionActuelle, clientId],
    );
  }

  function basculerLigne(paiementId: number) {
    setLignesSelectionnees((selectionActuelle) =>
      selectionActuelle.includes(paiementId)
        ? selectionActuelle.filter((id) => id !== paiementId)
        : [...selectionActuelle, paiementId],
    );
  }

  function basculerToutesLesLignes() {
    const idsAffiches = paiementsAffiches.map((paiement) => paiement.id);

    const toutesSelectionnees = idsAffiches.every((id) =>
      lignesSelectionnees.includes(id),
    );

    if (toutesSelectionnees) {
      setLignesSelectionnees([]);
    } else {
      setLignesSelectionnees(idsAffiches);
    }
  }

  function appliquerFiltres() {
    const params = new URLSearchParams();

    if (clientsSelectionnes.length > 0) {
      params.set("clients", clientsSelectionnes.join(","));
    }

    if (nonPayeesSeulement) {
      params.set("nonPayees", "1");
    }

    const query = params.toString();

    router.push(query ? `/paiements?${query}` : "/paiements");
  }

  function reinitialiserFiltres() {
    setClientsSelectionnes([]);
    setNonPayeesSeulement(false);
    setRechercheClient("");
    router.push("/paiements");
  }
  function selectPaiement(p: Paiement) {
    setSelected(p);
    setDatePaiement(p.datePaiement ? p.datePaiement.split("T")[0] : "");
    setModeReglementId(p.modeReglementId);
    setNumeroPiece(p.numeroPiece ?? "");
    setRemarque(p.remarque ?? "");
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 50);
  }

  async function sauvegarder() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/paiements/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datePaiement: datePaiement || null,
          modeReglementId,
          numeroPiece,
          remarque,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSelected(null);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcelExport() {
    setLoadingExcel(true);
    try {
      await exporterPaiementsExcel(
        paiements.map((p) => ({
          numeroFacture: p.numeroFacture,
          dateFacture: p.dateFacture,
          clientNom: p.clientNom,
          montantHt: p.montantHt,
          montantTtc: p.montantTtc,
          datePaiement: p.datePaiement,
          modeReglement: p.modeReglementLibelle,
          numeroPiece: p.numeroPiece,
          remarque: p.remarque,
          estPayee: !!p.datePaiement,
        })),
      );
    } catch {
      alert("Erreur export Excel");
    } finally {
      setLoadingExcel(false);
    }
  }

  return (
    <div className="p-6">
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="page-title">Suivi des paiements</h1>
          <button
            type="button"
            onClick={handleExcelExport}
            disabled={loadingExcel}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            {loadingExcel ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 1h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
                <path d="M5 5h6M5 8h3M8 11v3M6 13l2 2 2-2" />
              </svg>
            )}
            Excel
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="card mb-4 p-3 flex gap-4 flex-wrap items-end">
        <div className="relative">
          <label className="form-label">Clients</label>

          <details
            className="relative"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.currentTarget.open = false;
                setRechercheClient("");
              }
            }}
          >
            <summary className="form-select w-64 cursor-pointer list-none">
              {clientsSelectionnes.length === 0
                ? "Tous les clients"
                : `${clientsSelectionnes.length} client${
                    clientsSelectionnes.length > 1 ? "s" : ""
                  } sélectionné${clientsSelectionnes.length > 1 ? "s" : ""}`}
            </summary>

            <div className="absolute z-20 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              <div className="sticky top-0 z-10 bg-white pb-2">
                <input
                  type="search"
                  value={rechercheClient}
                  onChange={(event) => setRechercheClient(event.target.value)}
                  placeholder="Rechercher un client..."
                  className="form-input w-full text-sm"
                  onClick={(event) => event.stopPropagation()}
                />
              </div>

              <button
                type="button"
                onClick={() => setClientsSelectionnes([])}
                className="mb-2 w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100"
              >
                Tous les clients
              </button>

              <div className="border-t border-slate-100 pt-2">
                {clientsFiltres.map((client) => (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={clientsSelectionnes.includes(client.id)}
                      onChange={() => basculerClient(client.id)}
                      className="h-4 w-4"
                    />

                    <span>{client.libelle}</span>
                  </label>
                ))}
                {clientsFiltres.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-slate-400">
                    Aucun client trouvé.
                  </p>
                )}
              </div>
            </div>
          </details>
        </div>

        <label className="flex cursor-pointer items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={nonPayeesSeulement}
            onChange={(event) => setNonPayeesSeulement(event.target.checked)}
            className="h-4 w-4"
          />

          <span className="text-sm text-slate-600">Non payées seulement</span>
        </label>

        <button
          type="button"
          onClick={appliquerFiltres}
          className="btn-secondary"
        >
          Filtrer
        </button>

        {(clientsSelectionnes.length > 0 || nonPayeesSeulement) && (
          <button
            type="button"
            onClick={reinitialiserFiltres}
            className="btn-ghost"
          >
            Réinitialiser
          </button>
        )}

        <span className="mr-3 text-slate-400">
          {paiementsSelectionnes.length}/{paiementsAffiches.length} facture(s)
        </span>

        <div className="ml-auto text-sm text-slate-500">
          Somme HT :{" "}
          <span className="font-semibold text-slate-700">
            {formatMontant(totauxAffiches.ht)}
          </span>{" "}
          | Somme TTC :{" "}
          <span className="font-semibold text-indigo-600">
            {formatMontant(totauxAffiches.ttc)}
          </span>
        </div>
      </div>

      {/* Panneau de saisie paiement */}
      {selected && (
        <div className="card mb-4 p-4 border-2 border-indigo-200 bg-indigo-50">
          <div className="flex items-center gap-6 mb-3 text-sm">
            <span>
              <span className="text-slate-500">N° Facture :</span>{" "}
              <strong>{selected.numeroFacture}</strong>
            </span>
            <span>
              <span className="text-slate-500">Date :</span>{" "}
              {new Date(selected.dateFacture).toLocaleDateString("fr-FR")}
            </span>
            <span>
              <span className="text-slate-500">Client :</span>{" "}
              <strong>{selected.clientNom}</strong>
            </span>
            <span>
              <span className="text-slate-500">Montant HT :</span>{" "}
              <strong>{formatMontant(selected.montantHt)}</strong>
            </span>
            <span>
              <span className="text-slate-500">Montant TTC :</span>{" "}
              <strong className="text-indigo-600">
                {formatMontant(selected.montantTtc)}
              </strong>
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="form-label">Date encaissement</label>
              <input
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Mode de règlement</label>
              <select
                value={modeReglementId ?? ""}
                onChange={(e) =>
                  setModeReglementId(Number(e.target.value) || null)
                }
                className="form-select"
              >
                <option value="">—</option>
                {modesReglement.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Numéro de la pièce</label>
              <input
                value={numeroPiece}
                onChange={(e) => setNumeroPiece(e.target.value)}
                className="form-input"
                placeholder="N° chèque, virement..."
              />
            </div>
            <div>
              <label className="form-label">Remarque</label>
              <input
                value={remarque}
                onChange={(e) => setRemarque(e.target.value)}
                className="form-input"
                placeholder="Optionnel"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={sauvegarder}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Enregistrement..." : "Valider"}
            </button>
            <button onClick={() => setSelected(null)} className="btn-secondary">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste paiements */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    paiementsAffiches.length > 0 &&
                    paiementsAffiches.every((paiement) =>
                      lignesSelectionnees.includes(paiement.id),
                    )
                  }
                  onChange={basculerToutesLesLignes}
                  className="h-4 w-4 cursor-pointer"
                  title="Tout sélectionner / désélectionner"
                />
              </th>
              <th>
                <button
                  type="button"
                  onClick={() => changerTri("numeroFacture")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  N° Facture
                  <span className="text-xs">
                    {indicateurTri("numeroFacture")}
                  </span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("dateFacture")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Date
                  <span className="text-xs">
                    {indicateurTri("dateFacture")}
                  </span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("clientNom")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Client
                  <span className="text-xs">{indicateurTri("clientNom")}</span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("montantHt")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Montant HT
                  <span className="text-xs">{indicateurTri("montantHt")}</span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("montantTtc")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Montant TTC
                  <span className="text-xs">{indicateurTri("montantTtc")}</span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("datePaiement")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Date encaissement
                  <span className="text-xs">
                    {indicateurTri("datePaiement")}
                  </span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("modeReglement")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Mode règlement
                  <span className="text-xs">
                    {indicateurTri("modeReglement")}
                  </span>
                </button>
              </th>

              <th>
                <button
                  type="button"
                  onClick={() => changerTri("numeroPiece")}
                  className="flex w-full items-center gap-1 text-left hover:text-indigo-600"
                >
                  Numéro pièce
                  <span className="text-xs">
                    {indicateurTri("numeroPiece")}
                  </span>
                </button>
              </th>

              <th>Remarque</th>
              <th>Justif.</th>
            </tr>
          </thead>
          <tbody>
            {paiementsAffiches.map((p) => (
              <tr
                key={p.id}
                onClick={() => selectPaiement(p)}
                className={`cursor-pointer ${selected?.id === p.id ? "bg-indigo-50" : ""}`}
              >
                <td
                  className="w-10 text-center"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={lignesSelectionnees.includes(p.id)}
                    onChange={() => basculerLigne(p.id)}
                    className="h-4 w-4 cursor-pointer"
                  />
                </td>
                <td className="font-mono font-semibold text-indigo-600">
                  {p.numeroFacture}
                </td>
                <td className="text-slate-500">
                  {new Date(p.dateFacture).toLocaleDateString("fr-FR")}
                </td>
                <td className="max-w-xs truncate">{p.clientNom}</td>
                <td>{formatMontant(p.montantHt)}</td>
                <td className="font-semibold">{formatMontant(p.montantTtc)}</td>
                <td>
                  {p.datePaiement ? (
                    <span className="badge badge-success">
                      {new Date(p.datePaiement).toLocaleDateString("fr-FR")}
                    </span>
                  ) : (
                    <span className="badge badge-warning">Non payée</span>
                  )}
                </td>
                <td className="text-slate-500">
                  {p.modeReglementLibelle ?? "—"}
                </td>
                <td className="text-slate-500 font-mono">
                  {p.numeroPiece ?? "—"}
                </td>
                <td className="text-slate-400">{p.remarque ?? "—"}</td>
                <td>
                  {p.justificatifUrl ? (
                    <span className="badge badge-success">Oui</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {paiementsAffiches.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="py-8 text-center text-sm text-slate-400"
                >
                  Aucun paiement ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
