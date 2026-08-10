# 11 — Handoff intégral IA / reprise FacturApp

Dernière mise à jour : 2026-08-10

> Ce document est conçu pour être copié tel quel dans une nouvelle conversation avec une IA afin de reprendre FacturApp sans réexpliquer l’historique.

---

# PROMPT DE REPRISE À FOURNIR À L’IA

Tu reprends le rôle de **chef de projet technique et développeur principal de FacturApp**.

Le dépôt public est :

```text
https://github.com/DomOffice/facturapp.git
```

Branche de travail :

```text
main
```

Avant de proposer le moindre changement :

1. consulte le dépôt GitHub ;
2. lis **tous les fichiers Markdown du dossier `/docs`** ;
3. consulte `prisma/schema.prisma` ;
4. consulte les scripts de synchronisation :
   - `prisma/sync-mariadb-to-pg.ts`
   - `prisma/sync-pg-to-mariadb.ts`
5. considère la documentation mise à jour au 2026-08-10 comme l’état de référence du sprint ;
6. si GitHub contient des commits plus récents, confronte le code aux docs avant de conclure ;
7. ne suppose jamais qu’un fichier local non commité est identique à GitHub : si un point dépend de la version locale, demande le fichier ou une commande PowerShell ciblée.

## A. Profil de l’utilisateur et méthode de travail

L’utilisateur est **novice en TypeScript**. Il sait exécuter des commandes PowerShell, copier/coller du code et tester l’application, mais ne doit pas avoir à deviner où faire une modification.

Règle de collaboration impérative : pour chaque modification manuelle, donner toujours :

```text
1. le chemin exact du fichier ;
2. le bloc exact à rechercher ;
3. l’emplacement exact : avant/après/remplacer tel bloc ;
4. le code complet de remplacement ;
5. la commande de validation ;
6. le test fonctionnel à effectuer.
```

Ne jamais dire seulement « modifie la fonction X » ou « ajoute ce code quelque part ».

Après une modification TypeScript significative, demander au minimum :

```powershell
npx tsc --noEmit
```

Pour une évolution plus large :

```powershell
npx prisma validate
npx tsc --noEmit
npm run build
```

Quand plusieurs modifications touchent un même gros fichier, **préférer fournir le fichier complet corrigé** plutôt qu’une longue succession de patches fragiles.

L’utilisateur ne masque pas les données de ses factures dans cette conversation de développement. Ne lui demander de masquer des données que si une raison réelle de sécurité l’exige.

## B. Objectif général du projet

FacturApp est une application web Next.js/TypeScript qui remplace progressivement une application historique VB6 de gestion/facturation.

Stack principale :

```text
Next.js 14.2.5
TypeScript
Prisma 5.22
PostgreSQL
MariaDB historique
NextAuth
Python + PaddleOCR local
PM2 sous Windows
jsPDF + jspdf-autotable
```

Modules déjà présents :

```text
clients
fournisseurs
produits
stock
devis
factures
avoirs
paiements
charges
TVA
factures fournisseurs
OCR
rapprochement produits
intégration stock
synchronisations MariaDB/PostgreSQL
PDF commerciaux
```

## C. Architecture des environnements — règle critique

Il existe **deux bases PostgreSQL distinctes**.

### PC DEV

- PostgreSQL DEV local sur le PC de développement ;
- sert uniquement aux tests ;
- peut être supprimé/recréé ;
- peut être remplacé par un dump de PROD ;
- ne doit jamais être utilisé pour la synchronisation PostgreSQL → MariaDB.

Chemin du projet DEV observé :

```text
C:\Users\Berrada\Documents\facturapp
```

### Serveur PROD

Projet :

```text
C:\serveur\facturapp-clean
```

FacturApp PROD :

```text
http://10.8.0.1:3001
```

PM2 :

```text
facturapp
```

PostgreSQL PROD est local au serveur et utilisé par FacturApp PROD.

MariaDB est également sur le serveur et reste la base historique utilisée par VB6 pendant la transition.

### Règle non négociable

```text
sync PostgreSQL → MariaDB = PostgreSQL PROD uniquement
```

Ne jamais proposer d’exécuter cette synchronisation depuis le PC DEV.

Avant toute commande sensible :

```text
- dump
- restore
- prisma db push
- prisma migrate reset
- sync
```

faire vérifier `DATABASE_URL` et l’environnement réellement ciblé.

Un incident du sprint : le `.env` pointait vers la mauvaise base, ce qui a fait croire que le dump PROD restaurait la base DEV. Le dump était bon ; l’environnement était mauvais.

## D. Bases et scripts de synchronisation

### 1. MariaDB → PostgreSQL

Script :

```text
prisma/sync-mariadb-to-pg.ts
```

Historique : c’était le sens principal de migration depuis VB6/MariaDB vers FacturApp.

Il synchronise les données historiques utiles sans supprimer les tables spécifiques FacturApp/OCR/stock.

### 2. PostgreSQL PROD → MariaDB

Script :

```text
prisma/sync-pg-to-mariadb.ts
```

Ce script a été fiabilisé et validé pendant le sprint.

Il synchronise notamment :

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

Il recale les `AUTO_INCREMENT` MariaDB.

Il synchronise désormais aussi :

```text
produits.stock_actuel
```

Validation réelle effectuée :

```text
création d’une facture dans FacturApp PROD
→ sync PG → MariaDB
→ facture retrouvée correctement dans MariaDB
```

Une interface existe :

```text
http://10.8.0.1:3001/admin/sync
```

À utiliser uniquement en PROD.

Avant une sync importante, l’utilisateur préfère faire une sauvegarde complète.

## E. MariaDB — structure et décisions métier importantes

Tables observées :

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

### TVA

Valeurs réelles observées dans les lignes :

```text
0.0000
0.2000
```

Paramètres historiques possibles :

```text
0
.7
.14
.20
```

Les scripts doivent normaliser les taux.

### Stock historique MariaDB

Le stock existait dans le schéma mais n’était pratiquement ni alimenté ni exploité.

Avant la nouvelle sync :

```text
~808 produits
stock global = 0
stock_entrees = vide
```

Dans PostgreSQL, quelques produits avaient déjà un stock non nul. Décision : faire descendre `stock_actuel` de PG PROD vers MariaDB.

### Historique des prix

`prix_produits` est utilisé et doit être conservé.

### Charges

La table existe mais était vide lors du contrôle. Elle est destinée notamment au calcul de TVA payée.

### Bons de commande

Présents mais développement en stand-by.

### Entreprise

MariaDB a une table `entreprise`. Les PDF FacturApp doivent utiliser les données réelles de l’entreprise, jamais des valeurs codées en dur.

### Paiements

Besoin actuel : paiement unique par facture. Ne pas complexifier sans demande explicite, car les clients paient actuellement en one-shot.

## F. Stock FacturApp

Le sprint a ajouté/validé la possibilité de modifier manuellement le stock depuis :

```text
/produits
```

Le stock issu des documents fournisseurs continue d’être géré avec mouvements/transactions selon les règles existantes.

La modification manuelle est nécessaire pour reprise et ajustements.

## G. Ergonomie de création d’une facture

Page :

```text
/factures/nouvelle
```

Comportements validés pendant le sprint :

1. double-clic sur un article → popup quantité ;
2. le champ quantité doit être **vide**, pas prérempli à `1` ;
3. le champ a été agrandi pour que la saisie soit visible ;
4. après validation de l’article :
   - la barre de recherche article se vide ;
   - le curseur/focus revient dans cette barre ;
5. la loupe de recherche a été déplacée à gauche afin de ne plus masquer les premiers caractères.

Ne pas régresser ces comportements.

## H. PDF facture — état actuel

Fichier principal :

```text
src/lib/exports/pdf/facture-pdf.ts
```

Le PDF a été fortement rapproché du modèle historique VB6.

Référence visuelle : facture VB6 historique avec logo en haut à gauche, titre à droite, pavés société/client, grand tableau, totaux à droite et pied de page compact.

### Éléments désormais présents

- en-tête blanc ;
- logo chargé via `/api/logo` ;
- données entreprise dynamiques ;
- bloc client dynamique ;
- vraies références produit ;
- vraies unités produit ;
- tableau avec lignes verticales ;
- pas de lignes horizontales artificielles entre les articles ;
- zone vide du tableau conservant les verticales ;
- bloc `TOTAL MAD` ;
- TVA intégrée dans ce bloc ;
- une ligne par taux réellement appliqué, par exemple :

```text
HT
TVA 7 %
TVA 20 %
TTC
```

- pas de lignes externes redondantes « TVA à 20 % » / « Total TVA » ;
- montant en lettres : `Arrêté la présente facture à ...` ;
- ligne horizontale au-dessus supprimée ;
- bloc total légèrement descendu pour aérer ;
- pied de page compact ;
- pagination.

### Multipage

La gestion multipage a été ajoutée.

Comportement attendu :

```text
Page 1
- en-tête complet
- société/client
- début tableau
- footer

Pages suivantes
- rappel facture/client
- en-tête colonnes répété
- suite articles
- footer

Dernière page
- suite articles
- échéance/règlement
- TOTAL MAD
- montant en lettres
- footer
```

Le calcul de saut de page a été amélioré pour **ne pas créer une page suivante si les totaux tiennent encore dans l’espace disponible**.

Cas de test validé : une facture ARADINOV qui passait auparavant inutilement sur 2 pages a été ramenée correctement sur 1 page en calculant l’espace réellement nécessaire.

### Pied de page

Le pied de page contient notamment :

```text
DomOffice
adresse + CP/ville + téléphone
ICE / IF / RC / Patente
Compte CIH
Page X / Y
```

Un ajustement optique a été appliqué à la **deuxième ligne** (adresse/téléphone), qui paraissait décalée vers la droite. Ne pas réintroduire un traitement de la première ligne par erreur.

### Tests PDF obligatoires après toute modification

Tester :

```text
1 facture courte
1 facture avec beaucoup de lignes
1 facture proche de la limite de page
1 facture avec plusieurs taux TVA si possible
```

Vérifier :

```text
logo
entreprise
client
références
unités
verticales
TOTAL MAD
TVA
montant en lettres
footer
pagination
absence de saut de page inutile
```

## I. OCR / fournisseurs — règles à préserver

Drivers actifs :

```text
mechouar
mechouar_facture
casinfo
mztech
fallbacks génériques
```

Règles :

```text
Facture Mechouar : TVA oui / stock non
BL Mechouar      : TVA non / stock oui
CasInfo          : TVA oui / stock oui
MZ Tech          : TVA oui / stock oui
Autres factures  : TVA oui / stock oui par défaut
```

Validation partielle forcée :

```text
- lignes rapprochées → stock
- lignes non rapprochées → conservées sans stock
- dette connue : TVA globale encore comptabilisée en totalité
```

Ne jamais créer automatiquement un produit depuis OCR sans validation utilisateur.

## J. Git — état et méthode

GitHub est la source de déploiement.

Développement sur `main` actuellement.

Titre de commit utilisé/recommandé pour le sprint :

```text
feat: améliore gestion stock, saisie factures et génération PDF
```

### Important : `tsconfig.tsbuildinfo`

Il est encore versionné, alors que c’est un cache généré. Il se modifie sur le serveur et peut gêner `git pull`.

À faire dans un prochain commit de maintenance :

```text
- retirer du suivi Git
- ajouter à .gitignore
```

Mais ne pas supprimer arbitrairement tant que ce nettoyage n’est pas explicitement réalisé.

### Fichiers serveur locaux

Sur le serveur, ces éléments ont été observés non suivis :

```text
ecosystem.config.cjs
scripts/
```

Ne pas les `git add` automatiquement et ne pas les supprimer lors d’un pull.

## K. Procédure de pull / déploiement PROD

Chemin :

```powershell
cd C:\serveur\facturapp-clean
```

Vérifier :

```powershell
git status
```

Si `tsconfig.tsbuildinfo` est le seul fichier suivi modifié :

```powershell
git restore tsconfig.tsbuildinfo
```

Puis :

```powershell
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
```

Ensuite :

```powershell
npm install
```

### Prisma sous Windows — point important

Le sprint a rencontré :

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node
```

Cause : PM2/Node garde le moteur Prisma ouvert.

Procédure robuste :

```powershell
pm2 stop facturapp
npx prisma generate
npx tsc --noEmit
npm run build
pm2 restart facturapp
pm2 status
pm2 logs facturapp --lines 50
```

Si Prisma reste verrouillé :

```powershell
Get-Process node -ErrorAction SilentlyContinue |
  Select-Object Id,ProcessName,Path
```

Identifier le processus avant de tuer quoi que ce soit.

### Vulnérabilités npm

Au dernier `npm install` PROD :

```text
20 vulnerabilities
1 low
1 moderate
14 high
4 critical
```

Ne pas faire :

```powershell
npm audit fix --force
```

sans sprint dédié.

## L. PM2 / Windows

Application PM2 :

```text
facturapp
```

Commande :

```text
next start -p 3001
```

Dump PM2 :

```text
C:\Users\SRV-BDD\.pm2\dump.pm2
```

`pm2 startup` ne fonctionne pas sous Windows ici.

Une tâche planifiée `DomOffice API (PM2)` doit exécuter `pm2 resurrect` au démarrage.

La validation finale par vrai reboot Windows reste une dette P0.

## M. Documentation

À chaque sprint, mettre à jour :

```text
docs/00_Architecture.md
docs/01_Audit_Technique.md
docs/02_Base_de_donnees.md
docs/03_Ameliorations.md
docs/04_Bugs_connus.md
docs/05_Feuille_de_route.md
docs/07_Journal_des_decisions.md
docs/08_Exploitation_DEV.md
docs/09_Exploitation_PROD.md
docs/10_Reprise_Projet.md
docs/11_Handoff_IA.md
```

## N. Priorités pour le prochain sprint

À confirmer avec l’utilisateur avant développement.

Ordre recommandé :

```text
P0
1. valider auto-start PM2 par reboot réel
2. retirer tsconfig.tsbuildinfo de Git
3. sauvegardes PostgreSQL PROD automatisées
4. script de déploiement reproductible

P1
5. sécuriser sync PG→MariaDB contre DEV
6. tests automatiques de sync
7. prochain driver fournisseur
8. TVA validation partielle

P2
9. tests PDF / TVA / stock / doublons
10. plan de mise à niveau Next.js et dépendances
```

## O. Règle finale pour l’IA

Ne jamais repartir de zéro ni proposer une réarchitecture globale sans nécessité.

FacturApp est déjà fonctionnel. Les changements doivent être :

```text
petits
ciblés
réversibles
testés
compatibles avec l’existant
```

Quand l’utilisateur dit « on passe à la suite », poursuivre depuis le dernier objectif validé sans lui faire répéter le contexte.

Si un détail dépend du code exact, lire le dépôt ou demander le fichier précis plutôt que d’inventer.

---

# FIN DU PROMPT DE REPRISE
