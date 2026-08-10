# 07 — Journal des décisions FacturApp

Dernière mise à jour : 2026-08-10

## 2026-06 / 2026-07 — Principes OCR conservés

- PaddleOCR local comme moteur actuel.
- Architecture compatible avec un provider cloud futur.
- ArticleBuilder générique.
- Drivers fournisseurs simples.
- Fallbacks conservés.
- Validation humaine avant création métier.
- Aucune création automatique de produit.
- La TVA OCR ne remplace pas automatiquement la TVA d’un produit existant.

## 2026-07 — Validation et stock atomiques

La persistance des lignes, les associations, la mise à jour du stock et les mouvements sont regroupés dans une transaction Prisma.

Objectif : tout réussir ou ne rien conserver.

## 2026-08 — Règles TVA / stock par type de document

### Facture Mechouar

- TVA : oui ;
- stock : non ;
- rapprochement facultatif ;
- statut final : `valide`.

### BL Mechouar

- TVA : non ;
- stock : oui ;
- rapprochement normalement obligatoire ;
- statut final : `stock_integre`.

### CasInfo / MZ Tech / autres factures fournisseurs

- TVA : oui ;
- stock : oui ;
- rapprochement normalement obligatoire ;
- statut final : `stock_integre`.

## 2026-08 — Forçage de validation partielle

Décision : autoriser exceptionnellement la validation malgré des lignes non rapprochées.

Conséquence : seules les lignes rapprochées alimentent le stock. Les autres restent conservées sans mouvement stock.

Dette acceptée : la TVA globale reste actuellement comptabilisée en totalité.

## 2026-08 — Doublons documentaires

La détection ne dépend plus seulement de `IntegrationStock`.

Un document déjà `valide` ou `stock_integre` portant le même numéro normalisé chez le même fournisseur est considéré comme doublon potentiel.

Le forçage reste disponible pendant les tests.

## 2026-08 — Factures Mechouar

Pour les factures Mechouar, HT / TVA / TTC sont prioritaires. Le détail des lignes n’est pas déterminant pour le stock, car celui-ci provient des BL.

Si HT et TTC sont fiables mais la TVA globale est mal lue, le profil `mechouar_facture` peut recalculer :

```text
TVA = TTC - HT
```

## 2026-08 — Deux bases PostgreSQL séparées

Décision :

- PostgreSQL DEV reste local au PC de développement ;
- PostgreSQL PROD reste local au serveur ;
- les deux bases peuvent porter le même nom logique mais ne doivent jamais être confondues ;
- le `.env` et `DATABASE_URL` doivent être contrôlés avant dump, restore ou Prisma destructif.

La base DEV peut être remplacée par un dump de PROD pour les tests.

## 2026-08 — Synchronisation bidirectionnelle contrôlée

MariaDB reste la base historique de référence pendant la transition, mais FacturApp PROD doit pouvoir répercuter ses nouvelles données vers MariaDB.

Deux scripts sont donc conservés :

```text
prisma/sync-mariadb-to-pg.ts
prisma/sync-pg-to-mariadb.ts
```

Règle non négociable : `sync-pg-to-mariadb.ts` utilise uniquement PostgreSQL PROD.

La synchronisation inverse a été validée par création d’une facture dans FacturApp puis contrôle dans MariaDB.

## 2026-08 — Reprise du stock MariaDB

Le stock MariaDB historique était très largement à zéro et la table `stock_entrees` n’était pas exploitée. Décision : commencer à alimenter `produits.stock_actuel` depuis PostgreSQL PROD lors de la synchronisation inverse.

Le stock peut aussi être corrigé manuellement dans `/produits` côté FacturApp.

## 2026-08 — Paiements

Décision : ne pas complexifier le modèle pour les paiements fractionnés tant que le besoin réel reste un paiement unique par facture.

## 2026-08 — Entreprise

Les données entreprise ne doivent plus être codées en dur dans les exports. Elles sont lues depuis la base et transmises au générateur PDF.

## 2026-08 — PDF facture

Décision : conserver la génération jsPDF actuelle mais rapprocher fortement la présentation du document historique VB6.

Principes retenus :

- données société/client dynamiques ;
- vraies références et unités ;
- tableau lisible sans quadrillage horizontal entre articles ;
- totaux et TVA regroupés ;
- ventilation automatique des taux TVA ;
- pied de page compact ;
- gestion multipage ;
- pas de saut de page si la zone de clôture tient encore dans l’espace disponible.

## 2026-08 — Exploitation Windows

PM2 reste utilisé sous Windows.

Lors d’un `prisma generate`, si Windows verrouille `query_engine-windows.dll.node`, arrêter d’abord l’application PM2, puis générer, compiler et redémarrer.

`tsconfig.tsbuildinfo` doit à terme être retiré de Git.
