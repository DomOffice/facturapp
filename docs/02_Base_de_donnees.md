# 02_Base_de_donnees.md — Documentation Prisma et relations

Dernière mise à jour : 28/06/2026

## 1. Vue générale

La base de données est définie dans :

```txt
prisma/schema.prisma
```

Le provider cible est :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Le schéma utilise `@@map` pour conserver des noms de tables SQL en snake_case.

## 2. Authentification et utilisateurs

### Role

Table : `roles`

Champs principaux :

- `id`
- `code` unique
- `nom`

Relation :

- un rôle possède plusieurs utilisateurs.

### Utilisateur

Table : `utilisateurs`

Champs principaux :

- `id`
- `nom`
- `email` unique
- `motDePasseHash`
- `roleId`
- `actif`
- timestamps

Relations :

- appartient à un `Role` ;
- peut créer des `Facture` ;
- peut avoir des entrées `JournalAudit` ;
- peut être lié à des `DocumentImporte`.

## 3. Paramètres société et métier

### Entreprise

Table : `entreprise`

Contient les informations société : raison sociale, adresse, téléphone, email, ICE, IF, RC, patente, logo, compte bancaire, devise, format date.

### ParametreType / Parametre

Tables :

- `parametre_types`
- `parametres`

Utilisées pour :

- types client ;
- types fournisseur ;
- types produit ;
- unités ;
- TVA ;
- modes de règlement ;
- types de charges.

## 4. Tiers

### Client

Table : `clients`

Relations :

- un client possède plusieurs factures ;
- plusieurs avoirs ;
- plusieurs devis.

Index :

- raison sociale ;
- téléphone ;
- ville.

### Fournisseur

Table : `fournisseurs`

Relations :

- produits ;
- prix produits ;
- charges ;
- documents importés.

Index :

- raison sociale ;
- téléphone.

## 5. Produits et prix

### Produit

Table : `produits`

Champs importants :

- `reference`
- `description`
- `dernierPrixAchatHt`
- `dernierPrixAchatTtc`
- `prixVenteHt`
- `prixVenteTtc`
- `margeHt`

Relations :

- fournisseur ;
- type produit ;
- unité ;
- TVA ;
- historique prix ;
- lignes factures/devis/avoirs ;
- lignes importées.

### PrixProduit

Table : `prix_produits`

Permet de conserver l'historique d'achat/vente par produit, date, fournisseur et TVA.

## 6. Facturation client

### Facture

Table : `factures`

Champs importants :

- année ;
- numéro de séquence ;
- numéro facture unique ;
- client ;
- date ;
- statut ;
- totaux ;
- marge ;
- impression ;
- avoir associé ou non.

Contraintes :

- `numeroFacture` unique ;
- couple `annee + numeroSequence` unique.

Relations :

- client ;
- créateur ;
- lignes ;
- paiement ;
- avoirs.

### FactureLigne

Table : `facture_lignes`

Détail des produits/prestations facturés.

Suppression en cascade si la facture est supprimée.

## 7. Paiements

### Paiement

Table : `paiements`

Relation 1-1 avec `Facture` via `factureId` unique.

Champs :

- date paiement ;
- mode règlement ;
- numéro pièce ;
- justificatif ;
- montants.

## 8. Charges

### Charge

Table : `charges`

Modèle actuel pour les charges/factures fournisseurs simples.

Champs :

- date charge ;
- numéro facture ;
- émetteur ;
- type charge ;
- montants HT/TVA/TTC ;
- fournisseur facultatif ;
- remarque.

Limite : ce modèle ne contient pas de lignes de facture fournisseur.

## 9. Avoirs

### Avoir / AvoirLigne

Tables :

- `avoirs`
- `avoir_lignes`

Liés à une facture et un client.

## 10. Devis

### Devis / DevisLigne

Tables :

- `devis`
- `devis_lignes`

Structure proche des factures.

## 11. Import OCR fournisseurs

### DocumentImporte

Table : `documents_importes`

Rôle : représenter un fichier importé avant/après OCR.

Champs importants :

- fournisseurId ;
- nomFichierOriginal ;
- nomFichierStocke ;
- cheminFichier ;
- typeMime ;
- tailleFichier ;
- texteOcr ;
- statut ;
- dateImport ;
- utilisateurId ;
- donneesExtraites JSON.

Statuts prévus par commentaire :

```txt
brouillon | en_traitement | valide | rejete
```

### LigneImportee

Table : `lignes_importees`

Rôle : représenter les lignes détectées depuis l'OCR.

Champs :

- documentImporteId ;
- designation ;
- quantite ;
- prixUnitaire ;
- tauxTva ;
- montantTotal ;
- referenceDetectee ;
- produitId facultatif ;
- statut.

## 12. Recommandations BDD

Priorités :

1. Ajouter ou confirmer les migrations Prisma.
2. Remplacer certains statuts `String` par enums Prisma.
3. Ajouter une entité `FactureFournisseur` si le besoin dépasse la simple charge.
4. Ajouter un lien entre `DocumentImporte` et `Charge` ou `FactureFournisseur` après validation.
5. Indexer les recherches fréquentes du module OCR : fournisseur, statut, date, numéro facture détecté.
6. Ne pas stocker uniquement le chemin absolu local : prévoir aussi un chemin relatif/clé de stockage.

