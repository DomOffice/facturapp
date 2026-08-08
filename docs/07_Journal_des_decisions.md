# 07 — Journal des décisions FacturApp

Dernière mise à jour : 2026-08-08

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

## 2026-08 — Migration VB6

MariaDB reste la source de réimport historique.

Le script de synchronisation ne doit pas remplir les tables propres à FacturApp.

Les taux TVA historiques sont normalisés pour accepter `0.20` ou `20` comme représentation de 20 %.

## 2026-08 — Base PostgreSQL de test reconstructible

Pendant la phase actuelle, les données PostgreSQL peuvent être supprimées si nécessaire, car elles peuvent être réimportées depuis VB6 et le seed recrée l’administrateur / paramètres.

Cette liberté ne s’appliquera plus lorsque FacturApp deviendra la base métier principale.

## 2026-08 — Exploitation Windows

PM2 est utilisé sous Windows mais `pm2 startup` n’est pas disponible dans cet environnement.

Le redémarrage automatique doit donc passer par le Planificateur de tâches Windows avec `pm2 resurrect` et un `pm2 save` à jour.
