// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Initialisation de la base de données...')

  // ─── RÔLES ─────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { code: 'admin' }, update: {}, create: { code: 'admin', nom: 'Administrateur' } }),
    prisma.role.upsert({ where: { code: 'saisie' }, update: {}, create: { code: 'saisie', nom: 'Saisie' } }),
    prisma.role.upsert({ where: { code: 'consultation' }, update: {}, create: { code: 'consultation', nom: 'Consultation' } }),
  ])
  console.log('✅ Rôles créés')

  // ─── UTILISATEUR ADMIN ─────────────────────────────────────────
  const hash = await bcrypt.hash('admin123', 12)
  await prisma.utilisateur.upsert({
    where: { email: 'admin@facturapp.ma' },
    update: {},
    create: {
      nom: 'Administrateur',
      email: 'admin@facturapp.ma',
      motDePasseHash: hash,
      roleId: roles[0].id,
      actif: true,
    },
  })
  console.log('✅ Utilisateur admin créé (email: admin@facturapp.ma / mdp: admin123)')

  // ─── ENTREPRISE ────────────────────────────────────────────────
  await prisma.entreprise.upsert({
    where: { id: 1 },
    update: {},
    create: {
      raisonSociale: 'Ma Société SARL',
      adresse: '123, Boulevard Hassan II',
      codePostal: '20000',
      ville: 'Casablanca',
      telephone: '0522-000000',
      email: 'contact@masociete.ma',
      ice: '000000000000000',
      devise: 'MAD',
    },
  })
  console.log('✅ Entreprise créée')

  // ─── TYPES DE PARAMÈTRES ───────────────────────────────────────
  const typeClient = await prisma.parametreType.upsert({ where: { code: 'type_client' }, update: {}, create: { code: 'type_client', nom: 'Type client' } })
  const typeFournisseur = await prisma.parametreType.upsert({ where: { code: 'type_fournisseur' }, update: {}, create: { code: 'type_fournisseur', nom: 'Type fournisseur' } })
  const modeReglement = await prisma.parametreType.upsert({ where: { code: 'mode_reglement' }, update: {}, create: { code: 'mode_reglement', nom: 'Mode de règlement' } })
  const unite = await prisma.parametreType.upsert({ where: { code: 'unite' }, update: {}, create: { code: 'unite', nom: 'Unité' } })
  const tauxTva = await prisma.parametreType.upsert({ where: { code: 'taux_tva' }, update: {}, create: { code: 'taux_tva', nom: 'Taux TVA' } })
  const typeProduit = await prisma.parametreType.upsert({ where: { code: 'type_produit' }, update: {}, create: { code: 'type_produit', nom: 'Type produit' } })
  const typeCharge = await prisma.parametreType.upsert({ where: { code: 'type_charge' }, update: {}, create: { code: 'type_charge', nom: 'Type de charge' } })
  console.log('✅ Types de paramètres créés')

  // ─── PARAMÈTRES TYPES CLIENT ───────────────────────────────────
  const typesClient = ['Maître', 'Docteur', 'Particulier', 'Entreprise', 'Inconnu']
  for (let i = 0; i < typesClient.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 100 + i },
      update: {},
      create: { typeId: typeClient.id, code: typesClient[i].toLowerCase().replace(/\s/g, '_'), libelle: typesClient[i], ordreAffichage: i + 1 },
    })
  }

  // ─── PARAMÈTRES TYPES FOURNISSEUR ──────────────────────────────
  const typesFournisseur = ['Fournisseur local', 'Importateur', 'Grossiste', 'Inconnu']
  for (let i = 0; i < typesFournisseur.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 200 + i },
      update: {},
      create: { typeId: typeFournisseur.id, code: typesFournisseur[i].toLowerCase().replace(/\s/g, '_'), libelle: typesFournisseur[i], ordreAffichage: i + 1 },
    })
  }

  // ─── MODES DE RÈGLEMENT ────────────────────────────────────────
  const modes = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Avoir']
  for (let i = 0; i < modes.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 300 + i },
      update: {},
      create: { typeId: modeReglement.id, code: modes[i].toLowerCase().replace(/\s/g, '_').replace(/è/g, 'e'), libelle: modes[i], ordreAffichage: i + 1 },
    })
  }

  // ─── UNITÉS ────────────────────────────────────────────────────
  const unites = ['Unité', 'Boîte', 'Paquet', 'Kilogramme', 'Litre', 'Mètre', 'm²', 'm³']
  for (let i = 0; i < unites.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 400 + i },
      update: {},
      create: { typeId: unite.id, code: unites[i].toLowerCase().replace(/[²³îô]/g, c => ({ '²': '2', '³': '3', 'î': 'i', 'ô': 'o' }[c] || c)), libelle: unites[i], ordreAffichage: i + 1 },
    })
  }

  // ─── TAUX TVA ──────────────────────────────────────────────────
  const tauxTvaValues = [{ code: 'tva_0', libelle: 'Exonéré (0%)', val: 0 }, { code: 'tva_7', libelle: 'TVA 7%', val: 7 }, { code: 'tva_14', libelle: 'TVA 14%', val: 14 }, { code: 'tva_20', libelle: 'TVA 20%', val: 20 }]
  for (let i = 0; i < tauxTvaValues.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 500 + i },
      update: {},
      create: { typeId: tauxTva.id, code: tauxTvaValues[i].code, libelle: tauxTvaValues[i].libelle, valeurNum: tauxTvaValues[i].val, ordreAffichage: i + 1 },
    })
  }

  // ─── TYPES PRODUIT ─────────────────────────────────────────────
  const typesProduit = ['Écriture', 'Classeur', 'Papier', 'Informatique', 'Fourniture bureau', 'Autre']
  for (let i = 0; i < typesProduit.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 600 + i },
      update: {},
      create: { typeId: typeProduit.id, code: typesProduit[i].toLowerCase().replace(/\s/g, '_').replace(/é/g, 'e'), libelle: typesProduit[i], ordreAffichage: i + 1 },
    })
  }

  // ─── TYPES CHARGES ─────────────────────────────────────────────
  const typesCharge = [
    'Fournisseur', 'Autres achats non immobilisés à l\'intérieur', 'Autres prestations de services',
    'Prestations de services', 'Transport', 'Hôtels et hébergement', 'Eau',
    'Opérations bancaires', 'Honoraires juridiques', 'Autres achats non immobilisés à l\'importation',
    'Travaux immobiliers sous-traités', 'CNSS & AMO', 'Équipements', 'Maintenance et hygiène',
    'Salaires', 'Téléphone et Internet', 'Honoraires comptable', 'Autres immobilisations',
    'IR', 'Électricité', 'Communication', 'Alimentation de la caisse', 'Autres petits achats',
  ]
  for (let i = 0; i < typesCharge.length; i++) {
    await prisma.parametre.upsert({
      where: { id: 700 + i },
      update: {},
      create: { typeId: typeCharge.id, code: `charge_${i + 1}`, libelle: typesCharge[i], ordreAffichage: i + 1 },
    })
  }

  console.log('✅ Tous les paramètres créés')
  console.log('\n🎉 Base de données initialisée avec succès !')
  console.log('📧 Connexion : admin@facturapp.ma')
  console.log('🔑 Mot de passe : admin123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
