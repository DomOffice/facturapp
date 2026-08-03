"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import EditableInvoiceLines, {
  LigneFactureExtraite,
  ProduitRecherche,
} from "./EditableInvoiceLines";
import ProduitFormModal from "@/components/forms/ProduitFormModal";
import Modal from "@/components/ui/Modal";

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

  typeDocument?: "facture" | "bon_livraison";
  integreStock?: boolean;
  comptabiliseTva?: boolean;
  rapprochementObligatoire?: boolean;
  metAJourPrixAchat?: boolean;

  strategieExtractionLignes?: string;
  fallbackUtilise?: boolean;
  qualiteExtraction?: "A" | "B" | "C" | "D";
};

type DoublonFacture = {
  documentId: number;
  numeroFacture: string;
  dateIntegration: string;
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
      doublonFacture?: DoublonFacture | null;
    }
  | { type: "erreur"; message: string };

type Props = {
  fournisseurs: Fournisseur[];
};

type EcartPrixProduit = {
  produitId: number;
  reference: string;
  description: string;
  prixProduitActuelHt?: number;
  prixProduitActuelTtc?: number;
  prixFactureHt?: number;
  prixFactureTtc?: number;
  comparaisonEnTtc: boolean;
  mettreAJourPrixProduit?: boolean;
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

function lireNombreLigne(
  ligne: LigneFactureExtraite | null,
  cles: string[],
): number | undefined {
  if (!ligne) return undefined;

  const donnees = ligne as unknown as Record<string, unknown>;

  for (const cle of cles) {
    const valeur = donnees[cle];

    if (typeof valeur === "number" && Number.isFinite(valeur)) {
      return valeur;
    }

    if (typeof valeur === "string") {
      const nombre = Number(valeur.trim().replace(/\s/g, "").replace(",", "."));

      if (Number.isFinite(nombre)) {
        return nombre;
      }
    }
  }

  return undefined;
}

// Tolérance ecart de prix entre facture scannée et prix de la BDD
const TOLERANCE_PRIX_ACHAT = 0.01;
function arrondirMontant(valeur: number): number {
  return Math.round((valeur + Number.EPSILON) * 100) / 100;
}

function lirePrixProduit(
  valeur: string | number | null | undefined,
): number | undefined {
  if (valeur === null || valeur === undefined || valeur === "") {
    return undefined;
  }

  const nombre =
    typeof valeur === "string"
      ? Number(valeur.trim().replace(/\s/g, "").replace(",", "."))
      : Number(valeur);

  return Number.isFinite(nombre) ? arrondirMontant(nombre) : undefined;
}

function determinerMiseAJourPrixProduit(
  prixFactureTtc: number | undefined,
  prixProduitTtc: number | undefined,
  prixFactureHt: number | undefined,
  prixProduitHt: number | undefined,
): boolean | undefined {
  /*
   * Priorité au TTC :
   * c'est la valeur directement lue sur les BL Mechouar
   * et affichée lors du rapprochement.
   */
  if (prixFactureTtc !== undefined && prixProduitTtc !== undefined) {
    const ecartTtc = Math.abs(
      arrondirMontant(prixFactureTtc) - arrondirMontant(prixProduitTtc),
    );

    return ecartTtc <= TOLERANCE_PRIX_ACHAT ? false : undefined;
  }

  /*
   * Secours en HT lorsque le TTC produit n'est pas disponible.
   */
  if (prixFactureHt !== undefined && prixProduitHt !== undefined) {
    const ecartHt = Math.abs(
      arrondirMontant(prixFactureHt) - arrondirMontant(prixProduitHt),
    );

    return ecartHt <= TOLERANCE_PRIX_ACHAT ? false : undefined;
  }

  /*
   * Dès qu'une valeur de facture existe, mais qu'aucun prix
   * produit comparable n'est enregistré, une décision est requise.
   */
  if (prixFactureTtc !== undefined || prixFactureHt !== undefined) {
    return undefined;
  }

  /*
   * Aucun prix exploitable sur la ligne.
   */
  return false;
}
function enrichirLigneAvecPrixProduit(
  ligne: LigneFactureExtraite,
  produitId: number | null,
  produits: ProduitRecherche[],
): LigneFactureExtraite {
  const produit =
    produitId !== null
      ? produits.find((produitPropose) => produitPropose.id === produitId)
      : undefined;

  if (!produit) {
    return {
      ...ligne,
      produitId,
      prixAchatHtFacture: undefined,
      prixAchatTtcFacture: undefined,
      prixProduitActuelHt: undefined,
      prixProduitActuelTtc: undefined,
      mettreAJourPrixProduit: undefined,
    };
  }

  const prixAchatTtcFactureBrut = lireNombreLigne(ligne, [
    "prixUnitaireTtc",
    "prixAchatTtc",
    "prixTtc",
  ]);

  const prixAchatTtcFacture =
    prixAchatTtcFactureBrut !== undefined
      ? arrondirMontant(prixAchatTtcFactureBrut)
      : undefined;

  const tauxTva =
    lireNombreLigne(ligne, [
      "tauxTva",
      "tauxTvaPourcentage",
      "pourcentageTva",
    ]) ?? 0;

  const coefficientTva = 1 + tauxTva / 100;

  const prixAchatHtFacture =
    prixAchatTtcFacture !== undefined && coefficientTva > 0
      ? arrondirMontant(prixAchatTtcFacture / coefficientTva)
      : undefined;

  const prixProduitActuelHt = lirePrixProduit(produit.dernierPrixAchatHt);

  const prixProduitActuelTtc = lirePrixProduit(produit.dernierPrixAchatTtc);

  return {
    ...ligne,
    produitId,
    prixAchatHtFacture,
    prixAchatTtcFacture,
    prixProduitActuelHt,
    prixProduitActuelTtc,
    mettreAJourPrixProduit: determinerMiseAJourPrixProduit(
      prixAchatTtcFacture,
      prixProduitActuelTtc,
      prixAchatHtFacture,
      prixProduitActuelHt,
    ),
  };
}

function regrouperEcartsPrixProduits(
  lignes: LigneFactureExtraite[],
): EcartPrixProduit[] {
  const ecartsParProduit = new Map<number, EcartPrixProduit>();

  for (const ligne of lignes) {
    const produitId = Number(ligne.produitId);

    if (!Number.isInteger(produitId) || produitId <= 0) {
      continue;
    }

    /*
     * false signifie que les prix sont identiques.
     * true signifie que l'utilisateur a déjà choisi la mise à jour.
     * undefined signifie qu'une décision est nécessaire.
     *
     * Les lignes ayant déjà reçu une décision doivent également
     * rester visibles lorsque la fenêtre est rouverte.
     */
    const possedePrixFacture =
      ligne.prixAchatTtcFacture !== undefined ||
      ligne.prixAchatHtFacture !== undefined;

    if (!possedePrixFacture) {
      continue;
    }

    const comparaisonEnTtc =
      ligne.prixAchatTtcFacture !== undefined &&
      ligne.prixProduitActuelTtc !== undefined;

    const prixFactureComparable = comparaisonEnTtc
      ? ligne.prixAchatTtcFacture
      : ligne.prixAchatHtFacture;

    const prixProduitComparable = comparaisonEnTtc
      ? ligne.prixProduitActuelTtc
      : ligne.prixProduitActuelHt;

    const prixDifferent =
      prixProduitComparable === undefined ||
      prixFactureComparable === undefined ||
      Math.abs(
        arrondirMontant(prixFactureComparable) -
          arrondirMontant(prixProduitComparable),
      ) > TOLERANCE_PRIX_ACHAT;

    if (!prixDifferent) {
      continue;
    }

    const produitSelectionne = ligne.produitsProposes?.find(
      (produit) => produit.id === produitId,
    );

    /*
     * Si le même produit apparaît plusieurs fois,
     * la dernière ligne du document est conservée.
     */
    ecartsParProduit.set(produitId, {
      produitId,

      reference:
        produitSelectionne?.reference?.trim() ||
        ligne.reference?.trim() ||
        `Produit #${produitId}`,

      description:
        produitSelectionne?.description?.trim() ||
        ligne.designation?.trim() ||
        "Sans description",

      prixProduitActuelHt: ligne.prixProduitActuelHt,
      prixProduitActuelTtc: ligne.prixProduitActuelTtc,
      prixFactureHt: ligne.prixAchatHtFacture,
      prixFactureTtc: ligne.prixAchatTtcFacture,
      comparaisonEnTtc,
      mettreAJourPrixProduit: ligne.mettreAJourPrixProduit,
    });
  }

  return Array.from(ecartsParProduit.values());
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

  const [indexLigneCreationProduit, setIndexLigneCreationProduit] = useState<
    number | null
  >(null);

  const [validationPrixOuverte, setValidationPrixOuverte] = useState(false);

  const [autoriserReintegration, setAutoriserReintegration] = useState(false);

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
    setAutoriserReintegration(false);
    setEtat({ type: "idle" });
  }, []);

  type ResultatRechercheProduits = {
    produits: ProduitRecherche[];
    associationMemorisee: boolean;
  };

  const rechercherProduits = async (
    recherche: string,
  ): Promise<ResultatRechercheProduits> => {
    const q = recherche.trim();

    if (q.length < 2) {
      return { produits: [], associationMemorisee: false };
    }

    const params = new URLSearchParams({ q });

    if (fournisseurId) {
      params.set("fournisseurId", fournisseurId);
    }

    const res = await fetch(`/api/produits/recherche?${params.toString()}`);

    const data = await res.json();

    if (!res.ok) {
      console.error("[RECHERCHE_PRODUITS_UI]", data);
      return { produits: [], associationMemorisee: false };
    }

    return {
      produits: Array.isArray(data.produits) ? data.produits : [],
      associationMemorisee: data.associationMemorisee === true,
    };
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
         * Priorité absolue à la référence fournisseur seule.
         * C'est cette valeur exacte qui permet de retrouver une association
         * déjà mémorisée pour Mechouar.
         */
        let resultat =
          reference.length >= 2
            ? await rechercherProduits(reference)
            : { produits: [], associationMemorisee: false };
        let produits = resultat.produits;

        /*
         * Si aucune association exacte ni proposition n'est trouvée,
         * on élargit à la référence + désignation.
         */
        const rechercheComplete = [reference, designation]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (produits.length === 0 && rechercheComplete.length >= 2) {
          resultat = await rechercherProduits(rechercheComplete);
          produits = resultat.produits;
        }

        /*
         * Dernier recours : désignation seule.
         */
        if (produits.length === 0 && designation.length >= 2) {
          resultat = await rechercherProduits(designation);
          produits = resultat.produits;
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
          resultat.associationMemorisee && premier
            ? premier.id
            : premier &&
                scorePremier >= 90 &&
                (!second || scorePremier - scoreSecond >= 15)
              ? premier.id
              : null;

        return enrichirLigneAvecPrixProduit(
          {
            ...ligne,
            produitRecherche: "",
            produitsProposes: produits,
            rechercheProduitEnCours: false,
          },
          selectionAutomatique,
          produits,
        );
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
          message: [ocrData.error || "Erreur lors de l'OCR.", ocrData.detail]
            .filter(Boolean)
            .join(" — "),
        });
        return;
      }

      const lignesBrutes = Array.isArray(ocrData.extraction?.lignes)
        ? ocrData.extraction.lignes
        : [];

      const lignes = lignesBrutes
        .filter(
          (
            ligne: LigneFactureExtraite | null | undefined,
          ): ligne is LigneFactureExtraite => Boolean(ligne),
        )
        .map((ligne: LigneFactureExtraite) => ({
          ...ligne,
          confiance: Number(ligne.confiance) || 0,
          alertes: Array.isArray(ligne.alertes) ? ligne.alertes : [],
        }));

      const lignesAvecProduits = await enrichirLignesAvecProduits(lignes);

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
        doublonFacture: ocrData.doublonFacture ?? null,
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

    const resultat = await rechercherProduits(q);
    const produits = resultat.produits;
    const produitMemoriseId =
      resultat.associationMemorisee && produits.length === 1
        ? produits[0].id
        : null;

    setLignesEditables((lignes) =>
      lignes.map((ligne, i) =>
        i === index
          ? enrichirLigneAvecPrixProduit(
              {
                ...ligne,
                produitsProposes: produits,
                rechercheProduitEnCours: false,
              },
              produitMemoriseId,
              produits,
            )
          : ligne,
      ),
    );
  };

  const ouvrirCreationProduit = (index: number) => {
    setIndexLigneCreationProduit(index);
  };

  const fermerCreationProduit = () => {
    setIndexLigneCreationProduit(null);
  };

  const rattacherProduitCree = async (produit: {
    id: number;
    reference?: string;
  }) => {
    const index = indexLigneCreationProduit;

    if (index === null) {
      return;
    }

    const reference = produit.reference?.trim() ?? "";

    let produitsProposes: ProduitRecherche[] = [];

    if (reference.length >= 2) {
      const resultat = await rechercherProduits(reference);
      produitsProposes = resultat.produits;
    }

    setLignesEditables((lignes) =>
      lignes.map((ligne, i) => {
        if (i !== index) {
          return ligne;
        }

        return enrichirLigneAvecPrixProduit(
          {
            ...ligne,
            produitRecherche: "",
            produitsProposes,
            rechercheProduitEnCours: false,
          },
          produit.id,
          produitsProposes,
        );
      }),
    );

    setIndexLigneCreationProduit(null);
  };

  const selectionnerProduitPourLigne = (
    index: number,
    produitId: number | null,
  ) => {
    setLignesEditables((lignes) =>
      lignes.map((ligne, i) => {
        if (i !== index) {
          return ligne;
        }

        return enrichirLigneAvecPrixProduit(
          ligne,
          produitId,
          ligne.produitsProposes ?? [],
        );
      }),
    );
  };

  const definirDecisionPrixProduit = (
    produitId: number,
    mettreAJour: boolean,
  ) => {
    setLignesEditables((lignes) =>
      lignes.map((ligne) =>
        ligne.produitId === produitId
          ? {
              ...ligne,
              mettreAJourPrixProduit: mettreAJour,
            }
          : ligne,
      ),
    );
  };

  const envoyerValidationLignes = async () => {
    if (etat.type !== "succes") return;

    try {
      const res = await fetch(
        `/api/factures-fournisseurs/valider-lignes/${etat.documentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lignes: lignesEditables,
            autoriserReintegration,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        setValidationPrixOuverte(false);

        setEtat({
          type: "erreur",
          message: data.error || "Erreur de validation.",
        });

        return;
      }

      router.push("/factures-fournisseurs");
      router.refresh();
    } catch (error) {
      console.error("[VALIDER_LIGNES_UI]", error);

      setValidationPrixOuverte(false);

      setEtat({
        type: "erreur",
        message: "Erreur réseau lors de la validation des lignes.",
      });
    }
  };

  const validerLignes = async () => {
    if (etat.type !== "succes") return;

    const metAJourPrixAchat = etat.extraction?.metAJourPrixAchat !== false;

    if (metAJourPrixAchat) {
      const ecartsPrix = regrouperEcartsPrixProduits(lignesEditables);

      const decisionsManquantes = ecartsPrix.some(
        (ecart) => typeof ecart.mettreAJourPrixProduit !== "boolean",
      );

      if (decisionsManquantes) {
        setValidationPrixOuverte(true);
        return;
      }
    }

    await envoyerValidationLignes();
  };

  const reinitialiser = () => {
    setFichierSelectionne(null);
    setLignesEditables([]);
    setAutoriserReintegration(false);
    setEtat({ type: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const ligneCreationProduit =
    indexLigneCreationProduit !== null
      ? (lignesEditables[indexLigneCreationProduit] ?? null)
      : null;

  const prixAchatTtcCreationProduit = lireNombreLigne(ligneCreationProduit, [
    "prixUnitaireTtc",
    "prixAchatTtc",
    "prixTtc",
  ]);

  /*
   * Lorsqu'aucune TVA n'est détectée par l'OCR,
   * la création d'un nouveau produit utilise 20 %.
   */
  const tauxTvaCreationProduit =
    lireNombreLigne(ligneCreationProduit, [
      "tauxTva",
      "tauxTvaPourcentage",
      "pourcentageTva",
    ]) ?? 20;

  const prixAchatHtOcr = lireNombreLigne(ligneCreationProduit, [
    "prixUnitaireHt",
    "prixAchatHt",
    "prixHt",
  ]);

  const coefficientTvaCreationProduit = 1 + tauxTvaCreationProduit / 100;

  /*
   * Priorité au prix TTC OCR.
   * Le HT est calculé avec la TVA, 20 % par défaut.
   *
   * Le prix HT OCR direct reste uniquement une solution
   * de secours pour les autres formats de documents.
   */
  const prixAchatHtCreationProduit =
    prixAchatTtcCreationProduit !== undefined &&
    coefficientTvaCreationProduit > 0
      ? arrondirMontant(
          prixAchatTtcCreationProduit / coefficientTvaCreationProduit,
        )
      : prixAchatHtOcr;

  const ecartsPrixProduits = regrouperEcartsPrixProduits(lignesEditables);

  const toutesLesDecisionsPrixSontPrises =
    ecartsPrixProduits.length > 0 &&
    ecartsPrixProduits.every(
      (ecart) => typeof ecart.mettreAJourPrixProduit === "boolean",
    );

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
        <div className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3">
          <span
            className="inline-block text-2xl animate-spin"
            role="status"
            aria-label="Analyse OCR en cours"
          >
            ⏳
          </span>

          <div>
            <p className="font-medium">Reconnaissance OCR en cours…</p>

            <p className="text-xs text-blue-600">
              Analyse du document #{etat.documentId} — {etat.nomFichier}
            </p>
          </div>
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

            {etat.doublonFacture && (
              <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900">
                <h3 className="font-semibold">
                  Facture potentiellement déjà intégrée
                </h3>

                <p className="mt-2">
                  Une facture du même fournisseur portant le numéro{" "}
                  <strong>{etat.doublonFacture.numeroFacture}</strong> a déjà
                  été intégrée au stock.
                </p>

                <p className="mt-1">
                  Document précédent : #{etat.doublonFacture.documentId}
                </p>

                <p className="mt-1">
                  Date d’intégration :{" "}
                  {new Date(etat.doublonFacture.dateIntegration).toLocaleString(
                    "fr-FR",
                  )}
                </p>

                <p className="mt-3 font-medium">
                  Une nouvelle validation ajoutera une seconde fois les
                  quantités au stock.
                </p>

                <div className="mt-4 rounded-md border border-orange-200 bg-white p-3">
                  <p className="font-semibold">Options de développement</p>

                  <label className="mt-2 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={autoriserReintegration}
                      onChange={(event) =>
                        setAutoriserReintegration(event.target.checked)
                      }
                      className="mt-1"
                    />

                    <span>
                      Autoriser exceptionnellement cette réintégration pendant
                      les tests
                    </span>
                  </label>
                </div>
              </div>
            )}

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
                          lignesEditables
                            .filter((ligne): ligne is LigneFactureExtraite =>
                              Boolean(ligne),
                            )
                            .reduce(
                              (total, ligne) =>
                                total + (Number(ligne.confiance) || 0),
                              0,
                            ) / lignesEditables.filter(Boolean).length,
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
                onCreerProduit={ouvrirCreationProduit}
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

      <ProduitFormModal
        ouvert={indexLigneCreationProduit !== null}
        reference={ligneCreationProduit?.reference ?? ""}
        description={ligneCreationProduit?.designation ?? ""}
        fournisseurId={fournisseurId ? Number(fournisseurId) : null}
        prixAchatHt={prixAchatHtCreationProduit}
        tauxTvaPourcentage={tauxTvaCreationProduit}
        onFermer={fermerCreationProduit}
        onProduitCree={rattacherProduitCree}
      />

      <Modal
        ouvert={validationPrixOuverte}
        titre="Contrôle des prix d’achat"
        onFermer={() => setValidationPrixOuverte(false)}
        enfants={
          <div className="space-y-6">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">
                Des différences de prix d’achat ont été détectées.
              </p>

              <p className="mt-1">
                Choisissez séparément, pour chaque produit, si le dernier prix
                d’achat de sa fiche doit être mis à jour.
              </p>
            </div>

            <div className="space-y-4">
              {ecartsPrixProduits.map((ecart) => (
                <div
                  key={ecart.produitId}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-4">
                    <p className="font-semibold text-gray-900">
                      {ecart.reference}
                    </p>

                    <p className="text-sm text-gray-600">{ecart.description}</p>
                  </div>

                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-gray-50 p-3">
                      <p className="text-xs font-medium uppercase text-gray-500">
                        Prix actuellement enregistré
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {ecart.comparaisonEnTtc &&
                        ecart.prixProduitActuelTtc !== undefined
                          ? `${ecart.prixProduitActuelTtc.toLocaleString(
                              "fr-FR",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )} MAD TTC`
                          : ecart.prixProduitActuelHt !== undefined
                            ? `${ecart.prixProduitActuelHt.toLocaleString(
                                "fr-FR",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )} MAD HT`
                            : "Aucun prix enregistré"}
                      </p>
                    </div>

                    <div className="rounded-md bg-blue-50 p-3">
                      <p className="text-xs font-medium uppercase text-blue-600">
                        Prix de cette facture
                      </p>

                      <p className="mt-1 font-semibold text-blue-900">
                        {ecart.comparaisonEnTtc &&
                        ecart.prixFactureTtc !== undefined
                          ? `${ecart.prixFactureTtc.toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} MAD TTC`
                          : ecart.prixFactureHt !== undefined
                            ? `${ecart.prixFactureHt.toLocaleString("fr-FR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} MAD HT`
                            : "Prix non exploitable"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-gray-50">
                      <input
                        type="radio"
                        name={`decision-prix-${ecart.produitId}`}
                        checked={ecart.mettreAJourPrixProduit === false}
                        onChange={() =>
                          definirDecisionPrixProduit(ecart.produitId, false)
                        }
                        className="mt-1"
                      />

                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          Conserver le prix actuel
                        </span>

                        <span className="block text-xs text-gray-500">
                          La fiche produit ne sera pas modifiée.
                        </span>
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-gray-50">
                      <input
                        type="radio"
                        name={`decision-prix-${ecart.produitId}`}
                        checked={ecart.mettreAJourPrixProduit === true}
                        onChange={() =>
                          definirDecisionPrixProduit(ecart.produitId, true)
                        }
                        className="mt-1"
                      />

                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          Mettre à jour la fiche produit
                        </span>

                        <span className="block text-xs text-gray-500">
                          Le prix de cette facture deviendra le dernier prix
                          d’achat du produit.
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setValidationPrixOuverte(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={!toutesLesDecisionsPrixSontPrises}
                onClick={async () => {
                  setValidationPrixOuverte(false);
                  await envoyerValidationLignes();
                }}
                className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmer et valider
              </button>
            </div>
          </div>
        }
      />

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
            {etat.type === "ocr_en_cours" ? (
              <span className="flex items-center gap-2">
                <span className="inline-block animate-spin">⏳</span>
                OCR en cours…
              </span>
            ) : etat.type === "uploading" ? (
              "Upload en cours…"
            ) : (
              "Uploader et lancer OCR"
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={validerLignes}
            disabled={Boolean(etat.doublonFacture) && !autoriserReintegration}
            className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {etat.doublonFacture
              ? "Intégrer à nouveau malgré l’avertissement"
              : "Valider les lignes"}
          </button>
        )}
      </div>
    </div>
  );
}
