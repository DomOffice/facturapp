# PROMPT REPRISE FACTURAPP — 2026-09-03

## 0. Instruction de reprise

Tu reprends le projet **FacturApp** comme **chef de projet technique et développeur principal**.

L'utilisateur est novice en TypeScript. Il ne doit pas avoir à réexpliquer l'historique du projet.

### Méthode obligatoire

Pour chaque intervention de code :

1. donner le chemin exact du fichier ;
2. indiquer le bloc exact à rechercher ;
3. fournir le code complet à copier-coller ;
4. donner les commandes de validation ;
5. donner un test fonctionnel explicite ;
6. après validation, proposer un titre de commit.

Ne pas proposer de refonte générale lorsqu'un correctif ciblé suffit.

### Source de vérité des fichiers

Le dépôt public GitHub est :

```text
DomOffice/facturapp
```

Règle de travail décidée avec l'utilisateur :

- si les dernières modifications ont été commit/push, **GitHub est supposé à jour** ;
- ne demander un fichier local que si plusieurs modifications non commités se sont accumulées ou si l'utilisateur indique explicitement que GitHub n'est pas à jour ;
- si l'utilisateur fournit un fichier courant, ce fichier devient la source de vérité pour l'intervention.

## 1. Architecture générale

FacturApp remplace progressivement une application VB6 historique.

Stack principale :

```text
Next.js 14 / App Router
TypeScript
Prisma 5
PostgreSQL
MariaDB / VB6
NextAuth
Python + PaddleOCR
PM2 sous Windows PROD
```

Architecture de données actuelle :

```text
                     PostgreSQL FacturApp
                    consolidé multi-années
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
      FacturApp                         synchronisations
                                              │
                                   MariaDB annuelle / VB6
                                   erp2025
                                   erp2026
                                   erp2027
                                   erp2028...
```

PostgreSQL contient aussi toutes les données propres au nouveau système : OCR, documents fournisseurs importés, rapprochements, stock et mouvements.

## 2. Environnements

### PC DEV

Projet :

```text
C:\Users\Berrada\Documents\facturapp
```

PostgreSQL DEV est local et jetable pour les tests.

Base actuellement utilisée pour le clone PROD de test :

```text
facturapp_db
```

Attention : certaines anciennes variables/scripts peuvent encore mentionner `facturapp_dev`. Toujours vérifier le `.env` réellement chargé avant une opération de base.

### Serveur PROD

Projet documenté :

```text
C:\serveur\facturapp-clean
```

Application Next.js sur :

```text
port 3001
```

PostgreSQL PROD est local au serveur.

MariaDB est locale au serveur et utilisée par VB6.

## 3. Réseau : NetBird principal, WireGuard secours

### NetBird

PROD :

```text
100.92.8.37
```

PC DEV :

```text
100.92.240.170
```

Interface Windows :

```text
wt0
```

Tests validés depuis DEV :

```text
100.92.8.37:3001 → TCP True
100.92.8.37:3306 → TCP True
RDP NetBird       → fonctionne
```

### Problème pare-feu diagnostiqué

Sur PROD, `wt0` était classée `Public`.

Windows possédait des règles explicites `Block` Public pour :

```text
Node.js JavaScript Runtime
python.exe
Docker Desktop Backend
Visual Studio Code
```

Conséquence : FacturApp 3001 et le serveur Python de test 8088 étaient bloqués via NetBird.

Le diagnostic a été confirmé en désactivant temporairement le profil Public : 3001/8088 passaient.

Correction retenue :

```powershell
Set-NetConnectionProfile -InterfaceAlias "wt0" -NetworkCategory Private
```

Après cela, pare-feu réactivé :

```text
TCP 3001 → True
TCP 3306 → True
```

Les règles NetBird natives doivent être conservées.

### WireGuard

Ancien chemin :

```text
PROD : 10.8.0.1
```

WireGuard doit être gardé en secours pour l'instant.

Les deux réseaux peuvent cohabiter car ils utilisent des plages distinctes :

```text
NetBird   100.x.x.x
WireGuard 10.8.0.x
```

### NEXTAUTH_URL : point à contrôler

Avant la bascule NetBird, PROD contenait :

```env
NEXTAUTH_URL="http://10.8.0.1:3001"
```

Cela provoquait une redirection de :

```text
http://100.92.8.37:3001
```

vers :

```text
http://10.8.0.1:3001
```

Une modification vers NetBird a été recommandée :

```env
NEXTAUTH_URL="http://100.92.8.37:3001"
```

mais la confirmation finale n'a pas été consignée dans cette conversation.

À la reprise, **vérifier la valeur réelle sur PROD avant de la considérer acquise**.

À terme, un hostname/DNS interne stable serait préférable à une IP pour faciliter le secours WireGuard.

## 4. Facturation — fonctions acquises

FacturApp possède notamment :

- création produit depuis une facture ;
- description préremplie depuis la recherche ;
- quantité 0 = proposition de suppression ligne ;
- colonnes redimensionnables ;
- affichage prix achat ;
- marge par ligne avec couleurs ;
- gestion d'un produit déjà présent : ajouter quantité / remplacer / annuler ;
- retour vers liste avec rafraîchissement ;
- recherche facture par article puis affinage par client/numéro ;
- PDF facture avancé avec TVA, entreprise, client, références, unités, multipage.

Ne pas casser ces comportements.

## 5. Paiements — état au 2026-09-03

Fichiers :

```text
src/app/(dashboard)/paiements/page.tsx
src/app/(dashboard)/paiements/page-client.tsx
```

### Problème corrigé : factures récentes absentes

Ancienne cause :

```text
/paiements lisait prisma.paiement.findMany()
```

Une facture validée sans ligne `paiements` était donc invisible.

Le code actuel GitHub effectue un rattrapage :

```text
facture statut=validee
+
paiement absent
→ création d'une ligne de suivi paiement
```

La relation `factureId` étant unique, le rattrapage est idempotent.

### Tri colonnes

Les en-têtes permettent désormais le tri ascendant/descendant sur :

```text
N° Facture
Date
Client
Montant HT
Montant TTC
Date encaissement
Mode règlement
Numéro pièce
```

### Comportements déjà acquis à préserver

- sélection multiple clients ;
- recherche client ;
- ESC ferme le sélecteur et vide la recherche ;
- filtre Non payées seulement ;
- checkbox par facture ;
- tout sélectionner/désélectionner ;
- totaux selon les lignes cochées ;
- clic ligne facture → scroll haut vers panneau de saisie ;
- clic checkbox ne déclenche pas le scroll.

## 6. Dashboard — état au 2026-09-03

Fichier :

```text
src/app/(dashboard)/page.tsx
```

Le code GitHub contient maintenant :

### Brouillons

Le compteur `Brouillons` est global BDD et ne dépend plus de la période du dashboard.

### Non encaissées

Le compteur part des **factures validées** et considère non encaissée une facture :

```text
sans ligne paiement
OU
avec paiement.datePaiement = null
```

Il ne compte plus seulement les lignes de `paiements`.

### Marge HT théorique

Formule intégrée :

```text
prix achat retenu =
    FactureLigne.prixAchatHt si > 0
    sinon Produit.dernierPrixAchatHt

coût achat HT =
    quantité × prix achat retenu

marge HT théorique =
    total ventes HT - total achats HT
```

Le code est présent dans GitHub.

**Point restant : effectuer une validation chiffrée sur quelques factures connues** pour confirmer que les prix d'achat historiques alimentent correctement le calcul. Ne pas considérer ce KPI comme financièrement validé uniquement parce que le code est en place.

## 7. PostgreSQL PROD → DEV — procédure validée

Pour reproduire les données réelles en DEV, une copie complète a été faite avec succès.

Outils PostgreSQL 18 :

```text
C:\Program Files\PostgreSQL\18\bin\
```

Procédure générale :

### PROD

Créer dump :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h 127.0.0.1 `
  -U <USER> `
  -d facturapp_db `
  -F c `
  -f "C:\Temp\FacturApp\facturapp_prod.dump"
```

Copier le dump sur DEV.

### DEV

L'utilisateur accepte que DEV soit écrasée sans sauvegarde si demandé explicitement.

Arrêter `npm run dev`, terminer les connexions, supprimer/recréer `facturapp_db`, puis :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" `
  -h 127.0.0.1 `
  -U <USER> `
  -d facturapp_db `
  --no-owner `
  --no-privileges `
  "C:\Temp\FacturApp\facturapp_prod.dump"
```

Ne jamais exécuter `prisma migrate reset` ou `db push` automatiquement après un clone PROD.

## 8. MariaDB annuelle — décision majeure du 2026-09-03

MariaDB est gérée par exercice.

Exemples :

```text
erp2025
erp2026
erp2027
erp2028
```

Chaque base possède les mêmes tables et doit rester indépendante.

PostgreSQL `facturapp_db` est consolidé multi-années.

### Cible

```text
erp2025 ─┐
erp2026 ─┼──► PostgreSQL toutes années
erp2027 ─┤
erp2028 ─┘
```

Et dans l'autre sens :

```text
PG 2025 → erp2025 seulement
PG 2026 → erp2026 seulement
PG 2027 → erp2027 seulement
```

## 9. MariaDB → PostgreSQL V2

Fichier à utiliser :

```text
prisma/sync-mariadb-to-pg.ts
```

Une V2 multi-années a été préparée.

### Pourquoi l'ancien script était dangereux

Il utilisait directement les IDs MariaDB pour les factures.

Or :

```text
erp2025.facture id=14
erp2026.facture id=14
```

peuvent coexister côté MariaDB, mais pas comme même clé primaire PostgreSQL.

Il faisait aussi :

```sql
DELETE FROM paiements
```

global avant recréation.

Importer 2025 avec ce comportement aurait pu supprimer les paiements 2026.

### V2

La V2 utilise :

```env
SYNC_YEAR
```

Exemple :

```powershell
$env:SYNC_YEAR="2025"
npx tsx prisma/sync-mariadb-to-pg.ts
Remove-Item Env:SYNC_YEAR
```

Si le `.env` contient :

```env
MYSQL_DATABASE="erp2026"
```

le script déduit le préfixe `erp` et utilise `erp2025` pour cette exécution.

### Identité des transactions

Pour les factures, utiliser la clé métier :

```text
annee + numero_sequence
```

PostgreSQL garde ses IDs globaux.

Le script maintient des mappings temporaires MariaDB → PG pour :

```text
factures
devis
avoirs
```

et rattache lignes/paiements aux vrais IDs PostgreSQL.

### Paiements

Aucun `DELETE FROM paiements` global.

Paiement associé à la facture PG correspondante.

### Mode historique

Si l'année importée est antérieure à l'année la plus récente de PostgreSQL, ne pas écraser aveuglément les référentiels courants avec leur état historique.

## 10. Première opération à faire ensuite

Tester sur **DEV** :

```text
erp2025 → PostgreSQL DEV
```

Avant :

```powershell
cd C:\Users\Berrada\Documents\facturapp
npx tsc --noEmit
```

Puis :

```powershell
$env:SYNC_YEAR="2025"
npx tsx prisma/sync-mariadb-to-pg.ts
```

Après succès :

```powershell
Remove-Item Env:SYNC_YEAR
```

Contrôler :

```sql
SELECT annee, COUNT(*)
FROM factures
GROUP BY annee
ORDER BY annee;
```

Attendu : au minimum 2025 et 2026 si les deux jeux de données existent.

Contrôler factures, lignes et paiements 2025 avant tout commit/déploiement.

## 11. Travail restant prioritaire : PG → MariaDB V2 multi-années

Fichier actuel :

```text
scripts/sync-pg-to-mariadb.ts
```

Il doit encore être adapté.

Objectif :

```text
SYNC_YEAR=2026
→ connexion erp2026
→ uniquement transactions PostgreSQL 2026
```

Il faut filtrer annuellement :

- factures ;
- facture_lignes ;
- paiements liés aux factures de l'année ;
- devis et lignes ;
- avoirs et lignes.

Les référentiels (paramètres, entreprise, clients, fournisseurs, produits, prix) doivent être traités de façon compatible avec l'autonomie de chaque base annuelle.

Ne jamais envoyer toutes les années PostgreSQL dans une seule `erpYYYY`.

Prévoir également les bases 2027, 2028, etc.

Décision : si `erpYYYY` n'existe pas, le script métier doit s'arrêter. La création d'un exercice annuel doit être explicite et pourra faire l'objet d'un script séparé.

## 12. Synchronisation mode de règlement — correction récente

Dans PostgreSQL → MariaDB, le champ MariaDB cible est :

```text
paiements.moyen_paiement
```

Le correctif retenu consiste à récupérer directement le libellé via :

```sql
LEFT JOIN parametres mr
ON mr.id = p.mode_reglement_id
```

et écrire `mr.libelle`.

Cela évite qu'un lookup incomplet transforme un mode de règlement valide en `NULL`.

Lors de la V2 multi-années PG → MariaDB, conserver ce correctif.

## 13. OCR / fournisseurs

Fonctions déjà acquises et à préserver :

```text
Mechouar BL       : TVA non / stock oui
Mechouar facture  : TVA oui / stock non
CasInfo           : TVA oui / stock oui
MZ Tech           : TVA oui / stock oui
```

L'OCR prépare les données, mais la validation humaine reste la source de vérité avant stock/prix.

## 14. Git / validation

Avant commit :

```powershell
git status
npx tsc --noEmit
git diff --stat
```

Pour évolution structurelle plus large :

```powershell
npx prisma validate
npx tsc --noEmit
npm run build
```

`tsconfig.tsbuildinfo` est un cache et ne doit pas être versionné.

### Déploiement PROD

```powershell
cd C:\serveur\facturapp-clean
git status
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main

npm install
pm2 stop facturapp
npx prisma generate
npx tsc --noEmit
npm run build
pm2 restart facturapp
pm2 status
```

## 15. Ne pas faire

- ne pas lancer `sync-pg-to-mariadb.ts` contre MariaDB métier depuis PostgreSQL DEV ;
- ne pas importer 2025 avec l'ancienne logique d'IDs annuels ;
- ne pas remettre de `DELETE FROM paiements` global ;
- ne pas mélanger les années dans une base MariaDB annuelle ;
- ne pas modifier `schema.prisma` pour un problème qui se résout dans le script ;
- ne pas supprimer WireGuard tant que le secours n'est pas validé ;
- ne pas désactiver durablement Windows Firewall pour faire fonctionner NetBird ;
- ne pas faire `npm audit fix --force` sur PROD sans sprint de test ;
- ne pas supposer qu'un `.env` est correct sans le vérifier avant dump/restore/sync.

## 16. Priorités de reprise recommandées

### P0 immédiat

1. intégrer la V2 `prisma/sync-mariadb-to-pg.ts` ;
2. `npx tsc --noEmit` ;
3. importer `erp2025` vers PostgreSQL DEV ;
4. valider coexistence 2025/2026, lignes et paiements.

### P1 ensuite

5. développer `scripts/sync-pg-to-mariadb.ts` V2 multi-années ;
6. tester PG 2026 → `erp2026` sans toucher 2025 ;
7. prévoir création explicite `erp2027`, puis 2028+.

### P1 parallèle

8. validation chiffrée du KPI Marge HT théorique ;
9. vérifier valeur finale `NEXTAUTH_URL` PROD / stratégie hostname pour NetBird + WireGuard secours.

## 17. Fichiers clés à lire en premier

```text
docs/PROMPT_REPRISE_FACTURAPP_2026-09-03.md
docs/12_Synchronisation_MariaDB_Multi_Annees.md
docs/00_Architecture.md
docs/02_Base_de_donnees.md
docs/04_Bugs_connus.md
docs/05_Feuille_de_route.md
docs/07_Journal_des_decisions.md
docs/08_Exploitation_DEV.md
docs/09_Exploitation_PROD.md
prisma/schema.prisma
prisma/sync-mariadb-to-pg.ts
scripts/sync-pg-to-mariadb.ts
src/app/(dashboard)/paiements/page.tsx
src/app/(dashboard)/paiements/page-client.tsx
src/app/(dashboard)/page.tsx
```

Ce fichier doit permettre à une nouvelle IA de reprendre le travail sans demander à l'utilisateur de réexpliquer l'historique récent.
