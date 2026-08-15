# 02 — Base de données FacturApp

Dernière mise à jour : 2026-08-15

## 1. Principe

FacturApp utilise PostgreSQL. MariaDB reste la base historique de l’application VB6 et la base de coexistence pendant la transition.

Deux PostgreSQL distincts existent :

- PostgreSQL **DEV** : local au PC de développement, dédié aux tests ;
- PostgreSQL **PROD** : local au serveur FacturApp, utilisé par l’application de production.

La base DEV doit rester isolée des synchronisations de production.

## 2. Données historiques et données propres à FacturApp

### Données historiques synchronisables

- entreprise ;
- paramètres ;
- clients ;
- fournisseurs ;
- produits ;
- historique des prix ;
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

Une synchronisation historique ne doit jamais supprimer ces tables spécifiques.

## 3. MariaDB historique observée

Tables principales constatées :

```text
avoirs
avoir_details
bon_commande
bon_commande_details
charges
clients
devis
devis_details
entreprise
factures
facture_details
fournisseurs
paiements
parametres
prix_produits
produits
stock_entrees
```

### TVA MariaDB

Les taux métier sont stockés sous forme décimale, par exemple :

```text
0.0000
0.2000
```

Les paramètres historiques contiennent aussi les valeurs `.7`, `.14`, `.20`. Les scripts doivent normaliser ces représentations.

### Stock MariaDB

Historiquement, les produits étaient présents mais `stock_actuel` n’était pas réellement exploité. La synchronisation PostgreSQL → MariaDB prend désormais en charge ce champ afin de commencer la reprise du stock côté historique.

### Historique des prix

La table `prix_produits` est active et contient l’historique `prix_achat_ht`, `prix_vente_ht`, `coeff_marge`, `date_achat` et fournisseur éventuel.

### Charges

La table `charges` existe mais était vide lors des contrôles du sprint. Elle reste destinée notamment au calcul de TVA payée.

### Bons de commande

Présents en MariaDB mais développement fonctionnel actuellement en attente.

### Entreprise

MariaDB possède une table `entreprise` et les coordonnées société sont désormais reprises dans FacturApp et ses PDF.

### Paiements

Le modèle actuel reste un paiement unique par facture, ce qui correspond au fonctionnement réel des clients.

## 4. Modèles OCR / stock FacturApp

### DocumentImporte

Point d’entrée d’un document fournisseur.

### LigneImportee

Version persistée d’une ligne OCR validée ou partiellement validée.

### IntegrationStock

Trace l’intégration globale d’un document fournisseur au stock.

### MouvementStock

Trace chaque entrée stock issue d’une ligne rapprochée.

## 5. États métier principaux

Les documents fournisseurs utilisent notamment :

- `valide` ;
- `stock_integre`.

Les lignes peuvent aussi rester dans un état sans stock lorsqu’une validation partielle est forcée.

## 6. Règles TVA / stock

| Profil | TVA | Stock |
|---|---:|---:|
| `mechouar_facture` | Oui | Non |
| `mechouar` | Non | Oui |
| `casinfo` | Oui | Oui |
| `mztech` | Oui | Oui |

Les autres fournisseurs suivent par défaut le comportement facture fournisseur : TVA + stock, sauf règle documentaire spécifique.

## 7. TVA

La TVA payée provient des factures fournisseurs assujetties et des charges.

La TVA perçue provient des factures clients.

La page `/tva` offre des filtres par date, client et fournisseur.

## 8. Synchronisation MariaDB → PostgreSQL

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

## 9. Synchronisation PostgreSQL PROD → MariaDB

Script :

```text
prisma/sync-pg-to-mariadb.ts
```

Règle impérative : **uniquement PostgreSQL PROD → MariaDB**.

Le script synchronise actuellement :

```text
parametres
entreprise
clients
fournisseurs
produits
prix_produits
factures
facture_details
devis
devis_details
avoirs
avoir_details
paiements
```

Il recale les `AUTO_INCREMENT` MariaDB et prend en charge le stock produit.

Validation réelle effectuée : création d’une facture dans FacturApp PROD, synchronisation, puis apparition correcte dans MariaDB.

Interface d’administration :

```text
/admin/sync
```

## 10. Réinitialisation DEV

La base DEV peut être remplacée par un dump de PROD pour obtenir des données de test cohérentes.

Avant tout dump ou restore :

1. contrôler le `.env` ;
2. vérifier le serveur, le port et le nom de base ;
3. confirmer que le dump provient bien de PROD ;
4. ne jamais supposer que `DATABASE_URL` pointe au bon endroit.

Une erreur de `.env` a déjà provoqué un dump de la mauvaise base pendant le sprint.

## 11. Seed

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

Attention : lors d’une restauration d’un dump PROD, les données réelles d’entreprise doivent être présentes. Si elles manquent, le PDF peut afficher les valeurs de seed/par défaut.

## 12. Prisma — règles de prudence

- `prisma generate` : sans impact base.
- `prisma validate` : sans impact base.
- `prisma db pull` : peut réécrire le fichier Prisma.
- `prisma db push` : modifie la base.
- `prisma migrate reset` : destructif.

Sous Windows PROD, `prisma generate` peut nécessiter l’arrêt de PM2 à cause du verrouillage du moteur Prisma.

Avant toute opération structurelle, vérifier la base réellement ciblée par `DATABASE_URL`.


## Mise à jour 2026-08-15 — produits et prix

Le modèle métier distingue :

```text
produits       = état courant du produit
prix_produits  = historique des prix / fournisseur
```

Cette distinction est aussi importante pour l'application VB6 historique : son écran produits charge le dernier enregistrement de `prix_produits` par `produit_id`, trié par `date_achat DESC, id DESC`.

La création d'un produit dans FacturApp doit donc alimenter les deux structures dans une transaction Prisma. Les produits créés avant cette correction peuvent posséder leurs valeurs courantes dans `produits` sans ligne correspondante dans `prix_produits`.

Contrôle effectué : PostgreSQL PROD contient 811 produits, dont 776 avec `dernier_prix_achat_ht > 0` et 35 avec prix achat nul/NULL. MariaDB présente le même ordre de grandeur ; ces 35 cas sont considérés comme données historiques/tests à qualifier puis désactiver dans FacturApp, pas comme un défaut de synchronisation.
