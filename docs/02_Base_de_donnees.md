# 02 — Base de données FacturApp

Dernière mise à jour : 2026-08-08

## 1. Principe

FacturApp utilise PostgreSQL. MariaDB reste la base historique de l’application VB6 et la source de réimport des données métier existantes.

Les données PostgreSQL peuvent être distinguées en deux familles :

### Données historiques synchronisées depuis VB6

- clients ;
- fournisseurs ;
- produits ;
- factures et lignes ;
- paiements ;
- devis et lignes ;
- avoirs et lignes.

### Données propres à FacturApp

- documents importés ;
- lignes OCR validées ;
- associations fournisseur-produit ;
- intégrations de stock ;
- mouvements de stock ;
- données OCR structurées et diagnostics.

La synchronisation VB6 ne doit pas supprimer ces tables spécifiques.

## 2. Modèles OCR / stock

### DocumentImporte

Point d’entrée d’un document fournisseur.

Contient notamment :

- fournisseur ;
- fichier original / stocké ;
- statut ;
- texte OCR ;
- JSON d’extraction ;
- dates techniques.

### LigneImportee

Version persistée d’une ligne OCR validée ou partiellement validée.

Contient notamment :

- référence fournisseur ;
- désignation ;
- quantité ;
- prix ;
- taux TVA ;
- montant TVA ;
- montant total ;
- produit associé éventuel ;
- statut.

### IntegrationStock

Trace l’intégration globale d’un document fournisseur au stock.

Une facture Mechouar ne doit pas créer d’intégration stock.

### MouvementStock

Trace chaque entrée stock issue d’une ligne rapprochée :

- produit ;
- quantité ;
- stock avant ;
- stock après ;
- document source.

## 3. États métier principaux

Les documents fournisseurs utilisent notamment :

- `valide` ;
- `stock_integre`.

Les lignes peuvent aussi rester dans un état sans stock lorsqu’une validation partielle est forcée.

## 4. Règles TVA / stock

| Profil | TVA | Stock |
|---|---:|---:|
| `mechouar_facture` | Oui | Non |
| `mechouar` | Non | Oui |
| `casinfo` | Oui | Oui |
| `mztech` | Oui | Oui |

Les autres fournisseurs suivent par défaut le comportement facture fournisseur : TVA + stock, sauf règle documentaire spécifique.

## 5. TVA

La TVA payée provient des factures fournisseurs assujetties et des charges.

La TVA perçue provient des factures clients.

La page `/tva` offre des filtres par date, client et fournisseur.

## 6. Synchronisation MariaDB → PostgreSQL

Script :

```text
prisma/sync-mariadb-to-pg.ts
```

Le script utilise `DATABASE_URL` si disponible et conserve la possibilité d’utiliser des variables PostgreSQL historiques séparées.

La conversion TVA est normalisée :

```text
0.20 → 20 %
20   → 20 %
```

Le type fournisseur est synchronisé quand une correspondance de paramètre existe.

Pour les clients, le portable peut être repris comme téléphone de secours si le téléphone principal est vide.

## 7. Réinitialisation pendant la phase de test

Tant que PostgreSQL ne contient pas de données irremplaçables, une reconstruction depuis `prisma/schema.prisma` est acceptable après décision explicite :

```powershell
npx prisma db push --force-reset --accept-data-loss
npx prisma generate
```

Puis exécuter le seed ou la synchronisation VB6 selon le besoin.

Cette stratégie n’est pas une règle de production définitive. Lorsque FacturApp deviendra la source principale, une stratégie de migrations versionnées devra être mise en place.

## 8. Seed

Le fichier :

```text
prisma/seed.ts
```

crée notamment :

- rôles ;
- administrateur ;
- entreprise par défaut ;
- types de paramètres ;
- paramètres de TVA, unités, types fournisseurs, etc.

Si `prisma db seed` n’est pas configuré dans `package.json`, le seed peut être exécuté directement avec `tsx` pendant la phase de développement.

## 9. Prisma — règles de prudence

- `prisma generate` : sans impact base.
- `prisma validate` : sans impact base.
- `prisma db pull` : peut réécrire le fichier Prisma.
- `prisma db push` : modifie la base.
- `prisma migrate reset` : destructif.

Avant toute opération structurelle, vérifier la base réellement ciblée par `DATABASE_URL`.
