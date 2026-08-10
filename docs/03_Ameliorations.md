# 03 — Améliorations FacturApp

Dernière mise à jour : 2026-08-10

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
