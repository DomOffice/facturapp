"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMontant } from "@/lib/utils/currency";

type ResultatRechercheArticle = {
  id: number;

  factureId: number;
  numeroFacture: string;
  dateFacture: string;

  clientNom: string;
  statut: string;

  produitId: number | null;
  reference: string;
  designation: string;

  quantite: number;
  prixUnitaireHt: number;
  remisePourcentage: number;
  montantHt: number;
  montantTtc: number;
};

export default function RechercheArticleFacture() {
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<ResultatRechercheArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const recherche = query.trim();

    if (recherche.length < 2) {
      setResultats([]);
      setLoading(false);
      setErreur("");
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setErreur("");

      try {
        const res = await fetch(
          `/api/factures/recherche-article?q=${encodeURIComponent(recherche)}`,
        );

        if (!res.ok) {
          throw new Error("Erreur recherche");
        }

        const data = await res.json();

        setResultats(Array.isArray(data) ? data : []);
      } catch {
        setResultats([]);
        setErreur("Impossible d'effectuer la recherche.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const totalQuantite = resultats.reduce(
    (total, ligne) => total + ligne.quantite,
    0,
  );

  const nombreFactures = new Set(
    resultats.map((ligne) => ligne.factureId),
  ).size;

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <div className="font-semibold text-slate-800">
              Rechercher un article facturé
            </div>

            <div className="text-xs text-slate-400 mt-0.5">
              Retrouvez dans quelles factures un produit a été vendu
            </div>
          </div>

          <div className="relative md:w-[420px]">
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M12 12l2 2" />
            </svg>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex. env li a..."
              className="form-input pl-9 pr-9 w-full"
              autoComplete="off"
            />

            {loading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="block w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
              </span>
            )}

            {query && !loading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Effacer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {query.trim().length >= 2 && !loading && !erreur && (
          <div className="text-xs text-slate-500 mt-3">
            <span className="font-semibold text-slate-700">
              {resultats.length}
            </span>{" "}
            ligne(s) trouvée(s) dans{" "}
            <span className="font-semibold text-slate-700">
              {nombreFactures}
            </span>{" "}
            facture(s)
            {resultats.length > 0 && (
              <>
                {" "}
                — quantité totale :{" "}
                <span className="font-semibold text-indigo-600">
                  {totalQuantite.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </>
            )}
          </div>
        )}

        {erreur && (
          <div className="text-sm text-red-600 mt-3">
            {erreur}
          </div>
        )}
      </div>

      {query.trim().length >= 2 && !loading && resultats.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-3 py-2 font-medium text-slate-500">
                  Date
                </th>

                <th className="px-3 py-2 font-medium text-slate-500">
                  Facture
                </th>

                <th className="px-3 py-2 font-medium text-slate-500">
                  Client
                </th>

                <th className="px-3 py-2 font-medium text-slate-500">
                  Référence
                </th>

                <th className="px-3 py-2 font-medium text-slate-500">
                  Article
                </th>

                <th className="px-3 py-2 font-medium text-slate-500 text-right">
                  Qté
                </th>

                <th className="px-3 py-2 font-medium text-slate-500 text-right">
                  PU HT
                </th>

                <th className="px-3 py-2 font-medium text-slate-500 text-right">
                  Remise
                </th>

                <th className="px-3 py-2 font-medium text-slate-500 text-right">
                  TTC
                </th>

                <th className="px-3 py-2 font-medium text-slate-500 text-center">
                  Statut
                </th>
              </tr>
            </thead>

            <tbody>
              {resultats.map((ligne) => (
                <tr
                  key={ligne.id}
                  className="border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {new Date(ligne.dateFacture).toLocaleDateString("fr-FR")}
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/factures/${ligne.factureId}`}
                      className="font-mono font-semibold text-indigo-600 hover:underline"
                    >
                      {ligne.numeroFacture}
                    </Link>
                  </td>

                  <td className="px-3 py-2 font-medium text-slate-700">
                    {ligne.clientNom}
                  </td>

                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {ligne.reference || "—"}
                  </td>

                  <td className="px-3 py-2 text-slate-700">
                    {ligne.designation}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {ligne.quantite.toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {formatMontant(ligne.prixUnitaireHt)}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {ligne.remisePourcentage > 0
                      ? `${ligne.remisePourcentage.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })} %`
                      : "—"}
                  </td>

                  <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">
                    {formatMontant(ligne.montantTtc)}
                  </td>

                  <td className="px-3 py-2 text-center">
                    {ligne.statut === "validee" ? (
                      <span className="badge badge-info">
                        Validée
                      </span>
                    ) : ligne.statut === "brouillon" ? (
                      <span className="badge badge-neutral">
                        Brouillon
                      </span>
                    ) : (
                      <span className="badge badge-danger">
                        Annulée
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.trim().length >= 2 &&
        !loading &&
        !erreur &&
        resultats.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400">
            Aucun article facturé ne correspond à « {query} »
          </div>
        )}
    </div>
  );
}