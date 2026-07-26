"use client";
// src/components/forms/produit-form.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";
import { arrondi2 } from "@/lib/utils/currency";

type Option = { id: number; libelle: string; valeurNum?: number | null };
type ProduitData = {
  id?: number;
  typeProduitId?: number | null;
  reference?: string;
  description?: string;
  uniteId?: number | null;
  fournisseurId?: number | null;
  tauxTvaId?: number | null;
  dernierPrixAchatHt?: number;
  prixVenteHt?: number;
  margeHt?: number;
  actif?: boolean;
};

function convertirSaisieDecimale(valeur: string): number {
  const valeurNormalisee = valeur.trim().replace(/\s/g, "").replace(",", ".");

  const nombre = Number(valeurNormalisee);

  return Number.isFinite(nombre) ? nombre : 0;
}

function formaterSaisieDecimale(valeur: number): string {
  return String(valeur).replace(".", ",");
}

function evaluerExpressionPrix(valeur: string): number | null {
  const expression = valeur
    .trim()
    .replace(/^=/, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");

  if (!expression || !/^[0-9+\-*/().]+$/.test(expression)) {
    return null;
  }

  try {
    const resultat = Function(`"use strict"; return (${expression})`)();

    if (typeof resultat !== "number" || !Number.isFinite(resultat)) {
      return null;
    }

    return arrondi2(resultat);
  } catch {
    return null;
  }
}

export default function ProduitForm({
  produit,
  typesProduit,
  unites,
  tauxTva,
  fournisseurs,
  onProduitCree,
  onAnnuler,
}: {
  produit?: ProduitData;
  typesProduit: Option[];
  unites: Option[];
  tauxTva: Option[];
  fournisseurs: Option[];
  onProduitCree?: (produit: ProduitData & { id: number }) => void;
  onAnnuler?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calculs dynamiques
  const prixAchatHtInitial = Number(produit?.dernierPrixAchatHt ?? 0);
  const margeHtInitiale = Number(produit?.margeHt ?? 0);

  const tauxMargeInitial =
    prixAchatHtInitial > 0
      ? arrondi2((margeHtInitiale / prixAchatHtInitial) * 100)
      : 0;

  const [prixAchatHtSaisi, setPrixAchatHtSaisi] = useState(
    formaterSaisieDecimale(prixAchatHtInitial),
  );

  const [tauxMargeSaisi, setTauxMargeSaisi] = useState(
    formaterSaisieDecimale(tauxMargeInitial),
  );

  const [tauxTvaId, setTauxTvaId] = useState<number | null>(
    produit?.tauxTvaId ?? null,
  );

  const prixAchatHt = convertirSaisieDecimale(prixAchatHtSaisi);
  const tauxMarge = convertirSaisieDecimale(tauxMargeSaisi);
  const tauxTvaVal = tauxTva.find((t) => t.id === tauxTvaId)?.valeurNum ?? 0;

  const marge = arrondi2((prixAchatHt * tauxMarge) / 100);
  const prixVenteHt = arrondi2(prixAchatHt + marge);
  const prixAchatTtc = arrondi2(prixAchatHt * (1 + Number(tauxTvaVal) / 100));
  const prixVenteTtc = arrondi2(prixVenteHt * (1 + Number(tauxTvaVal) / 100));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data = {
      typeProduitId: form.get("typeProduitId")
        ? Number(form.get("typeProduitId"))
        : null,
      reference: form.get("reference") as string,
      description: form.get("description") as string,
      uniteId: form.get("uniteId") ? Number(form.get("uniteId")) : null,
      fournisseurId: form.get("fournisseurId")
        ? Number(form.get("fournisseurId"))
        : null,
      tauxTvaId: tauxTvaId,
      dernierPrixAchatHt: prixAchatHt,
      dernierPrixAchatTtc: prixAchatTtc,
      prixVenteHt: prixVenteHt,
      prixVenteTtc: prixVenteTtc,
      margeHt: marge,
      actif: form.get("actif") === "on",
    };

    try {
      const url = produit?.id ? `/api/produits/${produit.id}` : "/api/produits";
      const method = produit?.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const produitEnregistre = await res.json();

      if (!res.ok) {
        throw new Error(produitEnregistre.error || "Erreur");
      }

      if (!produit?.id && onProduitCree) {
        onProduitCree(produitEnregistre);
        return;
      }

      router.push("/produits");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Type</label>
          <select
            name="typeProduitId"
            defaultValue={produit?.typeProduitId ?? ""}
            className="form-select"
          >
            <option value="">— Sélectionner —</option>
            {typesProduit.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Unité</label>
          <select
            name="uniteId"
            defaultValue={produit?.uniteId ?? ""}
            className="form-select"
          >
            <option value="">— Sélectionner —</option>
            {unites.map((u) => (
              <option key={u.id} value={u.id}>
                {u.libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="form-label">
            Référence interne / Code produit *
          </label>
          <input
            name="reference"
            required
            defaultValue={produit?.reference ?? ""}
            className="form-input"
            placeholder="Ex : STYLO-BIC-BLEU"
          />
        </div>

        <div className="col-span-2">
          <label className="form-label">Description *</label>
          <input
            name="description"
            required
            defaultValue={produit?.description ?? ""}
            className="form-input"
            placeholder="Description complète"
          />
        </div>

        <div>
          <label className="form-label">Fournisseur</label>
          <select
            name="fournisseurId"
            defaultValue={produit?.fournisseurId ?? ""}
            className="form-select"
          >
            <option value="">— Sélectionner —</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">TVA</label>
          <select
            value={tauxTvaId ?? ""}
            onChange={(e) =>
              setTauxTvaId(e.target.value ? Number(e.target.value) : null)
            }
            className="form-select"
          >
            <option value="">— Sélectionner —</option>
            {tauxTva.map((t) => (
              <option key={t.id} value={t.id}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>

        {/* Calculs prix */}
        <div>
          <label className="form-label">Prix achat HT</label>
          <input
            type="text"
            inputMode="decimal"
            value={prixAchatHtSaisi}
            onChange={(e) => setPrixAchatHtSaisi(e.target.value)}
            onBlur={() => {
              if (!prixAchatHtSaisi.trim().startsWith("=")) {
                return;
              }

              const resultat = evaluerExpressionPrix(prixAchatHtSaisi);

              if (resultat === null) {
                setError(
                  "Calcul invalide dans le prix achat HT. Exemple : =10/1,2",
                );
                return;
              }

              setError("");
              setPrixAchatHtSaisi(formaterSaisieDecimale(resultat));
            }}
            className="form-input"
            placeholder="0,00 ou =10/1,2"
          />

          <p className="mt-1 text-xs text-slate-500">
            Calcul autorisé, par exemple : =120/1,2
          </p>
        </div>

        <div>
          <label className="form-label">Taux de marge (%)</label>
          <input
            type="text"
            inputMode="decimal"
            value={tauxMargeSaisi}
            onChange={(e) => setTauxMargeSaisi(e.target.value)}
            className="form-input"
            placeholder="Ex : 20"
          />
        </div>

        {/* Résultats calculés */}
        <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg">
          <div>
            <div className="form-label">Marge HT</div>
            <div className="text-sm font-semibold text-emerald-600">
              {marge.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div>
            <div className="form-label">Prix achat TTC</div>
            <div className="text-sm font-semibold text-slate-700">
              {prixAchatTtc.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div>
            <div className="form-label">Prix vente HT</div>
            <div className="text-sm font-semibold text-indigo-600">
              {prixVenteHt.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div>
            <div className="form-label">Prix vente TTC</div>
            <div className="text-sm font-semibold text-indigo-600">
              {prixVenteTtc.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="actif"
            id="actif-prod"
            defaultChecked={produit?.actif ?? true}
            className="w-4 h-4"
          />
          <label htmlFor="actif-prod" className="text-sm text-slate-600">
            Produit actif
          </label>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading
            ? "Enregistrement..."
            : produit?.id
              ? "Enregistrer"
              : "Créer le produit"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (onAnnuler) {
              onAnnuler();
              return;
            }

            router.back();
          }}
          className="btn-secondary"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
