import type { ProfilOcrFournisseur } from "../types"
import { casinfoDriver } from "./casinfo"
import { mechouarDriver } from "./mechouar"
import { genericDriver, genericLargeDriver } from "./generic"

export const driversOcr: ProfilOcrFournisseur[] = [
  casinfoDriver,
  mechouarDriver,
]

export {
  casinfoDriver,
  mechouarDriver,
  genericDriver,
  genericLargeDriver,
}

function normaliserNomFournisseur(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function chargerDriverOcr(
  fournisseurNom?: string,
): ProfilOcrFournisseur {
  const nomNormalise = normaliserNomFournisseur(fournisseurNom || "")

  if (!nomNormalise) {
    return genericDriver
  }

  const driver = driversOcr.find((profil) =>
    profil.aliases.some((alias) => {
      const aliasNormalise = normaliserNomFournisseur(alias)

      return (
        aliasNormalise.length > 0 &&
        nomNormalise.includes(aliasNormalise)
      )
    }),
  )

  return driver || genericDriver
}