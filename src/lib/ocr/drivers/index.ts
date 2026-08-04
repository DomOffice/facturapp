import type { ProfilOcrFournisseur } from "../types";
import { casinfoDriver } from "./casinfo";
import { mztechDriver } from "./mztech";
import { mechouarDriver, mechouarFactureDriver } from "./mechouar";
import { genericDriver, genericLargeDriver } from "./generic";

export const driversOcr: ProfilOcrFournisseur[] = [
  casinfoDriver,
  mztechDriver,
  mechouarDriver,
  mechouarFactureDriver,
  genericDriver,
  genericLargeDriver,
];

export { casinfoDriver, mechouarDriver, genericDriver, genericLargeDriver };

function normaliserNomFournisseur(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type TypeDocumentMechouar = "facture" | "bon_livraison";

export function detecterTypeDocumentMechouar(
  texteOcr?: string,
): TypeDocumentMechouar | undefined {
  const texte = texteOcr || "";

  if (/\b\d{2}\/FA\d+\b/i.test(texte)) {
    return "facture";
  }

  if (/\b\d{2}\/BL\d+\b/i.test(texte)) {
    return "bon_livraison";
  }

  if (/\bbon\s+de\s+livraison\b/i.test(texte)) {
    return "bon_livraison";
  }

  if (/\bfacture\b/i.test(texte)) {
    return "facture";
  }

  return undefined;
}

export function chargerDriverOcr(
  fournisseurNom?: string,
  texteOcr?: string,
  typeDocumentConfirme?: TypeDocumentMechouar,
): ProfilOcrFournisseur {
  const nomNormalise = normaliserNomFournisseur(fournisseurNom || "");

  if (!nomNormalise) {
    return genericDriver;
  }

  const driver = driversOcr.find((profil) =>
    profil.aliases.some((alias) => {
      const aliasNormalise = normaliserNomFournisseur(alias);

      return aliasNormalise.length > 0 && nomNormalise.includes(aliasNormalise);
    }),
  );

    if (driver?.code === "mechouar") {
    const typeDocument =
      typeDocumentConfirme ||
      detecterTypeDocumentMechouar(texteOcr);

    if (typeDocument === "facture") {
      return mechouarFactureDriver;
    }

    return mechouarDriver;
  }

  return driver || genericDriver;
}
