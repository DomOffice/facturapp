# 00 — Architecture FacturApp

Dernière mise à jour : 2026-08-17

## 1. Objectif

FacturApp est l’application web Next.js / TypeScript destinée à remplacer progressivement l’application historique VB6, tout en conservant une coexistence contrôlée pendant la transition.

Architecture métier actuelle :

```text
PC DEV
  PostgreSQL DEV local, isolé
  Next.js en mode développement
        │
        └── code validé → GitHub

Serveur PROD
  PostgreSQL PROD ←→ FacturApp PROD
        │
        └── synchronisation contrôlée PROD uniquement
                ↓
             MariaDB
                ↑
               VB6
```

MariaDB/VB6 reste la base historique et la référence de reprise des anciennes données tant que la migration n’est pas définitivement clôturée. PostgreSQL PROD est la base applicative active de FacturApp en production. La synchronisation PostgreSQL → MariaDB permet désormais de répercuter les données produites dans FacturApp vers l’environnement historique.

La base PostgreSQL DEV est strictement locale au PC de développement et ne doit jamais être utilisée par les scripts de synchronisation de production.

## 2. Stack actuelle

- Next.js 14.2.5 — App Router
- TypeScript
- Prisma 5.22
- PostgreSQL
- MariaDB historique
- NextAuth
- Python + PaddleOCR local
- jsPDF + jspdf-autotable pour les exports PDF
- PM2 sous Windows pour l’exploitation serveur

## 3. Modules fonctionnels

FacturApp couvre aujourd’hui :

- clients ;
- fournisseurs ;
- produits ;
- stock manuel et mouvements de stock ;
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
- intégration stock et mouvements de stock ;
- synchronisation MariaDB → PostgreSQL ;
- synchronisation PostgreSQL PROD → MariaDB ;
- génération PDF des documents commerciaux.

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

## 7. Stock

Deux mécanismes coexistent :

1. stock issu des documents fournisseurs et tracé par les mouvements ;
2. correction manuelle depuis `/produits` pour permettre la reprise et les ajustements opérationnels.

Le stock PostgreSQL est synchronisable vers MariaDB via `stock_actuel`. Lors du sprint d’août 2026, la reprise initiale a confirmé que MariaDB contenait historiquement des stocks à zéro alors que certains stocks existaient déjà en PostgreSQL ; la synchronisation inverse a donc été étendue pour couvrir le stock.

## 8. TVA applicative

La TVA est disponible dans :

- `/factures-fournisseurs` : TVA par document fournisseur ;
- `/` : encart Situation TVA ;
- `/tva` : page de synthèse et filtres.

La TVA payée agrège :

- les factures fournisseurs assujetties ;
- les charges.

Les BL Mechouar ne génèrent pas de TVA.

Les exports PDF client ventilent désormais la TVA par taux réellement présent sur la facture et intègrent cette ventilation dans le bloc `TOTAL MAD`.

## 9. Détection des doublons fournisseurs

Un doublon est recherché par fournisseur et numéro de document normalisé sur les documents déjà validés ou intégrés au stock.

Le contrôle couvre les documents avec ou sans intégration stock.

Le forçage reste disponible pendant la phase de développement, avec avertissement explicite :

- risque de double stock pour un document stock ;
- risque de double TVA pour une facture sans stock.

## 10. Validation partielle

Par défaut, un document devant alimenter le stock ne peut pas être validé tant que toutes ses lignes ne sont pas rapprochées.

Un forçage exceptionnel permet néanmoins de valider partiellement :

- seules les lignes avec `produitId` alimentent le stock ;
- les lignes sans produit sont conservées avec `produitId = null` ;
- elles portent un statut de type `validee_sans_stock` ;
- elles ne modifient ni stock ni prix.

Limitation connue : la TVA globale du document reste actuellement comptabilisée en totalité lors d’une validation partielle forcée.

## 11. Base de données et Prisma

Le schéma PostgreSQL réel et `prisma/schema.prisma` doivent rester alignés.

Deux bases PostgreSQL existent volontairement :

- **DEV** : locale au PC de développement, jetable, dédiée aux tests ;
- **PROD** : locale au serveur de production, utilisée par FacturApp PROD et par les synchronisations vers MariaDB.

Avant toute commande Prisma ou tout dump/restore, contrôler le `DATABASE_URL` réellement chargé. Une erreur de `.env` a déjà conduit à dumper/restaurer la mauvaise base pendant ce sprint.

Commandes à distinguer :

- `npx prisma generate` : régénère le client, ne modifie pas la base ;
- `npx prisma validate` : valide le schéma ;
- `npx prisma db push` : modifie réellement la base ;
- `npx prisma db pull` : réécrit potentiellement `schema.prisma` depuis la base.

Toute opération destructive doit être volontaire et assumée.

## 12. Synchronisations MariaDB / PostgreSQL

### MariaDB → PostgreSQL

Script :

```text
prisma/sync-mariadb-to-pg.ts
```

Utilisé pour la reprise/migration des données historiques.

### PostgreSQL PROD → MariaDB

Script :

```text
prisma/sync-pg-to-mariadb.ts
```

Règle impérative : **ce script ne doit être exécuté qu’entre PostgreSQL PROD et MariaDB**. La base PostgreSQL DEV doit rester isolée.

Le script synchronise notamment :

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

Il recale aussi les `AUTO_INCREMENT` MariaDB et prend en charge `stock_actuel` sur les produits.

La synchronisation PostgreSQL → MariaDB a été validée en production par création d’une facture dans FacturApp puis contrôle de son apparition dans MariaDB.

Une interface d’administration est disponible :

```text
/admin/sync
```

Elle doit être utilisée uniquement sur l’instance PROD, après sauvegarde lorsque l’opération est sensible.

## 13. Paiements, entreprise, charges et commandes fournisseurs

- Paiements : le besoin actuel reste un paiement unique par facture ; la clientèle paie en pratique en une seule fois.
- Entreprise : MariaDB possède désormais une table `entreprise`; les données société sont reprises dynamiquement dans les PDF FacturApp.
- Charges : la table existe mais reste actuellement non alimentée dans l’historique observé ; elle est prévue pour la TVA payée.
- Bons de commande fournisseurs : développement en attente.

## 14. Génération PDF factures

Le générateur principal est :

```text
src/lib/exports/pdf/facture-pdf.ts
```

Le sprint d’août 2026 a rapproché fortement le rendu FacturApp du modèle historique VB6 :

- en-tête blanc ;
- logo via `/api/logo` ;
- société et client dans des pavés ;
- vraies références et unités produit ;
- colonnes et verticales de tableau ;
- pas de lignes horizontales artificielles entre articles ;
- bloc `TOTAL MAD` avec ventilation automatique par taux de TVA ;
- montant en lettres ;
- pied de page compact ;
- gestion multipage ;
- répétition de l’en-tête du tableau ;
- rappel facture/client sur pages suivantes ;
- pagination `Page X / Y` ;
- saut de page des totaux uniquement lorsque l’espace restant est réellement insuffisant.

## 15. Déploiement Windows actuel

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

Sous Windows, `npx prisma generate` peut échouer avec `EPERM` si PM2/Node garde `query_engine-windows.dll.node` ouvert. Dans ce cas, arrêter `facturapp` avec PM2, régénérer Prisma, construire, puis redémarrer.



## Mise à jour 2026-08-15 — facturation, produits et OCR PROD

### Création de produits depuis une facture

La page `/factures/nouvelle` permet désormais de créer un produit sans quitter la facture en cours. Le formulaire existant `ProduitForm` est réutilisé dans une fenêtre modale. Quand la création part d'une recherche sans résultat, le texte recherché préremplit la description du nouveau produit. Après création, le catalogue est rechargé et le produit peut être ajouté immédiatement à la facture.

La page de modification `/factures/[id]/modifier` utilise le même composant client et fournit donc également les listes Type / Unité / TVA / Fournisseur nécessaires à cette création embarquée.

### Historisation initiale des prix produit

La création d'un produit via l'API doit créer dans une même transaction Prisma :

```text
produits
+
prix_produits (première ligne d'historique)
```

Cette règle est importante pour la compatibilité VB6 : l'ancien écran VB6 lit le dernier prix d'un produit dans `prix_produits`, et non uniquement les champs courants de `produits`.

### OCR en production

Le script OCR versionné est :

```text
ocr/ocr_document.py
```

Le chemin API a été corrigé de `ocr-service/ocr_document.py` vers `ocr/ocr_document.py`.

En PROD, Python 3.12.10 est installé sous le profil `SRV-BDD`. PaddleOCR / PaddlePaddle et PyMuPDF sont requis. Pour contourner une incompatibilité PaddlePaddle/oneDNN/PIR observée sur le serveur CPU, le script utilise actuellement :

```python
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
```

et initialise PaddleOCR avec `enable_mkldnn=False`.

Le serveur possède un Intel Core i5-7500, 4 cœurs / 4 threads. `cpu_threads=4` est donc conservé.

## Mise à jour 2026-08-17 — ergonomie commerciale et dashboard

Évolutions applicatives récentes, sans modification de schéma PostgreSQL :

- `/factures/nouvelle` : total des articles, affichage achat TTC par ligne, colonne marge, alerte visuelle de marge, gestion d'un produit déjà présent (ajouter quantité / remplacer quantité / annuler) ;
- `/factures` : recherche transversale d'un article dans les lignes de factures, avec accès direct à la facture et affinage secondaire par client / numéro de facture ;
- `/paiements` : totaux recalculés selon les clients sélectionnés puis selon les factures cochées, toutes cochées par défaut ; fermeture du sélecteur clients par `ESC`, effacement de la recherche client et remontée vers la zone de saisie lors de la sélection d'une facture ;
- `/` : enrichissement des KPI avec brouillons, CA TTC incluant les brouillons et filtre global de période ; bouton `Cette année` ajouté.

Le calcul de la **marge HT théorique du dashboard reste en cours de correction/validation**. Ne pas considérer sa valeur actuelle comme fiable tant que le correctif n'a pas été testé sur des factures dont le prix d'achat est connu.
