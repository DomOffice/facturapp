import type { ProfilOcrFournisseur } from '../types'
import { casinfoDriver } from './casinfo'
import { genericDriver, genericLargeDriver } from './generic'

export const driversOcr: ProfilOcrFournisseur[] = [
  casinfoDriver,
  genericDriver,
]

export { genericDriver, genericLargeDriver }

export function chargerDriverOcr(fournisseurNom?: string): ProfilOcrFournisseur {
  const nom = (fournisseurNom || '').toLowerCase()

  const driver = driversOcr.find((profil) =>
    profil.aliases.some((alias) => nom.includes(alias.toLowerCase())),
  )

  return driver || genericDriver
}