"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClientSimple = {
  id: number;
  raisonSociale: string;
  ville: string | null;
};

type ProduitSimple = {
  id: number;
  reference: string;
  description: string;
};

type LigneBlForm = {
  idTemp: string;
  produitId: number | null;
  designation: string;
  quantite: number;
};

type ConflitDoublon = {
  idTempExistant: string;
  designation: string;
  quantiteActuelle: number;
  nouvelleQuantite: number;
  produitId: number | null;
};

export default function FormNouveauBlMobile({
  clientsInitiaux,
  produitsInitiaux,
}: {
  clientsInitiaux: ClientSimple[];
  produitsInitiaux: ProduitSimple[];
}) {
  const router = useRouter();

  // État du formulaire
  const [clientId, setClientId] = useState<number | "">("");
  const [rechercheClient, setRechercheClient] = useState("");
  const [dateLivraison, setDateLivraison] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [remarque, setRemarque] = useState("");

  const [estIncomplet, setEstIncomplet] = useState(false);
  const [articlesManquants, setArticlesManquants] = useState("");

  const [lignes, setLignes] = useState<LigneBlForm[]>([]);

  // Recherche produit en cours
  const [rechercheProduit, setRechercheProduit] = useState("");
  const [produitSelectionne, setProduitSelectionne] =
    useState<ProduitSimple | null>(null);
  const [designationLibre, setDesignationLibre] = useState("");
  const [quantiteAjout, setQuantiteAjout] = useState<number>(1);

  // Modale doublon
  const [conflit, setConflit] = useState<ConflitDoublon | null>(null);

  // Validation
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Normalisation pour recherche insensible à la casse et aux accents
  function normaliserTexte(txt: string) {
    return txt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Filtrage multi-mots des clients
  const clientsFiltres = useMemo(() => {
    if (!rechercheClient.trim()) return clientsInitiaux.slice(0, 15);
    const mots = normaliserTexte(rechercheClient).split(/\s+/).filter(Boolean);
    return clientsInitiaux
      .filter((c) => {
        const cible = normaliserTexte(`${c.raisonSociale} ${c.ville || ""}`);
        return mots.every((mot) => cible.includes(mot));
      })
      .slice(0, 15);
  }, [clientsInitiaux, rechercheClient]);

  // Filtrage multi-mots des produits
  const produitsFiltres = useMemo(() => {
    if (!rechercheProduit.trim() || rechercheProduit.trim().length < 2)
      return [];
    const mots = normaliserTexte(rechercheProduit).split(/\s+/).filter(Boolean);

    return produitsInitiaux
      .filter((p) => {
        const cible = normaliserTexte(`${p.reference} ${p.description}`);
        return mots.every((mot) => cible.includes(mot));
      })
      .slice(0, 25);
  }, [produitsInitiaux, rechercheProduit]);

  function tenterAjoutLigne() {
    const libelle = produitSelectionne
      ? produitSelectionne.description
      : designationLibre.trim();
    if (!libelle) return;
    const qteAAjouter = quantiteAjout > 0 ? quantiteAjout : 1;
    const targetProduitId = produitSelectionne ? produitSelectionne.id : null;

    // Vérifier si la ligne existe déjà
    const ligneExistante = lignes.find((l) => {
      if (targetProduitId && l.produitId) {
        return l.produitId === targetProduitId;
      }
      return normaliserTexte(l.designation) === normaliserTexte(libelle);
    });

    if (ligneExistante) {
      setConflit({
        idTempExistant: ligneExistante.idTemp,
        designation: ligneExistante.designation,
        quantiteActuelle: ligneExistante.quantite,
        nouvelleQuantite: qteAAjouter,
        produitId: targetProduitId,
      });
      return;
    }

    // Ajout standard si pas de doublon
    insererNouvelleLigne(targetProduitId, libelle, qteAAjouter);
  }

  function insererNouvelleLigne(
    prodId: number | null,
    libelle: string,
    qte: number,
  ) {
    setLignes((prev) => [
      ...prev,
      {
        idTemp: Math.random().toString(36).substring(2, 9),
        produitId: prodId,
        designation: libelle,
        quantite: qte,
      },
    ]);
    reinitialiserChampsSaisie();
  }

  function reinitialiserChampsSaisie() {
    setProduitSelectionne(null);
    setDesignationLibre("");
    setRechercheProduit("");
    setQuantiteAjout(1);
    setConflit(null);
  }

  // Résolutions du conflit
  function resoudreAddition() {
    if (!conflit) return;
    setLignes((prev) =>
      prev.map((l) =>
        l.idTemp === conflit.idTempExistant
          ? { ...l, quantite: l.quantite + conflit.nouvelleQuantite }
          : l,
      ),
    );
    reinitialiserChampsSaisie();
  }

  function resoudreRemplacement() {
    if (!conflit) return;
    setLignes((prev) =>
      prev.map((l) =>
        l.idTemp === conflit.idTempExistant
          ? { ...l, quantite: conflit.nouvelleQuantite }
          : l,
      ),
    );
    reinitialiserChampsSaisie();
  }

  function modifierQuantite(idTemp: string, delta: number) {
    setLignes((prev) =>
      prev
        .map((l) => {
          if (l.idTemp === idTemp) {
            const nouvelleQte = l.quantite + delta;
            return nouvelleQte > 0 ? { ...l, quantite: nouvelleQte } : null;
          }
          return l;
        })
        .filter((l): l is LigneBlForm => l !== null),
    );
  }

  function supprimerLigne(idTemp: string) {
    setLignes((prev) => prev.filter((l) => l.idTemp !== idTemp));
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (!clientId) {
      setErreur("Veuillez sélectionner un client.");
      return;
    }

    if (lignes.length === 0) {
      setErreur("Veuillez ajouter au moins un article.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/bl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(clientId),
          dateLivraison,
          remarque: remarque.trim() || undefined,
          estIncomplet,
          articlesManquants: articlesManquants.trim() || undefined,
          lignes: lignes.map((l) => ({
            produitId: l.produitId,
            designation: l.designation,
            quantite: l.quantite,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "Une erreur est survenue lors de l'enregistrement.",
        );
      }

      router.push("/bl");
      router.refresh();
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  const clientActuel = clientsInitiaux.find((c) => c.id === clientId);

  return (
    <div className="max-w-xl mx-auto pb-28 px-3 sm:px-4">
      {/* En-tête mobile */}
      <div className="flex items-center justify-between py-3 mb-2 border-b border-slate-200">
        <Link
          href="/bl"
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← Retour
        </Link>
        <h1 className="text-base font-bold text-slate-800">
          Nouveau Bon de Livraison
        </h1>
        <span className="w-10"></span>
      </div>

      {erreur && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {erreur}
        </div>
      )}

      <form onSubmit={soumettre} className="space-y-4">
        {/* Section 1 : Client & Date */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Client *
            </label>
            {clientActuel ? (
              <div className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <span className="font-medium text-indigo-950 text-sm">
                  {clientActuel.raisonSociale}
                </span>
                <button
                  type="button"
                  onClick={() => setClientId("")}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Rechercher client (ex: ber cas)..."
                  value={rechercheClient}
                  onChange={(e) => setRechercheClient(e.target.value)}
                  className="form-input w-full text-sm py-2"
                />
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {clientsFiltres.length === 0 ? (
                    <p className="p-2 text-xs text-slate-400 text-center">
                      Aucun client trouvé
                    </p>
                  ) : (
                    clientsFiltres.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClientId(c.id);
                          setRechercheClient("");
                        }}
                        className="w-full text-left p-2.5 text-sm hover:bg-slate-50 active:bg-indigo-50 flex justify-between items-center"
                      >
                        <span className="font-medium text-slate-800">
                          {c.raisonSociale}
                        </span>
                        {c.ville && (
                          <span className="text-xs text-slate-400">
                            {c.ville}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Date de livraison
            </label>
            <input
              type="date"
              value={dateLivraison}
              onChange={(e) => setDateLivraison(e.target.value)}
              className="form-input w-full text-sm py-2"
            />
          </div>
        </div>

        {/* Section 2 : Ajout d'articles dynamique */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Rechercher un article
          </label>

          <div className="space-y-1">
            <input
              type="text"
              placeholder="Taper qques lettres combinées (ex: ton hp neg)..."
              value={
                produitSelectionne
                  ? produitSelectionne.description
                  : rechercheProduit
              }
              onChange={(e) => {
                setRechercheProduit(e.target.value);
                setProduitSelectionne(null);
              }}
              className="form-input w-full text-sm py-2"
            />

            {rechercheProduit.trim().length > 1 && !produitSelectionne && (
              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-xl">
                {produitsFiltres.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 text-center">
                    Aucun article correspondant
                  </p>
                ) : (
                  produitsFiltres.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProduitSelectionne(p);
                        setRechercheProduit("");
                      }}
                      className="w-full text-left p-2.5 text-xs hover:bg-slate-50 active:bg-indigo-50"
                    >
                      <div className="font-semibold text-slate-800">
                        {p.reference}
                      </div>
                      <div className="text-slate-600 truncate">
                        {p.description}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {!produitSelectionne && (
            <div>
              <span className="text-[11px] text-slate-400">
                Ou article hors catalogue :
              </span>
              <input
                type="text"
                placeholder="Désignation personnalisée..."
                value={designationLibre}
                onChange={(e) => setDesignationLibre(e.target.value)}
                className="form-input w-full text-sm py-1.5 mt-0.5"
              />
            </div>
          )}

          {/* Ajustement Quantité + Ajout */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
              <button
                type="button"
                onClick={() => setQuantiteAjout((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center text-slate-600 text-lg font-bold active:bg-slate-200"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={quantiteAjout}
                onChange={(e) =>
                  setQuantiteAjout(Math.max(1, Number(e.target.value)))
                }
                className="w-12 text-center bg-transparent text-sm font-semibold text-slate-800 border-none focus:ring-0 p-0"
              />
              <button
                type="button"
                onClick={() => setQuantiteAjout((q) => q + 1)}
                className="w-10 h-10 flex items-center justify-center text-slate-600 text-lg font-bold active:bg-slate-200"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={tenterAjoutLigne}
              disabled={!produitSelectionne && !designationLibre.trim()}
              className="flex-1 h-10 bg-slate-800 text-white text-sm font-semibold rounded-lg active:bg-slate-900 disabled:opacity-40"
            >
              Ajouter au bon
            </button>
          </div>
        </div>

        {/* Section 3 : Articles saisis */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Articles saisis ({lignes.length})
          </label>

          {lignes.length === 0 ? (
            <p className="text-center py-6 text-sm text-slate-400">
              Aucun article dans ce bon pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lignes.map((ligne) => (
                <div
                  key={ligne.idTemp}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <p className="text-sm font-medium text-slate-800 flex-1 leading-snug">
                    {ligne.designation}
                  </p>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 rounded-md bg-slate-50">
                      <button
                        type="button"
                        onClick={() => modifierQuantite(ligne.idTemp, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 font-bold active:bg-slate-200 text-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-800">
                        {ligne.quantite}
                      </span>
                      <button
                        type="button"
                        onClick={() => modifierQuantite(ligne.idTemp, 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 font-bold active:bg-slate-200 text-sm"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => supprimerLigne(ligne.idTemp)}
                      className="p-1.5 text-slate-400 hover:text-red-500"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 4 : Statut incomplet */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                checked={estIncomplet}
                onChange={(e) => setEstIncomplet(e.target.checked)}
                className="w-5 h-5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-800">
                Signaler comme incomplet
              </span>
              <span className="text-xs text-slate-500">
                Articles manquants au catalogue. Le BL ne pourra pas être
                facturé en l'état.
              </span>
            </div>
          </label>

          {estIncomplet && (
            <textarea
              placeholder="Listez ici les articles manquants (désignation, quantité)..."
              value={articlesManquants}
              onChange={(e) => setArticlesManquants(e.target.value)}
              className="form-input w-full text-sm p-3 rounded-xl border-amber-200 bg-amber-50 focus:border-amber-400 focus:ring-amber-400"
              rows={3}
            />
          )}
        </div>

        <div>
          <textarea
            placeholder="Remarque ou instruction particulière..."
            value={remarque}
            onChange={(e) => setRemarque(e.target.value)}
            className="form-input w-full text-sm p-3 rounded-xl border-slate-200"
            rows={2}
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-slate-200 md:static md:bg-transparent md:border-0 md:p-0 z-30">
          <div className="max-w-xl mx-auto">
            <button
              type="submit"
              disabled={loading || !clientId || lignes.length === 0}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-base shadow-md disabled:opacity-40 transition-colors"
            >
              {loading ? "Création en cours..." : "Valider le bon de livraison"}
            </button>
          </div>
        </div>
      </form>

      {/* Modale interactive de conflit Doublon */}
      {conflit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-800">
              Article déjà présent
            </h3>
            <p className="text-sm text-slate-600">
              L'article{" "}
              <strong className="text-slate-800">
                « {conflit.designation} »
              </strong>{" "}
              est déjà dans ce bon avec une quantité de{" "}
              <strong>{conflit.quantiteActuelle}</strong>.
            </p>
            <p className="text-xs text-slate-500">
              Que souhaitez-vous faire avec les{" "}
              <strong>+{conflit.nouvelleQuantite}</strong> en cours d'ajout ?
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={resoudreAddition}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold text-center"
              >
                Additionner (Total :{" "}
                {conflit.quantiteActuelle + conflit.nouvelleQuantite})
              </button>
              <button
                type="button"
                onClick={resoudreRemplacement}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold text-center"
              >
                Remplacer la quantité ({conflit.nouvelleQuantite})
              </button>
              <button
                type="button"
                onClick={() => setConflit(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm font-medium text-center"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
