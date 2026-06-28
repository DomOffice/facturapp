# 00_Architecture.md — Vue d'ensemble FacturApp

Dernière mise à jour : 28/06/2026

## 1. Objectif du projet

FacturApp est une application web de gestion commerciale orientée facturation, devis, avoirs, paiements, clients, fournisseurs, produits, charges et import de factures fournisseurs.

Le module en cours de travail concerne l'import de factures fournisseurs au format PDF/image, avec objectif futur :

1. télécharger/importer la facture fournisseur ;
2. stocker le fichier ;
3. extraire les informations via OCR ;
4. permettre une validation manuelle ;
5. intégrer les éléments validés dans la base de données ;
6. éventuellement alimenter le stock, les prix d'achat et les charges.

## 2. Stack technique identifiée

- Framework : Next.js 14 App Router
- Langage : TypeScript
- UI : React 18 + Tailwind CSS
- ORM : Prisma
- Base cible : PostgreSQL
- Authentification : NextAuth v5 beta
- Exports : jsPDF, xlsx
- Scripts migration/synchronisation : Prisma + mysql2 + pg

## 3. Structure générale

```txt
src/
  app/
    (dashboard)/
      clients/
      fournisseurs/
      produits/
      factures/
      devis/
      avoirs/
      paiements/
      charges/
      factures-fournisseurs/
      parametres/
      utilisateurs/
      admin/sync/
    api/
      clients/
      fournisseurs/
      produits/
      factures/
      devis/
      avoirs/
      paiements/
      charges/
      factures-fournisseurs/upload/
      auth/[...nextauth]/
      admin/sync-mariadb/
    connexion/
  components/
    forms/
    layout/
    ocr/
    ui/
  lib/
    auth/
    business/
    db/
    exports/
    utils/
prisma/
  schema.prisma
  seed.ts
  migrate-*.ts
  sync-*.ts
```

## 4. Organisation fonctionnelle

### Modules principaux

- **Clients** : création, liste, consultation via API.
- **Fournisseurs** : création, liste, consultation via API.
- **Produits** : gestion catalogue, prix, fournisseurs, TVA.
- **Factures clients** : création, liste, détail, PDF, actions de validation/dévalidation.
- **Devis** : création, liste, détail, conversion en facture.
- **Avoirs** : création/consultation liée aux factures.
- **Paiements** : suivi des paiements liés aux factures.
- **Charges** : saisie des charges et factures fournisseurs simples.
- **Factures fournisseurs** : module en construction pour import PDF/OCR.
- **Paramètres** : entreprise, TVA, types, modes de règlement.
- **Administration** : utilisateurs, synchronisation MariaDB/PostgreSQL.

## 5. Routage Next.js

L'application utilise le route group `(dashboard)`, donc les routes sont exposées sans le segment `(dashboard)` dans l'URL.

Exemples :

```txt
src/app/(dashboard)/factures/page.tsx                 -> /factures
src/app/(dashboard)/factures/nouvelle/page.tsx        -> /factures/nouvelle
src/app/(dashboard)/factures-fournisseurs/page.tsx    -> /factures-fournisseurs
src/app/(dashboard)/factures-fournisseurs/nouveau/page.tsx -> /factures-fournisseurs/nouveau
```

La route `/dashboard` n'est pas présente comme page réelle. La page d'accueil dashboard semble être `src/app/(dashboard)/page.tsx`, donc l'URL correspondante est `/`.

## 6. Architecture données

Le schéma Prisma est relativement complet et couvre :

- authentification interne : `Utilisateur`, `Role` ;
- paramètres : `Entreprise`, `ParametreType`, `Parametre` ;
- tiers : `Client`, `Fournisseur` ;
- produits et prix : `Produit`, `PrixProduit` ;
- ventes : `Facture`, `FactureLigne`, `Paiement`, `Avoir`, `AvoirLigne`, `Devis`, `DevisLigne` ;
- charges : `Charge` ;
- import OCR : `DocumentImporte`, `LigneImportee` ;
- audit : `JournalAudit`.

## 7. Flux module factures fournisseurs

État actuel observé :

```txt
/factures-fournisseurs
  liste des factures fournisseurs simulée via prisma.charge.findMany()

/factures-fournisseurs/nouveau
  page d'import avec composant UploadFacture

/api/factures-fournisseurs/upload
  réception FormData
  validation MIME/taille
  stockage fichier disque
  réponse JSON
```

Flux cible recommandé :

```txt
Upload fichier
  -> création DocumentImporte statut = brouillon ou en_traitement
  -> stockage fichier
  -> OCR
  -> stockage texteOcr + donneesExtraites
  -> écran validation
  -> création charge / lignes importées / mise à jour produits/prix
```

## 8. Principes d'évolution

- Ne pas tout réécrire.
- Corriger d'abord les bugs bloquants.
- Stabiliser les chemins et l'authentification.
- Centraliser progressivement les validations et permissions.
- Documenter chaque décision technique.
- Avancer module par module.

