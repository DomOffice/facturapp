"use client";

import { useEffect, useRef } from "react";
import ConfidenceBadge from "./ConfidenceBadge";

export type ProduitRecherche = {
  id: number;
  reference: string | null;
  description: string | null;
  dernierPrixAchatHt: string | null;
  dernierPrixAchatTtc: string | null;
  prixVenteHt: string | null;
  prixVenteTtc: string | null;
  fournisseurId: number | null;
  score?: number;
};

export type LigneFactureExtraite = {
  reference?: string;
  designation: string;
  quantite?: number;
  prixUnitaireTtc?: number;
  tauxTva?: number;
  totalTtc?: number;
  confiance: number;
  alertes: string[];
  produitId?: number | null;
  produitRecherche?: string;
  produitsProposes?: ProduitRecherche[];
  rechercheProduitEnCours?: boolean;
};

type Props = {
  lignes: LigneFactureExtraite[];
  onChange: (lignes: LigneFactureExtraite[]) => void;
  onRechercheProduit?: (index: number, recherche: string) => void | Promise<void>;
  onSelectionProduit?: (index: number, produitId: number | null) => void;
};

const CHAMPS_NUMERIQUES = new Set<keyof LigneFactureExtraite>([
  "quantite",
  "prixUnitaireTtc",
  "tauxTva",
  "totalTtc",
]);

export default function EditableInvoiceLines({
  lignes,
  onChange,
  onRechercheProduit,
  onSelectionProduit,
}: Props) {
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  function modifierLigne(
    index: number,
    champ: keyof LigneFactureExtraite,
    valeur: LigneFactureExtraite[keyof LigneFactureExtraite] | string,
  ) {
    const lignesValides = lignes.filter(
      (ligne): ligne is LigneFactureExtraite => Boolean(ligne),
    );

    const lignesMaj = lignesValides.map((ligne, i) => {
      if (i !== index) return ligne;

      if (CHAMPS_NUMERIQUES.has(champ)) {
        const texte = String(valeur ?? "").trim().replace(",", ".");
        const nombre = texte === "" ? undefined : Number(texte);

        return {
          ...ligne,
          [champ]: Number.isFinite(nombre) ? nombre : undefined,
        };
      }

      return { ...ligne, [champ]: valeur };
    });

    onChange(lignesMaj);
  }

  function libelleProduit(produit: ProduitRecherche) {
    return [
      produit.reference,
      produit.description,
      produit.dernierPrixAchatTtc
        ? `(Prix achat TTC: ${produit.dernierPrixAchatTtc})`
        : null,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  const lignesAffichables = lignes.filter(
    (ligne): ligne is LigneFactureExtraite => Boolean(ligne),
  );

  if (lignesAffichables.length === 0) return null;

  return (
    <div className="mt-6">
      <h4 className="mb-3 font-semibold">Lignes articles détectées</h4>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Référence</th>
              <th className="px-3 py-2 text-left">Désignation</th>
              <th className="px-3 py-2 text-right">Qté</th>
              <th className="px-3 py-2 text-right">PU TTC</th>
              <th className="px-3 py-2 text-right">TVA</th>
              <th className="px-3 py-2 text-right">Total TTC</th>
              <th className="px-3 py-2 text-left">Article BDD</th>
              <th className="px-3 py-2 text-center">Confiance</th>
            </tr>
          </thead>

          <tbody>
            {lignesAffichables.map((ligne, index) => {
              const produits = ligne.produitsProposes || [];

              return (
                <tr key={index} className="border-t align-top">
                  <td className="px-3 py-2">
                    <input
                      value={ligne.reference || ""}
                      onChange={(event) =>
                        modifierLigne(index, "reference", event.target.value)
                      }
                      className="w-28 rounded border px-2 py-1"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <textarea
                      value={ligne.designation || ""}
                      onChange={(event) =>
                        modifierLigne(index, "designation", event.target.value)
                      }
                      className="w-full min-w-[200px] max-w-[320px] rounded border px-2 py-1"
                      rows={2}
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      inputMode="decimal"
                      value={ligne.quantite ?? ""}
                      onChange={(event) =>
                        modifierLigne(index, "quantite", event.target.value)
                      }
                      className="w-12 rounded border px-2 py-1 text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      inputMode="decimal"
                      value={ligne.prixUnitaireTtc ?? ""}
                      onChange={(event) =>
                        modifierLigne(index, "prixUnitaireTtc", event.target.value)
                      }
                      className="w-14 rounded border px-2 py-1 text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      inputMode="decimal"
                      value={ligne.tauxTva ?? ""}
                      onChange={(event) =>
                        modifierLigne(index, "tauxTva", event.target.value)
                      }
                      className="w-12 rounded border px-2 py-1 text-right"
                    />
                  </td>

                  <td className="px-3 py-2 text-right">
                    <input
                      inputMode="decimal"
                      value={ligne.totalTtc ?? ""}
                      onChange={(event) =>
                        modifierLigne(index, "totalTtc", event.target.value)
                      }
                      className="w-14 rounded border px-2 py-1 text-right"
                    />
                  </td>

                  <td className="min-w-[160px] px-3 py-2">
                    <input
                      value={ligne.produitRecherche ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        modifierLigne(index, "produitRecherche", value);

                        clearTimeout(timersRef.current[index]);
                        timersRef.current[index] = setTimeout(() => {
                          void onRechercheProduit?.(index, value);
                        }, 300);
                      }}
                      placeholder="Rechercher par référence ou désignation..."
                      className="w-full rounded border px-2 py-1"
                    />

                    <select
                      value={ligne.produitId ?? ""}
                      onChange={(event) =>
                        onSelectionProduit?.(
                          index,
                          event.target.value ? Number(event.target.value) : null,
                        )
                      }
                      className="mt-2 w-full rounded border px-2 py-1"
                    >
                      <option value="">
                        {ligne.rechercheProduitEnCours
                          ? "Recherche en cours…"
                          : "À rapprocher"}
                      </option>
                      {produits.map((produit) => (
                        <option key={produit.id} value={produit.id}>
                          {libelleProduit(produit)}
                          {typeof produit.score === "number"
                            ? ` — ${produit.score}%`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-2 text-center">
                    <ConfidenceBadge confiance={ligne.confiance ?? 0} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}