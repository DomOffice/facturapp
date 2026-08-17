# 03 — Améliorations FacturApp

Dernière mise à jour : 2026-08-17

## 1. Fonctionnalités désormais terminées

### OCR fournisseurs

- upload PDF / JPG / PNG ;
- PaddleOCR local ;
- extraction fournisseur, numéro, date, ICE, HT, TVA, TTC ;
- extraction des lignes articles ;
- ArticleBuilder ;
- confiance par ligne ;
- diagnostic OCR ;
- qualité A/B/C/D ;
- fallback générique / texte / séquentiel ;
- édition manuelle des lignes.

### Drivers

- Mechouar BL ;
- Mechouar facture ;
- CasInfo ;
- MZ Tech ;
- profils génériques.

### Rapprochement produits

- recherche automatique ;
- recherche manuelle ;
- score de pertinence ;
- association fournisseur-produit ;
- mémorisation des choix ;
- création volontaire des produits absents ;
- blocage de validation si des lignes restent non rapprochées ;
- forçage exceptionnel de validation partielle.

### Stock

- intégration transactionnelle ;
- mouvements de stock ;
- protection contre la double intégration ;
- mise à jour contrôlée du prix d’achat ;
- exclusion des factures Mechouar du stock ;
- modification manuelle du stock depuis `/produits` ;
- synchronisation de `stock_actuel` PostgreSQL PROD → MariaDB.

### Ergonomie création de facture

Dans `/factures/nouvelle` :

- quantité non préremplie à `1` lors du double-clic article ;
- champ de quantité agrandi ;
- après validation de la ligne, recherche article vidée ;
- focus replacé dans la barre de recherche ;
- loupe déplacée à gauche pour ne plus masquer la saisie.

### PDF facture

Le générateur `src/lib/exports/pdf/facture-pdf.ts` a été largement refondu :

- rapprochement visuel du modèle VB6 ;
- données entreprise dynamiques ;
- logo via `/api/logo` ;
- référence produit réelle au lieu de l’ordre de ligne ;
- unité réelle ;
- tableau avec séparations verticales et sans lignes horizontales artificielles entre articles ;
- prolongement visuel du tableau ;
- bloc `TOTAL MAD` ;
- ventilation TVA automatique par taux réellement présent ;
- montant en lettres ;
- pied de page compact ;
- gestion multipage ;
- en-tête du tableau répété ;
- rappel facture/client sur pages suivantes ;
- pagination ;
- décision de saut de page basée sur l’espace réellement nécessaire pour les totaux.

### TVA

- colonne TVA dans `/factures-fournisseurs` ;
- dashboard TVA corrigé ;
- page `/tva` finalisée ;
- filtres dates / client / fournisseur ;
- distinction TVA perçue / TVA payée ;
- intégration TVA des charges ;
- exclusion des BL Mechouar ;
- inclusion des factures Mechouar.

### Doublons

- détection sur CasInfo ;
- Mechouar BL ;
- Mechouar facture ;
- MZ Tech ;
- forçage possible avec avertissement.

### Synchronisations historiques

- script MariaDB → PostgreSQL fiabilisé ;
- script PostgreSQL PROD → MariaDB validé ;
- normalisation TVA ;
- entreprise et paramètres synchronisés ;
- stock produit pris en charge ;
- recalage des `AUTO_INCREMENT` MariaDB ;
- interface `/admin/sync` utilisable en production.

### Environnements

- séparation explicite PostgreSQL DEV / PostgreSQL PROD ;
- DEV local uniquement ;
- sync inverse interdite depuis DEV ;
- procédure de copie PROD → DEV clarifiée.

## 2. Priorités actuelles

### Priorité haute

- valider définitivement le redémarrage automatique Windows ;
- retirer `tsconfig.tsbuildinfo` du suivi Git ;
- ajouter les prochains drivers fournisseurs ;
- fiabiliser encore le déploiement GitHub → serveur ;
- corriger la TVA lors d’une validation partielle forcée ;
- mettre sous tests les règles TVA / stock / doublons / synchronisations.

### Priorité moyenne

- mettre `ecosystem.config.cjs` sous Git après nettoyage ;
- créer un script de déploiement serveur reproductible ;
- rotation des logs PM2 ;
- sauvegarde PostgreSQL automatisée ;
- automatiser ou sécuriser davantage les sauvegardes avant synchronisation ;
- stabiliser définitivement le logo PDF selon l’environnement.

### Priorité basse

- provider OCR cloud optionnel ;
- file de traitement OCR ;
- recherche plein texte documentaire ;
- prévisualisation PDF plus avancée.


## Ajouts validés — 2026-08-15

### Création / modification facture

- création d'un article directement depuis `/factures/nouvelle`, via popup réutilisant `ProduitForm` ;
- conservation intégrale de la facture en cours pendant la création ;
- description préremplie par la recherche si aucun article n'est trouvé ;
- quantité `0` sur une ligne existante : confirmation puis suppression ;
- colonnes des tableaux Articles redimensionnables ;
- barre de défilement horizontale du catalogue épaissie ;
- `Afficher prix achat` affiche désormais aussi PA HT / PA TTC dans le catalogue.

### Produits

- création du produit et de sa première ligne `prix_produits` dans une transaction ;
- compatibilité améliorée avec la lecture historique VB6 des prix.

### Administration

- ajout prévu/implémenté d'un accès `/admin/sync` dans la navigation Administration ;
- barre d'activité de synchronisation recommandée sans faux pourcentage tant que l'API ne publie pas une progression réelle.

### OCR PROD

- installation Python 3.12.10 sur le serveur ;
- chemin OCR corrigé vers `ocr/ocr_document.py` ;
- dépendances Python installées ;
- OCR local opérationnel sur serveur CPU ;
- instrumentation de chronométrage ajoutée au script serveur pour mesurer initialisation, temps par page et temps total ;
- essais de réduction de `MAX_SIDE` effectués pour accélérer l'inférence.

## Ajouts validés — 2026-08-16 / 2026-08-17

### `/factures/nouvelle`

- ajout de `Total articles` à côté de `Total lignes` ;
- affichage du montant **Achat TTC de ligne** lorsque `Afficher prix achat` est activé ;
- ajout d'une colonne **Marge** après Achat TTC ;
- couleur de marge utilisée comme alerte : marge confortable en vert, marge faible en orange, marge négative en rouge ;
- séparation visuelle de la colonne Marge et de la croix de suppression ;
- scrollbar horizontale épaissie à environ 14 px ;
- lorsqu'un produit déjà présent est ajouté une seconde fois, choix explicite :
  - ajouter la nouvelle quantité à l'existante ;
  - remplacer la quantité existante ;
  - annuler ;
- retour depuis une facture vers `/factures` avec rafraîchissement de la liste afin d'éviter un F5 manuel.

### `/factures`

- nouvelle recherche transversale **par article facturé** ;
- recherche multi-fragments de type « Google » : les fragments peuvent être saisis dans un ordre libre ;
- résultats avec facture, date, client, référence, désignation, quantité, prix, remise, TTC et statut ;
- clic sur le numéro pour ouvrir la facture ;
- combinaison des deux recherches existantes : rechercher d'abord l'article, puis affiner avec la barre client / numéro de facture.

### `/paiements`

- les totaux de l'encart supérieur suivent les clients sélectionnés ;
- ajout d'une case à cocher par facture ;
- toutes les factures visibles sont cochées par défaut ;
- les totaux HT/TTC ne prennent en compte que les factures cochées ;
- case d'en-tête pour tout sélectionner / désélectionner ;
- `ESC` ferme le volet de sélection des clients et vide le champ de recherche sans perdre les clients cochés ;
- clic sur une facture : remontée automatique en haut de page pour afficher l'encart de saisie.

### Dashboard `/`

- nombre de brouillons affiché dans la carte Factures ;
- CA TTC principal conservé pour les factures validées ;
- information complémentaire CA TTC avec brouillons ;
- filtre global `Date début / Date fin` ;
- raccourcis `Ce mois` et `Cette année` ;
- liste des dernières factures filtrée par période.

**À finaliser :** calcul et validation de la `Marge HT théorique`. Le KPI est présent mais sa formule/donnée d'achat n'est pas encore considérée fiable.
