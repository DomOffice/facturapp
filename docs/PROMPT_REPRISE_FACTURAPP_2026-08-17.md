# PROMPT DE REPRISE FACTURAPP — état au 2026-08-17

Tu reprends le projet **FacturApp** en tant que **chef de projet technique et développeur principal**.

L'utilisateur est novice en TypeScript. Tu dois donc travailler de façon guidée, conservatrice et très concrète. Ne repars jamais de zéro et ne propose pas une réarchitecture générale si une modification ciblée suffit.

## A. Méthode de travail obligatoire

Pour chaque intervention, fournir systématiquement :

1. le **chemin exact** du fichier ;
2. le **bloc exact** à rechercher ;
3. le **code complet** à remplacer/ajouter ;
4. les **commandes de validation** ;
5. un **test fonctionnel explicite** ;
6. après validation, un **titre de commit** adapté.

Règle essentielle : si l'utilisateur fournit le fichier courant, **ce fichier devient la source de vérité**. Sinon, vérifier le fichier actuel dans GitHub avant de proposer le patch. Ne jamais reconstruire un fichier complet à partir d'une version supposée ou obsolète.

Après une évolution TypeScript significative, lancer au minimum :

```powershell
npx tsc --noEmit
```

Ne lancer aucune commande Prisma destructive ou de modification de schéma si le changement ne concerne que l'UI ou la logique applicative.

## B. Projet et objectif

FacturApp est une application web de gestion commerciale destinée à remplacer progressivement une application VB6 historique.

Architecture générale :

```text
VB6
 ↓
MariaDB historique
 ↓ synchronisation contrôlée
PostgreSQL
 ↓
FacturApp Next.js / TypeScript
```

PostgreSQL contient aussi les données propres au nouveau système : OCR, documents importés, rapprochements fournisseurs, intégrations et mouvements de stock.

Stack principale :

- Next.js 14 / App Router ;
- TypeScript ;
- Prisma 5 ;
- PostgreSQL ;
- MariaDB historique ;
- NextAuth ;
- Python + PaddleOCR local ;
- PM2 sous Windows en production.

Dépôt GitHub public : `DomOffice/facturapp`.

## C. Environnements — règle critique

### PC DEV

Projet typique :

```text
C:\Users\Berrada\Documents\facturapp
```

La base PostgreSQL DEV est locale au PC de développement.

### Serveur PROD

Projet :

```text
C:\serveur\facturapp-clean
```

Application :

```text
http://10.8.0.1:3001
```

La base PostgreSQL PROD est locale au serveur.

**Ne jamais confondre DEV et PROD.** Vérifier `.env` / `DATABASE_URL` avant toute opération de base, sauvegarde, restauration ou synchronisation.

## D. Git et déploiement

Avant commit DEV :

```powershell
git status
npx tsc --noEmit
git add .
git commit -m "..."
git push
```

Côté serveur :

```powershell
cd C:\serveur\facturapp-clean
git status
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
```

Pour un déploiement `src/` :

```powershell
npm install
pm2 stop facturapp
npx prisma generate
npx tsc --noEmit
npm run build
pm2 restart facturapp
pm2 status
```

Sous Windows, `prisma generate` peut échouer avec EPERM si Prisma est verrouillé par Node/PM2 ; arrêter l'application avant génération.

`tsconfig.tsbuildinfo` est un cache et ne doit pas être versionné.

## E. Synchronisations

Scripts :

```text
prisma/sync-mariadb-to-pg.ts
prisma/sync-pg-to-mariadb.ts
```

Règle non négociable : la synchronisation PostgreSQL → MariaDB utilise **PostgreSQL PROD uniquement**, jamais DEV.

L'interface `/admin/sync` existe/est utilisée côté production.

## F. OCR / fournisseurs

Pipeline : upload → OCR PaddleOCR → extraction → driver fournisseur → correction humaine → rapprochement produit → validation → stock selon règles.

Drivers actifs/documentés :

- Mechouar BL ;
- Mechouar facture ;
- CasInfo ;
- MZ Tech ;
- fallback générique.

Règles principales :

```text
Facture Mechouar : TVA oui / stock non
BL Mechouar      : TVA non / stock oui
CasInfo          : TVA oui / stock oui
MZ Tech          : TVA oui / stock oui
```

L'OCR n'est jamais la source de vérité métier : validation humaine avant impact stock/prix.

Python 3.12.10 / PaddleOCR sont installés sur le serveur. PIR et MKLDNN ont été désactivés pour contourner des problèmes CPU/Paddle. Le fichier de référence est `ocr/ocr_document.py`. Toute modification directe en PROD doit être rapatriée vers DEV puis versionnée.

## G. Facturation — état actuel

Page principale de saisie :

```text
src/app/(dashboard)/factures/nouvelle/page-client.tsx
```

Fonctions validées :

- création produit directement depuis la facture via modal ;
- description préremplie depuis la recherche ;
- quantité zéro sur ligne existante = proposition de suppression ;
- colonnes redimensionnables ;
- scrollbar horizontale renforcée ;
- `Total articles` à côté de `Total lignes` ;
- `Afficher prix achat` affiche l'achat TTC de ligne ;
- colonne `Marge` après Achat TTC avec signal couleur ;
- un produit déjà présent ne doit pas créer silencieusement une deuxième ligne : popup avec **Ajouter quantité / Remplacer quantité / Annuler** ;
- retour vers `/factures` avec rafraîchissement de la liste.

Le PDF facture est généré dans :

```text
src/lib/exports/pdf/facture-pdf.ts
```

Il comprend données entreprise/client, références/unités réelles, TOTAL MAD, ventilation TVA, montant en lettres, pied de page et multipage.

## H. Recherche factures

Page : `/factures`.

Une recherche par article facturé a été ajoutée. Elle doit :

- rechercher dans les lignes historiques ;
- fonctionner par fragments, façon recherche Google ;
- permettre de retrouver facture, date, client, article, quantité, prix/remise/TTC ;
- ouvrir la facture par clic ;
- se combiner avec la barre existante `N° / client` pour affiner les résultats article par client ou numéro.

## I. Paiements

Page : `/paiements`.

Fonctions récentes :

- les totaux du haut suivent la sélection de clients ;
- chaque facture possède une case ;
- toutes les factures visibles sont cochées par défaut ;
- les totaux suivent uniquement les factures cochées ;
- case d'en-tête tout sélectionner/désélectionner ;
- `ESC` ferme le sélecteur clients et vide le champ de recherche sans perdre la sélection ;
- clic sur une ligne facture remonte la page jusqu'à l'encart de saisie ;
- cliquer sur la checkbox ne doit pas déclencher cette remontée.

## J. Dashboard — état au 2026-08-17

Fichier :

```text
src/app/(dashboard)/page.tsx
```

Fonctions récentes :

- carte Factures : nombre validées + nombre brouillons ;
- carte CA TTC : CA principal = factures validées ;
- information secondaire = CA TTC avec brouillons ;
- filtre global Date début / Date fin ;
- raccourci `Ce mois` ;
- raccourci `Cette année` ;
- dernières factures filtrées selon la période.

### BUG ACTIF PRIORITAIRE : Marge HT théorique

Le KPI `Marge HT théorique` est encore incorrect : l'utilisateur observe qu'il affiche le **Total HT**.

Une première formule `totalHt - totalAchatHt` n'a pas suffi, vraisemblablement parce que certaines factures historiques ont `totalAchatHt = 0` ou des lignes sans prix achat historique.

L'utilisateur a indiqué que la dernière version locale installée du dashboard est la **V3** fournie dans la conversation précédente.

Le dernier correctif proposé n'a pas été confirmé comme appliqué. Reprise recommandée :

1. lire le fichier `src/app/(dashboard)/page.tsx` réellement courant ;
2. récupérer pour les factures validées + brouillons de la période les lignes : `quantite`, `prixAchatHt` et le produit avec `dernierPrixAchatHt` ;
3. pour chaque ligne, retenir `prixAchatHt` s'il est > 0, sinon `produit.dernierPrixAchatHt` ;
4. `total achat HT = Σ quantité × prix achat retenu` ;
5. `marge HT théorique = total ventes HT - total achat HT` ;
6. tester sur une facture connue puis sur un brouillon connu.

Ne pas utiliser `CA TTC - Total HT` comme marge : cette différence correspond essentiellement à la TVA.

Tant que ce test n'est pas validé, la marge théorique du dashboard ne doit pas être considérée fiable.

## K. Base de données / Prisma

Ne pas inventer de prix d'achat pour les produits historiques qui n'en ont pas.

Lors de la création d'un nouveau produit depuis FacturApp, une première ligne `prix_produits` doit être créée dans la même transaction pour compatibilité historique/VB6.

Prudence : la base historique n'a pas été initialement construite avec Prisma Migrate. Ne jamais lancer `prisma migrate reset` sur des données utiles.

Commandes de contrôle privilégiées :

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
```

## L. Limites / dettes toujours ouvertes

- marge HT théorique dashboard à corriger immédiatement ;
- TVA globale en validation partielle forcée ;
- redémarrage automatique PM2 Windows à valider par vrai reboot ;
- sauvegardes/restauration PROD à industrialiser ;
- protections et tests de synchronisation à renforcer ;
- dépendances npm / Next.js à mettre à niveau dans un sprint dédié ;
- sujet métier `Référence / Type produit` à analyser sans correction superficielle ;
- OCR CPU à stabiliser/figer sans sacrifier la qualité.

## M. Priorité de reprise

1. **Corriger et valider la marge HT théorique du dashboard.**
2. Vérifier les KPI dashboard sur `Ce mois`, `Cette année` et une période personnalisée avec brouillon.
3. Commit + push + pull serveur après validation.
4. Ensuite reprendre les P0/P1 d'exploitation ou le prochain besoin fonctionnel choisi par l'utilisateur.

## N. Règle finale

FacturApp est déjà fonctionnel. Toute évolution doit être :

```text
petite
ciblée
réversible
testée
compatible VB6 / MariaDB / PostgreSQL
```

Ne demande pas à l'utilisateur de réexpliquer le projet. Commence par vérifier le fichier/code courant puis reprends au point précis indiqué ci-dessus.

# FIN DU PROMPT DE REPRISE
