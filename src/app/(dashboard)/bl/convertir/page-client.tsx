"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type LigneBlSource = {
  id: number;
  produitId: number | null;
  designation: string;
  quantite: number;
  produit: {
    id: number;
    reference: string;
    description: string;
    prixVenteHt: number;
  } | null;
};

type BlSource = {
  id: number;
  numeroBl: string;
  clientId: number;
  client: { id: number; raisonSociale: string };
  lignes: LigneBlSource[];
};

type LigneFactureEditable = {
  tempId: string;
  produitId: number | null;
  designation: string;
  quantite: number;
  prixUnitaireHt: number;
  tauxTva: number;
};

export default function PageClientConvertir({
  bonsLivraison,
}: {
  bonsLivraison: BlSource[];
}) {
  const router = useRouter();
  const client = bonsLivraison[0].client;

  const [dateFacture, setDateFacture] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [consolider, setConsolider] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Préparation initiale des lignes consolidées ou détaillées
  const initialiserLignes = (doitConsolider: boolean): LigneFactureEditable[] => {
    if (doitConsolider) {
      const regroupement = new Map<string, LigneFactureEditable>();

      for (const bl of bonsLivraison) {
        for (const l of bl.lignes) {
          const cle = l.produitId
            ? `prod_${l.produitId}`
            : `desc_${l.designation.trim().toLowerCase()}`;

          if (regroupement.has(cle)) {
            const existant = regroupement.get(cle)!;
            existant.quantite += l.quantite;
          } else {
            regroupement.set(cle, {
              tempId: Math.random().toString(36).substring(2, 9),
              produitId: l.produitId,
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaireHt: l.produit?.prixVenteHt ?? 0,
              tauxTva: 20,
            });
          }
        }
      }
      return Array.from(regroupement.values());
    } else {
      return bonsLivraison.flatMap((bl) =>
        bl.lignes.map((l) => ({
          tempId: Math.random().toString(36).substring(2, 9),
          produitId: l.produitId,
          designation: `${l.designation} (${bl.numeroBl})`,
          quantite: l.quantite,
          prixUnitaireHt: l.produit?.prixVenteHt ?? 0,
          tauxTva: 20,
        }))
      );
    }
  };

  const [lignes, setLignes] = useState<LigneFactureEditable[]>(() =>
    initialiserLignes(true)
  );

  function basculerModeConsolidation(activer: boolean) {
    setConsolider(activer);
    setLignes(initialiserLignes(activer));
  }

  function modifierLigne(
    tempId: string,
    champ: keyof LigneFactureEditable,
    valeur: any
  ) {
    setLignes((prev) =>
      prev.map((l) => (l.tempId === tempId ? { ...l, [champ]: valeur } : l))
    );
  }

  function supprimerLigne(tempId: string) {
    setLignes((prev) => prev.filter((l) => l.tempId !== tempId));
  }

  // Calculs totaux en direct
  const totaux = useMemo(() => {
    let ht = 0;
    let tva = 0;
    for (const l of lignes) {
      const montantLigneHt = Number(l.quantite) * Number(l.prixUnitaireHt);
      const montantLigneTva = (montantLigneHt * Number(l.tauxTva)) / 100;
      ht += montantLigneHt;
      tva += montantLigneTva;
    }
    return {
      ht,
      tva,
      ttc: ht + tva,
    };
  }, [lignes]);

  async function genererFacture() {
    setErreur(null);
    if (lignes.length === 0) {
      setErreur("La facture doit comporter au moins une ligne.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/bl/convertir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blIds: bonsLivraison.map((b) => b.id),
          clientId: client.id,
          dateFacture,
          lignes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec lors de la création de la facture");
      }

      router.push("/bl");
      router.refresh();
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/bl" className="text-xs text-slate-500 hover:text-slate-800">
              ← Retour aux BL
            </Link>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mt-1">
            Conversion des BL en Facture
          </h1>
          <p className="text-xs text-slate-500">
            Client : <strong className="text-slate-800">{client.raisonSociale}</strong> |{" "}
            {bonsLivraison.length} BL sélectionné(s) :{" "}
            {bonsLivraison.map((b) => b.numeroBl).join(", ")}
          </p>
        </div>

        <button
          type="button"
          onClick={genererFacture}
          disabled={loading || lignes.length === 0}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          {loading ? "Génération..." : "Créer la Facture"}
        </button>
      </div>

      {erreur && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {erreur}
        </div>
      )}

      {/* Barre options : Date et Consolidation */}
      <div className="card p-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Date facture :</span>
            <input
              type="date"
              value={dateFacture}
              onChange={(e) => setDateFacture(e.target.value)}
              className="form-input py-1 px-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consolider}
              onChange={(e) => basculerModeConsolidation(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span>Consolider les articles identiques</span>
          </label>
        </div>

        <div className="text-sm text-slate-600">
          Total lignes : <span className="font-semibold">{lignes.length}</span>
        </div>
      </div>

      {/* Tableau d'ajustement des prix PC */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left">Désignation</th>
                <th className="w-24 px-3 py-2 text-center">Quantité</th>
                <th className="w-32 px-3 py-2 text-right">Prix Unit. HT</th>
                <th className="w-24 px-3 py-2 text-center">TVA %</th>
                <th className="w-32 px-3 py-2 text-right">Total HT</th>
                <th className="w-12 px-3 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lignes.map((l) => {
                const totalLigneHt = Number(l.quantite) * Number(l.prixUnitaireHt);
                return (
                  <tr key={l.tempId} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={l.designation}
                        onChange={(e) =>
                          modifierLigne(l.tempId, "designation", e.target.value)
                        }
                        className="form-input w-full text-sm py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={l.quantite}
                        onChange={(e) =>
                          modifierLigne(
                            l.tempId,
                            "quantite",
                            Math.max(1, Number(e.target.value))
                          )
                        }
                        className="form-input w-full text-center text-sm py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.prixUnitaireHt}
                        onChange={(e) =>
                          modifierLigne(
                            l.tempId,
                            "prixUnitaireHt",
                            Number(e.target.value)
                          )
                        }
                        className="form-input w-full text-right text-sm py-1 font-mono font-medium text-slate-800"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={l.tauxTva}
                        onChange={(e) =>
                          modifierLigne(l.tempId, "tauxTva", Number(e.target.value))
                        }
                        className="form-select w-full text-center text-sm py-1"
                      >
                        <option value="20">20%</option>
                        <option value="14">14%</option>
                        <option value="10">10%</option>
                        <option value="7">7%</option>
                        <option value="0">0%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                      {totalLigneHt.toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      MAD
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => supprimerLigne(l.tempId)}
                        className="text-slate-400 hover:text-red-500 p-1"
                        title="Retirer cette ligne"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bloc Totaux Financiers */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Total HT :</span>
              <span className="font-mono font-semibold text-slate-800">
                {totaux.ht.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MAD
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total TVA :</span>
              <span className="font-mono font-semibold text-slate-800">
                {totaux.tva.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MAD
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-indigo-600 pt-2 border-t border-slate-200">
              <span>Total TTC :</span>
              <span className="font-mono">
                {totaux.ttc.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MAD
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}