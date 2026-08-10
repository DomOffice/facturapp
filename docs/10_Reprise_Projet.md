# 10 — Reprise du projet FacturApp

Dernière mise à jour : 2026-08-10

## État actuel

FacturApp est opérationnel avec :

- gestion commerciale historique ;
- clients, fournisseurs, produits, devis, factures, avoirs, paiements ;
- stock manuel et stock fournisseur ;
- OCR fournisseurs ;
- drivers Mechouar, CasInfo et MZ Tech ;
- rapprochement produits ;
- intégration stock ;
- TVA fournisseurs / charges / clients ;
- page `/tva` ;
- détection de doublons ;
- validation partielle forcée ;
- synchronisation MariaDB → PostgreSQL ;
- synchronisation PostgreSQL PROD → MariaDB ;
- génération PDF facture proche du modèle VB6, y compris multipage ;
- déploiement Windows via PM2.

## Règles d’environnement à ne jamais oublier

```text
PC DEV    → PostgreSQL DEV local uniquement
Serveur   → PostgreSQL PROD + MariaDB
PG → MariaDB : PROD uniquement
```

Toujours contrôler `DATABASE_URL` avant dump, restore, Prisma structurel ou synchronisation.

## Règles métier fournisseurs

```text
Facture Mechouar : TVA oui / stock non
BL Mechouar      : TVA non / stock oui
CasInfo          : TVA oui / stock oui
MZ Tech          : TVA oui / stock oui
```

## Synchronisations

```text
prisma/sync-mariadb-to-pg.ts
prisma/sync-pg-to-mariadb.ts
```

Le second ne doit jamais viser DEV.

Interface de synchronisation PROD :

```text
/admin/sync
```

## Facturation — état du sprint

### `/produits`

Le stock est modifiable manuellement.

### `/factures/nouvelle`

- quantité vide à l’ouverture du popup ;
- champ quantité agrandi ;
- recherche vidée après ajout ;
- focus replacé sur la recherche ;
- loupe à gauche.

### PDF facture

Fichier principal :

```text
src/lib/exports/pdf/facture-pdf.ts
```

Fonctionnalités clés :

- société dynamique ;
- client dynamique ;
- logo via `/api/logo` ;
- références/unité réelles ;
- tableau sans lignes horizontales entre articles ;
- verticales de colonnes ;
- `TOTAL MAD` avec TVA par taux ;
- montant en lettres ;
- pied de page ;
- multipage ;
- en-têtes répétés ;
- pagination ;
- totaux gardés sur la page courante s’ils tiennent encore.

## Exploitation PROD

Chemin :

```text
C:\serveur\facturapp-clean
```

Application :

```text
http://10.8.0.1:3001
```

Déploiement robuste :

```powershell
git fetch origin
git pull --ff-only origin main
npm install
pm2 stop facturapp
npx prisma generate
npx tsc --noEmit
npm run build
pm2 restart facturapp
pm2 status
```

Si `prisma generate` retourne `EPERM` sur `query_engine-windows.dll.node`, vérifier qu’aucun processus Node n’utilise encore le moteur Prisma.

## Limites acceptées

- TVA globale encore entièrement comptabilisée lors d’une validation partielle forcée ;
- dépendances npm avec vulnérabilités à traiter dans un sprint dédié ;
- `tsconfig.tsbuildinfo` encore versionné ;
- redémarrage automatique Windows à valider définitivement.

## Prochaine reprise recommandée

Commencer par :

1. lire `docs/11_Handoff_IA.md` ;
2. vérifier le dernier commit GitHub ;
3. vérifier `git status` DEV et PROD ;
4. confirmer les `.env` et les deux PostgreSQL ;
5. choisir le prochain objectif parmi feuille de route P0/P1.
