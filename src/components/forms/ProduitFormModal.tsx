"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import ProduitForm from "@/components/forms/produit-form";

type Option = {
  id: number;
  libelle: string;
  valeurNum?: number | null;
};

type OptionsProduit = {
  typesProduit: Option[];
  unites: Option[];
  tauxTva: Option[];
  fournisseurs: Option[];
};

export type ProduitCreeDepuisOcr = {
  id: number;
  reference?: string;
  description?: string;
  fournisseurId?: number | null;
  tauxTvaId?: number | null;
  dernierPrixAchatHt?: number;
};

type Props = {
  ouvert: boolean;
  reference?: string;
  description?: string;
  fournisseurId?: number | null;
  prixAchatHt?: number;
  tauxTvaPourcentage?: number;
  onFermer: () => void;
  onProduitCree: (
    produit: ProduitCreeDepuisOcr,
  ) => void | Promise<void>;
};

export default function ProduitFormModal({
  ouvert,
  reference,
  description,
  fournisseurId,
  prixAchatHt,
  tauxTvaPourcentage,
  onFermer,
  onProduitCree,
}: Props) {
  const [options, setOptions] = useState<OptionsProduit | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!ouvert) {
      setOptions(null);
      setErreur("");
      return;
    }

    const controleur = new AbortController();

    const chargerOptions = async () => {
      setChargement(true);
      setErreur("");

      try {
        const reponse = await fetch("/api/produits/options", {
          signal: controleur.signal,
        });

        const donnees = await reponse.json();

        if (!reponse.ok) {
          throw new Error(
            donnees.error ||
              "Impossible de charger les options du formulaire.",
          );
        }

        setOptions(donnees);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setErreur(
          error instanceof Error
            ? error.message
            : "Erreur inconnue lors du chargement.",
        );
      } finally {
        if (!controleur.signal.aborted) {
          setChargement(false);
        }
      }
    };

    void chargerOptions();

    return () => {
      controleur.abort();
    };
  }, [ouvert]);

  const tauxTvaId = useMemo(() => {
    if (
      !options ||
      typeof tauxTvaPourcentage !== "number"
    ) {
      return null;
    }

    return (
      options.tauxTva.find((taux) => {
        if (typeof taux.valeurNum !== "number") {
          return false;
        }

        return (
          Math.abs(taux.valeurNum - tauxTvaPourcentage) < 0.001
        );
      })?.id ?? null
    );
  }, [options, tauxTvaPourcentage]);

  return (
    <Modal
      ouvert={ouvert}
      titre="Créer un produit depuis la facture"
      onFermer={onFermer}
      enfants={
        <>
          {chargement && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
              Chargement du formulaire produit…
            </div>
          )}

          {erreur && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {erreur}
              </div>

              <button
                type="button"
                onClick={onFermer}
                className="btn-secondary"
              >
                Fermer
              </button>
            </div>
          )}

          {!chargement && !erreur && options && (
            <ProduitForm
              key={`${reference ?? ""}-${description ?? ""}-${fournisseurId ?? ""}`}
              produit={{
                reference: reference ?? "",
                description: description ?? "",
                fournisseurId: fournisseurId ?? null,
                tauxTvaId,
                dernierPrixAchatHt: prixAchatHt ?? 0,
                actif: true,
              }}
              typesProduit={options.typesProduit}
              unites={options.unites}
              tauxTva={options.tauxTva}
              fournisseurs={options.fournisseurs}
              onAnnuler={onFermer}
              onProduitCree={(produit) => {
                void onProduitCree(produit);
              }}
            />
          )}
        </>
      }
    />
  );
}