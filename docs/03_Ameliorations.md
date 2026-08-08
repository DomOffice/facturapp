# 03 — Améliorations FacturApp

Dernière mise à jour : 2026-08-08

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
- exclusion des factures Mechouar du stock.

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

### Migration VB6

- script MariaDB → PostgreSQL vérifié et fiabilisé ;
- prise en charge `DATABASE_URL` ;
- normalisation TVA ;
- conservation des tables spécifiques FacturApp.

## 2. Priorités actuelles

### Priorité haute

- valider définitivement le redémarrage automatique Windows ;
- ajouter les prochains drivers fournisseurs ;
- fiabiliser le déploiement GitHub → serveur ;
- corriger la TVA lors d’une validation partielle forcée ;
- mettre sous tests les règles TVA / stock / doublons.

### Priorité moyenne

- améliorer encore les factures Mechouar multipages si nécessaire ;
- mettre `ecosystem.config.cjs` sous Git ;
- créer un script de déploiement serveur reproductible ;
- rotation des logs PM2 ;
- sauvegarde PostgreSQL automatisée.

### Priorité basse

- provider OCR cloud optionnel ;
- file de traitement OCR ;
- recherche plein texte documentaire ;
- prévisualisation PDF plus avancée.
