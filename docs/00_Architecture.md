# 00 — Architecture FacturApp

Dernière mise à jour : 2026-08-08

## 1. Objectif

FacturApp est l’application web Next.js / TypeScript destinée à remplacer progressivement l’application historique VB6.

Architecture métier actuelle :

```text
VB6
 ↓
MariaDB
 ↓  synchronisation contrôlée
PostgreSQL
 ↓
FacturApp
```

MariaDB reste la source historique. PostgreSQL est la base applicative de FacturApp et contient aussi les tables propres au nouveau fonctionnement web : OCR, documents importés, rapprochements fournisseurs, intégrations et mouvements de stock.

## 2. Stack actuelle

- Next.js 14.2.5 — App Router
- TypeScript
- Prisma 5.22
- PostgreSQL
- NextAuth
- Python + PaddleOCR local
- PM2 sous Windows pour l’exploitation serveur

## 3. Modules fonctionnels

FacturApp couvre aujourd’hui :

- clients ;
- fournisseurs ;
- produits ;
- devis ;
- factures ;
- avoirs ;
- paiements ;
- charges ;
- TVA ;
- factures fournisseurs ;
- import documentaire fournisseur ;
- OCR et extraction structurée ;
- rapprochement fournisseur → produit ;
- intégration stock et mouvements de stock.

## 4. Architecture des documents fournisseurs

Pipeline actuel :

```text
Upload document
 ↓
DocumentImporte
 ↓
OCR PaddleOCR
 ↓
Extraction structurée
 ↓
Driver fournisseur
 ↓
Lignes OCR éditables
 ↓
Rapprochement produits
 ↓
Validation métier
 ↓
LigneImportee
 ↓
Association fournisseur-produit
 ↓
Intégration éventuelle au stock
 ↓
MouvementStock
```

L’OCR ne doit jamais être considéré comme la source de vérité métier. Il prépare des données qui restent contrôlables et éditables avant validation.

## 5. Drivers OCR actifs

Drivers actuellement validés :

- `mechouar` : bons de livraison Mechouar ;
- `mechouar_facture` : factures Mechouar ;
- `casinfo` : factures CasInfo ;
- `mztech` : factures MZ Tech ;
- profils génériques de fallback.

Le moteur conserve plusieurs stratégies :

```text
profil
 ↓
fallback générique
 ↓
fallback texte
 ↓
fallback tableau séquentiel
```

Les drivers doivent rester simples : alias, paramètres de colonnes, motifs, corrections et règles documentaires. La logique métier ne doit pas être dispersée dans les drivers.

## 6. Règles TVA / stock des documents fournisseurs

| Document | TVA | Stock | Rapprochement | Mise à jour prix | Statut final attendu |
|---|---:|---:|---:|---:|---|
| Facture Mechouar | Oui | Non | Facultatif | Non | `valide` |
| BL Mechouar | Non | Oui | Obligatoire sauf forçage | Oui | `stock_integre` |
| Facture CasInfo | Oui | Oui | Obligatoire sauf forçage | Oui | `stock_integre` |
| Facture MZ Tech | Oui | Oui | Obligatoire sauf forçage | Oui | `stock_integre` |
| Autres factures fournisseurs | Oui | Oui par défaut | Obligatoire sauf règle spécifique | Oui | `stock_integre` |

Ces règles doivent être sécurisées côté serveur. L’API ne doit pas faire confiance uniquement aux drapeaux envoyés par l’interface.

## 7. TVA applicative

La TVA est désormais disponible dans :

- `/factures-fournisseurs` : TVA par document fournisseur ;
- `/` : encart Situation TVA ;
- `/tva` : page de synthèse et filtres.

La TVA payée agrège :

- les factures fournisseurs assujetties ;
- les charges.

Les BL Mechouar ne génèrent pas de TVA.

## 8. Détection des doublons fournisseurs

Un doublon est recherché par fournisseur et numéro de document normalisé sur les documents déjà validés ou intégrés au stock.

Le contrôle couvre les documents avec ou sans intégration stock.

Le forçage reste disponible pendant la phase de développement, avec avertissement explicite :

- risque de double stock pour un document stock ;
- risque de double TVA pour une facture sans stock.

## 9. Validation partielle

Par défaut, un document devant alimenter le stock ne peut pas être validé tant que toutes ses lignes ne sont pas rapprochées.

Un forçage exceptionnel permet néanmoins de valider partiellement :

- seules les lignes avec `produitId` alimentent le stock ;
- les lignes sans produit sont conservées avec `produitId = null` ;
- elles portent un statut de type `validee_sans_stock` ;
- elles ne modifient ni stock ni prix.

Limitation connue : la TVA globale du document reste actuellement comptabilisée en totalité lors d’une validation partielle forcée.

## 10. Base de données et Prisma

Le schéma PostgreSQL réel et `prisma/schema.prisma` doivent rester alignés.

La base historique n’a pas été initialement créée avec Prisma Migrate. Pendant la phase actuelle de test, la base PostgreSQL peut être reconstruite depuis `schema.prisma` si les données sont jetables et réimportables depuis VB6.

Commandes à distinguer :

- `npx prisma generate` : régénère le client, ne modifie pas la base ;
- `npx prisma validate` : valide le schéma ;
- `npx prisma db push` : modifie réellement la base ;
- `npx prisma db pull` : réécrit potentiellement `schema.prisma` depuis la base.

Toute opération destructive doit être volontaire et assumée.

## 11. Synchronisation VB6 / MariaDB → PostgreSQL

Script principal :

```text
prisma/sync-mariadb-to-pg.ts
```

Le script synchronise les données historiques utiles :

```text
clients
fournisseurs
produits
factures
facture_lignes
paiements
devis
devis_lignes
avoirs
avoir_lignes
```

Il ne doit pas remplir ni supprimer les tables propres au nouveau fonctionnement FacturApp :

```text
documents_importes
lignes_importees
integrations_stock
mouvements_stock
associations fournisseur-produit
```

La conversion TVA est normalisée pour accepter les deux représentations historiques possibles : `0.20` ou `20` pour 20 %.

## 12. Déploiement Windows actuel

Installation active :

```text
C:\serveur\facturapp-clean
```

Application de production :

```text
http://10.8.0.1:3001
```

PM2 lance Next.js en production depuis :

```text
node_modules\next\dist\bin\next start -p 3001
```

La liste PM2 est sauvegardée dans :

```text
C:\Users\SRV-BDD\.pm2\dump.pm2
```

Une tâche planifiée Windows nommée `DomOffice API (PM2)` doit exécuter `pm2 resurrect` au démarrage du serveur. Sa configuration reste à valider complètement par un test de redémarrage réel.
