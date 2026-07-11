"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import EditableInvoiceLines, {
  LigneFactureExtraite,
  ProduitRecherche,
} from "./EditableInvoiceLines";

type Fournisseur = {
  id: number;
  nom: string;
  code?: string | null;
};

type ExtractionFacture = {
  fournisseurNom?: string;
  numeroFacture?: string;
  dateFacture?: string;
  iceFournisseur?: string;
  totalHt?: number;
  totalTva?: number;
  totalTtc?: number;
  devise?: string;
  confiance?: number;
  alertes?: string[];
  lignes?: LigneFactureExtraite[];
  profilOcr?: string;
  strategieExtractionLignes?: string;
  fallbackUtilise?: boolean;
  qualiteExtraction?: "A" | "B" | "C" | "D";
};

type UploadEtat =
  | { type: "idle" }
  | { type: "drag_over" }
  | { type: "uploading"; progression: number }
  | { type: "ocr_en_cours"; documentId: number; nomFichier: string }
  | {
      type: "succes";
      documentId: number;
      nomFichier: string;
      nomStocke: string;
      chemin: string;
      typeMime: string;
      taille: number;
      texteOcr: string;
      extraction?: ExtractionFacture;
    }
  | { type: "erreur"; message: string };

type Props = {
  fournisseurs: Fournisseur[];
};

const FORMATS_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"];

function formaterTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

function formaterMontant(value?: number, devise = "MAD") {
  if (typeof value !== "number") return "Non détecté";

  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${devise}`;
}

export default function UploadFacture({ fournisseurs }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [etat, setEtat] = useState<UploadEtat>({ type: "idle" });
  const [fournisseurId, setFournisseurId] = useState("");
  const [fichierSelectionne, setFichierSelectionne] = useState<File | null>(
    null,
  );
  const [lignesEditables, setLignesEditables] = useState<
    LigneFactureExtraite[]
  >([]);

  const validerFichier = (fichier: File): string | null => {
    if (!FORMATS_ACCEPTES.includes(fichier.type)) {
      return "Format non autorisé.\nFormats acceptés : PDF, JPEG, PNG.";
    }

    if (fichier.size > 10 * 1024 * 1024) {
      return `Fichier trop volumineux (${formaterTaille(fichier.size)}).\nMaximum : 10 Mo.`;
    }

    return null;
  };

  const selectionnerFichier = useCallback((fichier: File) => {
    const erreur = validerFichier(fichier);

    if (erreur) {
      setEtat({ type: "erreur", message: erreur });
      return;
    }

    setFichierSelectionne(fichier);
    setLignesEditables([]);
    setEtat({ type: "idle" });
  }, []);

const rechercherProduits = async (
  recherche: string,
): Promise<ProduitRecherche[]> => {
  const q = recherche.trim();

  if (q.length < 2) {
    return [];
  }

  const params = new URLSearchParams({ q });

  if (fournisseurId) {
    params.set("fournisseurId", fournisseurId);
  }

  const res = await fetch(
    `/api/produits/recherche?${params.toString()}`,
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("[RECHERCHE_PRODUITS_UI]", data);
    return [];
  }

  return Array.isArray(data.produits) ? data.produits : [];
};

const enrichirLignesAvecProduits = async (
  lignes: LigneFactureExtraite[],
): Promise<LigneFactureExtraite[]> => {
  return Promise.all(
    lignes.map(async (ligne) => {
      const reference = ligne.reference?.trim() || "";
      const designation = ligne.designation?.trim() || "";

      if (!reference && designation.length < 2) {
        return {
          ...ligne,
          produitId: null,
          produitRecherche: "",
          produitsProposes: [],
          rechercheProduitEnCours: false,
        };
      }

      /*
       * Première tentative :
       * référence OCR + désignation.
       */
      const rechercheComplete = [reference, designation]
        .filter(Boolean)
        .join(" ")
        .trim();

      let produits = await rechercherProduits(rechercheComplete);

      /*
       * Deuxième tentative :
       * si aucune proposition pertinente, on cherche uniquement
       * avec la désignation. C'est particulièrement utile pour
       * les références fournisseur ou codes-barres absents de la BDD.
       */
      if (produits.length === 0 && designation.length >= 2) {
        produits = await rechercherProduits(designation);
      }

      /*
       * Dernier recours :
       * référence seule, utile pour les références commerciales
       * réellement présentes dans la BDD.
       */
      if (
        produits.length === 0 &&
        reference.length >= 2 &&
        reference !== designation
      ) {
        produits = await rechercherProduits(reference);
      }

      const premier = produits[0];
      const second = produits[1];

      const scorePremier = premier?.score ?? 0;
      const scoreSecond = second?.score ?? 0;

      /*
       * Présélection uniquement si le résultat est suffisamment
       * fiable et nettement meilleur que le suivant.
       */
      const selectionAutomatique =
        premier &&
        scorePremier >= 90 &&
        (!second || scorePremier - scoreSecond >= 15)
          ? premier.id
          : null;

      return {
        ...ligne,
        produitId: selectionAutomatique,
        produitRecherche: "",
        produitsProposes: produits,
        rechercheProduitEnCours: false,
      };
    }),
  );
};

  const handleSoumettre = async () => {
    if (!fichierSelectionne) return;

    if (!fournisseurId) {
      setEtat({
        type: "erreur",
        message: "Veuillez sélectionner un fournisseur.",
      });
      return;
    }

    setEtat({ type: "uploading", progression: 0 });

    try {
      const formData = new FormData();
      formData.append("fichier", fichierSelectionne);
      formData.append("fournisseurId", fournisseurId);

      const uploadRes = await fetch("/api/factures-fournisseurs/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setEtat({
          type: "erreur",
          message: uploadData.error || "Erreur lors de l'upload.",
        });
        return;
      }

      const documentId = Number(uploadData.documentId);

      setEtat({
        type: "ocr_en_cours",
        documentId,
        nomFichier: uploadData.fichier.nomOriginal,
      });

      const ocrRes = await fetch(
        `/api/factures-fournisseurs/ocr/${documentId}`,
        {
          method: "POST",
        },
      );

      const ocrData = await ocrRes.json();

      if (!ocrRes.ok) {
        setEtat({
          type: "erreur",
          message: ocrData.error || "Erreur lors de l'OCR.",
        });
        return;
      }

      const lignes = ocrData.extraction?.lignes || [];

const lignesAvecProduits =
  await enrichirLignesAvecProduits(lignes);

setLignesEditables(lignesAvecProduits);

      setEtat({
        type: "succes",
        documentId,
        nomFichier: uploadData.fichier.nomOriginal,
        nomStocke: uploadData.fichier.nomStocke,
        chemin: uploadData.fichier.chemin,
        typeMime: uploadData.fichier.typeMime,
        taille: uploadData.fichier.taille,
        texteOcr: ocrData.texte || "",
        extraction: ocrData.extraction,
      });
    } catch (error) {
      console.error("[UPLOAD_OCR_FACTURE]", error);
      setEtat({
        type: "erreur",
        message: "Erreur réseau.\nVeuillez réessayer.",
      });
    }
  };

  const rechercherProduitPourLigne = async (
  index: number,
  recherche: string,
) => {
  setLignesEditables((lignes) =>
    lignes.map((ligne, i) =>
      i === index
        ? {
            ...ligne,
            produitRecherche: recherche,
            produitId: null,
            rechercheProduitEnCours: recherche.trim().length >= 2,
          }
        : ligne,
    ),
  );

  const q = recherche.trim();

  if (q.length < 2) {
    setLignesEditables((lignes) =>
      lignes.map((ligne, i) =>
        i === index
          ? {
              ...ligne,
              produitsProposes: [],
              produitId: null,
              rechercheProduitEnCours: false,
            }
          : ligne,
      ),
    );

    return;
  }

  const produits = await rechercherProduits(q);

  setLignesEditables((lignes) =>
    lignes.map((ligne, i) =>
      i === index
        ? {
            ...ligne,
            produitsProposes: produits,
            produitId: null,
            rechercheProduitEnCours: false,
          }
        : ligne,
    ),
  );
};

  const selectionnerProduitPourLigne = (
    index: number,
    produitId: number | null,
  ) => {
    setLignesEditables((lignes) =>
      lignes.map((ligne, i) => (i === index ? { ...ligne, produitId } : ligne)),
    );
  };

  const validerLignes = async () => {
    if (etat.type !== "succes") return;

    try {
      const res = await fetch(
        `/api/factures-fournisseurs/valider-lignes/${etat.documentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lignes: lignesEditables }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setEtat({
          type: "erreur",
          message: data.error || "Erreur de validation.",
        });
        return;
      }

      router.push("/factures-fournisseurs");
    } catch (error) {
      console.error("[VALIDER_LIGNES_UI]", error);
      setEtat({
        type: "erreur",
        message: "Erreur réseau lors de la validation des lignes.",
      });
    }
  };

  const reinitialiser = () => {
    setFichierSelectionne(null);
    setLignesEditables([]);
    setEtat({ type: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Fournisseur *
        </label>

        <select
          value={fournisseurId}
          onChange={(e) => setFournisseurId(e.target.value)}
          disabled={etat.type === "uploading" || etat.type === "ocr_en_cours"}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">-- Sélectionner un fournisseur --</option>
          {fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
              {f.code ? ` (${f.code})` : ""}
            </option>
          ))}
        </select>
      </div>

      {etat.type !== "succes" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setEtat({ type: "drag_over" });
          }}
          onDragLeave={() =>
            etat.type === "drag_over" && setEtat({ type: "idle" })
          }
          onDrop={(e) => {
            e.preventDefault();
            const fichier = e.dataTransfer.files?.[0];
            if (fichier) selectionnerFichier(fichier);
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) selectionnerFichier(fichier);
            }}
            className="hidden"
          />

          {fichierSelectionne ? (
            <div>
              <p className="font-medium text-gray-900">
                {fichierSelectionne.name}
              </p>
              <p className="text-sm text-gray-500">
                {formaterTaille(fichierSelectionne.size)}
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reinitialiser();
                }}
                className="text-xs text-red-500 hover:underline mt-1"
              >
                Changer de fichier
              </button>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">
                Glissez-déposez ou cliquez pour sélectionner
              </p>
              <p className="text-sm text-gray-500">
                PDF, JPEG, PNG — 10 Mo maximum
              </p>
            </div>
          )}
        </div>
      )}

      {etat.type === "uploading" && (
        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3">
          Upload en cours…
        </div>
      )}

      {etat.type === "ocr_en_cours" && (
        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3">
          Upload terminé. OCR en cours sur le document #{etat.documentId}…
        </div>
      )}

      {etat.type === "erreur" && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 whitespace-pre-line">
          {etat.message}
        </div>
      )}

      {etat.type === "succes" && (
        <div className="space-y-6">
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
            <h3 className="font-semibold">OCR terminé avec succès</h3>
            <p>
              Document #{etat.documentId} — {etat.nomFichier}
            </p>
          </div>

          {etat.extraction && (
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">Données détectées</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <p>
                  <strong>Fournisseur :</strong>{" "}
                  {etat.extraction.fournisseurNom || "Non détecté"}
                </p>
                <p>
                  <strong>N° facture :</strong>{" "}
                  {etat.extraction.numeroFacture || "Non détecté"}
                </p>
                <p>
                  <strong>Date :</strong>{" "}
                  {etat.extraction.dateFacture || "Non détectée"}
                </p>
                <p>
                  <strong>ICE :</strong>{" "}
                  {etat.extraction.iceFournisseur || "Non détecté"}
                </p>
                <p>
                  <strong>Total HT :</strong>{" "}
                  {formaterMontant(
                    etat.extraction.totalHt,
                    etat.extraction.devise,
                  )}
                </p>
                <p>
                  <strong>TVA :</strong>{" "}
                  {formaterMontant(
                    etat.extraction.totalTva,
                    etat.extraction.devise,
                  )}
                </p>
                <p>
                  <strong>Total TTC :</strong>{" "}
                  {formaterMontant(
                    etat.extraction.totalTtc,
                    etat.extraction.devise,
                  )}
                </p>
                <p>
                  <strong>Confiance :</strong> {etat.extraction.confiance ?? 0}%
                </p>
                <p>
                  <strong>Profil OCR :</strong>{" "}
                  {etat.extraction.profilOcr || "Non détecté"}
                </p>

                <p>
                  <strong>Stratégie lignes :</strong>{" "}
                  {etat.extraction.strategieExtractionLignes || "Non détectée"}
                </p>

                <p>
                  <strong>Fallback :</strong>{" "}
                  {etat.extraction.fallbackUtilise ? "Oui" : "Non"}
                </p>

                <p>
                  <strong>Qualité extraction :</strong>{" "}
                  {etat.extraction.qualiteExtraction || "Non évaluée"}
                </p>
              </div>

              {etat.extraction.alertes &&
                etat.extraction.alertes.length > 0 && (
                  <div className="mt-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-md p-3">
                    <strong>Alertes :</strong>
                    <ul className="list-disc ml-5 mt-1">
                      {etat.extraction.alertes.map((alerte, index) => (
                        <li key={index}>{alerte}</li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="mt-6 border rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold mb-3">Diagnostic OCR</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p>
                    <strong>Profil OCR :</strong>{" "}
                    {etat.extraction.profilOcr || "Non détecté"}
                  </p>

                  <p>
                    <strong>Stratégie lignes :</strong>{" "}
                    {etat.extraction.strategieExtractionLignes ||
                      "Non détectée"}
                  </p>

                  <p>
                    <strong>Fallback :</strong>{" "}
                    {etat.extraction.fallbackUtilise ? "Oui" : "Non"}
                  </p>

                  <p>
                    <strong>Qualité extraction :</strong>{" "}
                    {etat.extraction.qualiteExtraction || "Non évaluée"}
                  </p>

                  <p>
                    <strong>Articles détectés :</strong>{" "}
                    {lignesEditables.length}
                  </p>

                  <p>
                    <strong>Confiance moyenne lignes :</strong>{" "}
                    {lignesEditables.length > 0
                      ? `${Math.round(
                          lignesEditables.reduce(
                            (total, ligne) => total + ligne.confiance,
                            0,
                          ) / lignesEditables.length,
                        )}%`
                      : "Non évaluée"}
                  </p>
                </div>
              </div>

              <EditableInvoiceLines
                lignes={lignesEditables}
                onChange={setLignesEditables}
                onRechercheProduit={rechercherProduitPourLigne}
                onSelectionProduit={selectionnerProduitPourLigne}
              />
            </div>
          )}

          <div>
            <h4 className="font-semibold mb-2">Texte OCR brut</h4>
            <pre className="max-h-80 overflow-auto text-xs bg-gray-50 border rounded-md p-3 whitespace-pre-wrap">
              {etat.texteOcr || "Aucun texte extrait."}
            </pre>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/factures-fournisseurs")}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Annuler
        </button>

        {etat.type !== "succes" ? (
          <button
            type="button"
            onClick={handleSoumettre}
            disabled={
              !fichierSelectionne ||
              !fournisseurId ||
              etat.type === "uploading" ||
              etat.type === "ocr_en_cours"
            }
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {etat.type === "ocr_en_cours"
              ? "OCR en cours…"
              : "Uploader et lancer OCR"}
          </button>
        ) : (
          <button
            type="button"
            onClick={validerLignes}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Valider les lignes
          </button>
        )}
      </div>
    </div>
  );
}
