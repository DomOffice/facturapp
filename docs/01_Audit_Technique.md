# 01 — Audit technique FacturApp

Dernière mise à jour : 2026-08-17

## 1. État général

FacturApp dispose d’un socle fonctionnel cohérent couvrant la gestion commerciale, la TVA, les imports fournisseurs, l’OCR, le rapprochement produit, le stock, la synchronisation bidirectionnelle contrôlée avec MariaDB et une génération PDF désormais proche du document VB6 historique.

Le principal risque n’est plus l’absence de fonctionnalités, mais la maîtrise de l’exploitation et des frontières d’environnement : séparation DEV/PROD, cohérence Prisma/PostgreSQL, déploiement Windows, maintien des règles métier et absence de synchronisation accidentelle depuis la base DEV.

## 2. Points solides

- Next.js / TypeScript / Prisma bien séparés du moteur OCR Python.
- Drivers fournisseurs indépendants.
- Fallbacks OCR conservés.
- Validation humaine avant impact métier.
- Contrôle serveur des règles TVA / stock.
- Intégration stock transactionnelle.
- Stock modifiable manuellement depuis `/produits`.
- Détection de doublons sur les documents fournisseurs.
- Page `/tva` dédiée.
- Synchronisation MariaDB → PostgreSQL fiabilisée.
- Synchronisation PostgreSQL PROD → MariaDB validée.
- Isolation explicite de PostgreSQL DEV.
- PDF facture fortement rapproché du modèle VB6 et compatible multipage.
- Déploiement serveur reconstruit proprement depuis GitHub.

## 3. Points de vigilance

### DEV / PROD

Deux PostgreSQL distincts existent. `DATABASE_URL` doit toujours être contrôlé avant dump, restore, Prisma structurel ou synchronisation. La base DEV ne doit jamais être utilisée pour la synchronisation PostgreSQL → MariaDB.

### Prisma / PostgreSQL

`prisma generate` ne met pas à jour PostgreSQL. Lors d’un déploiement comportant une évolution du schéma, vérifier explicitement la structure de la base avant redémarrage de l’application.

Sous Windows, `prisma generate` peut échouer par `EPERM` si le moteur Prisma est verrouillé par le processus PM2. Procédure : `pm2 stop facturapp`, `npx prisma generate`, build, puis `pm2 restart facturapp`.

### PM2 Windows

`pm2 startup` ne fonctionne pas sous Windows dans cette installation (`Init system not found`). Le redémarrage automatique repose sur une tâche planifiée Windows exécutant `pm2 resurrect`.

Cette tâche doit encore être validée par un vrai redémarrage Windows.

### Dépendances

Au dernier déploiement, `npm install` a signalé 20 vulnérabilités : 1 faible, 1 modérée, 14 élevées et 4 critiques. Ne pas lancer `npm audit fix --force` sur la branche stable. Prévoir une mise à niveau contrôlée et testée.

### Git

`tsconfig.tsbuildinfo` a été versionné alors qu’il s’agit d’un cache généré. Il provoque des modifications locales sur le serveur. À nettoyer lors d’un sprint dédié : retrait du suivi et ajout au `.gitignore`.

Le dossier `scripts/` du serveur est volontairement non suivi. `ecosystem.config.cjs` est également non suivi pour le moment.

### OCR

Les factures Mechouar multipages peuvent encore retomber sur un fallback pour le détail des lignes. Ce comportement est accepté lorsque HT / TVA / TTC sont fiables, car le stock Mechouar provient des BL.

### PDF

Le PDF facture est fonctionnel en monopage et multipage. Les ajustements de présentation restent à considérer comme une zone sensible : toute modification doit être vérifiée sur une facture courte et une facture longue.

## 4. Dette technique prioritaire

1. Validation complète du redémarrage automatique Windows.
2. Retirer `tsconfig.tsbuildinfo` du versionnement.
3. Mettre `ecosystem.config.cjs` sous contrôle Git après nettoyage des détails machine.
4. Ajouter une procédure/script de déploiement serveur reproductible.
5. Mettre à niveau Next.js et les dépendances après campagne de non-régression.
6. Ajouter des tests automatisés sur les règles TVA / stock / doublons / synchronisation.
7. Revoir la TVA lors des validations partielles forcées.
8. Ajouter une sauvegarde PostgreSQL PROD automatisée et testée.

## 5. Sécurité / exploitation

- `.env` ne doit jamais être commité.
- Les chemins de stockage et secrets restent dans l’environnement serveur.
- Les documents fournisseurs ne doivent pas être placés dans `public/`.
- Les commandes Prisma destructives ne doivent être utilisées que lorsque la base ciblée et la perte de données sont explicitement acceptées.
- La synchronisation PostgreSQL → MariaDB doit refuser ou éviter toute exécution accidentelle sur DEV.
- Avant synchronisation sensible, faire une sauvegarde de MariaDB et/ou PostgreSQL selon le sens de l’opération.

## 6. Conclusion

Le sprint d’août 2026 ferme une étape importante : stock exploitable, synchronisation inverse validée, ergonomie de création de facture améliorée et PDF client largement stabilisé. La prochaine phase peut reprendre sur les fonctionnalités métier restantes, mais la priorité transversale reste l’industrialisation de l’exploitation et des tests.


## Mise à jour audit — 2026-08-15

### Facturation

Améliorations validées sur `/factures/nouvelle` :

- création rapide d'un produit dans une modale sans perdre la facture en cours ;
- préremplissage de la description avec le texte recherché lorsque le catalogue ne retourne rien ;
- quantité `0` sur une ligne existante = proposition de suppression avec confirmation ;
- colonnes des deux tableaux Articles redimensionnables ;
- scrollbar horizontale du catalogue rendue plus maniable ;
- option `Afficher prix achat` étendue au catalogue avec PA HT / PA TTC ;
- le tri du catalogue n'a volontairement pas été modifié : une correction de conception Référence / Type est reportée à un sprint ultérieur.

### Produits / historique de prix

La cause d'un défaut apparent de synchronisation vers VB6 a été identifiée : VB6 récupère PA, PV, marge et date depuis la dernière ligne de `prix_produits`. Les produits créés auparavant dans FacturApp pouvaient ne pas avoir de ligne d'historique. La création produit a donc été corrigée pour créer la première ligne `prix_produits` transactionnellement.

Les produits 811 et 812 ont été identifiés comme cas historiques à rattraper de façon ciblée, sans migration massive aveugle.

### OCR PROD

L'OCR a été exécuté pour la première fois sur le serveur. Incidents résolus successivement : Python absent/alias Microsoft Store, chemin `ocr-service` incorrect, PyMuPDF absent, PaddleOCR absent. Une incompatibilité PaddlePaddle/oneDNN/PIR a nécessité la désactivation de PIR/MKLDNN.

La performance CPU reste un point de vigilance : sur un PDF de test, l'inférence PaddleOCR est passée d'environ 80 s à 55 s avec `MAX_SIDE=2200`, et à 48,5 s avec `MAX_SIDE=2000`. La qualité OCR doit primer sur le gain marginal de temps.

## Mise à jour audit — 2026-08-17

### Facturation et recherche

Les écrans de facturation ont gagné plusieurs fonctions utiles sans changement de modèle : prévention des doublons de produit dans une même facture, comparaison vente/achat par ligne, recherche historique d'un article dans toutes les factures et affinage par client.

### Paiements

Le calcul des totaux est désormais interactif : sélection client puis sélection fine des factures. Le comportement attendu est que toutes les lignes visibles soient cochées par défaut et que les totaux reflètent uniquement les lignes cochées.

### Dashboard

Le dashboard intègre désormais les brouillons et un filtre de période global. Le point restant à sécuriser est la **marge HT théorique** : certaines factures historiques peuvent avoir `totalAchatHt` ou `prixAchatHt` à zéro/non renseigné, ce qui peut faire apparaître une marge égale au total HT. Ce point est un bug actif à corriger avant de considérer le KPI fiable.

### Source de vérité du code pendant les interventions IA

Règle renforcée : avant toute modification, travailler sur le fichier réellement courant. Si l'utilisateur fournit le fichier, ce fichier prévaut. Sinon vérifier le dépôt GitHub à jour. Ne pas reconstruire un fichier complet à partir d'une version supposée ou ancienne.
