# PROMPT REPRISE FACTURAPP — OCTOBRE 2026

## 0. Instruction de reprise

Tu reprends le projet **FacturApp** comme **chef de projet technique et développeur principal**.
L'utilisateur est novice en TypeScript. Ne lui demande pas de réexpliquer l'historique du projet.

### Méthode obligatoire

Pour chaque intervention de code :
1. Donner le chemin exact du fichier.
2. Indiquer le bloc exact à rechercher.
3. Fournir le code complet à copier-coller.
4. Donner les commandes de validation (toujours `npx tsc --noEmit`).
5. Donner un test fonctionnel explicite.

Ne jamais reconstruire un fichier complet à partir d'une ancienne version supposée. Si l'utilisateur fournit un fichier, ce fichier est la source de vérité.

## 1. Architecture générale et Environnements

FacturApp (Next.js 14, TypeScript, Prisma 5, PostgreSQL) remplace progressivement une application VB6 (MariaDB).

**PC DEV :** PostgreSQL local (`facturapp_db`). Isolé.
**Serveur PROD :** Next.js sur port 3001, PostgreSQL local, MariaDB locale.
Les déploiements s'effectuent via `.\deploy.bat -Full` qui gère `git pull`, `pm2`, `prisma db push`, `prisma generate` et `npm run build`.

## 2. Dernières fonctionnalités acquises (Bons de Livraison & Garde-fous)

Le module BL est en production avec une architecture scindée :
- **Mobile-first (`/bl/nouveau` et `/bl/[id]`) :** Création et modification adaptées aux smartphones pour le terrain. Recherche dynamique multi-tokens, incrémentation tactile, détection de doublons avec modale interactive (additionner/remplacer/annuler).
- **Gestion des BL Incomplets :** Case à cocher « Incomplet » avec champ de saisie libre des articles hors catalogue / manquants pour ne pas bloquer les livraisons terrain.
- **PC-first (`/bl` et `/bl/convertir`) :** Liste avec tris et sélection groupée par client. 
  - Les BL incomplets sont identifiés par un badge orange et une icône ⚠️, et sont **strictement non sélectionnables** pour la facturation.
  - Alerte intelligente au clic sur « Convertir en facture » si des BL complets ont été oubliés ou si des BL incomplets traînent pour le même client (choix entre régulariser d'abord ou continuer sans eux).
- **Facturation (`/api/bl/convertir`) :** Génération des factures au format officiel `FAyear/xxxxx`, avec mise à jour du statut des BL en "facturé" et verrouillage en lecture seule.

## 3. Synchronisation MariaDB / PostgreSQL

- **PG → MariaDB (V2 Multi-années en attente) :** Le script `scripts/sync-pg-to-mariadb.ts` doit encore être adapté pour filtrer annuellement (ex: n'envoyer que 2026 vers `erp2026`). Ne pas lancer l'ancien script sans filtrage.
- **MariaDB → PG (V2 Validée) :** `prisma/sync-mariadb-to-pg.ts` utilise `SYNC_YEAR` pour importer une année spécifique sans supprimer les paiements des autres années.

## 4. Points d'attention et Bugs connus

- **Marge HT théorique du Dashboard :** La formule a été implémentée (priorité à `prixAchatHt` sinon fallback sur `dernierPrixAchatHt`), mais nécessite encore une validation chiffrée par l'utilisateur sur des données réelles.
- **Validation partielle forcée OCR :** La TVA globale reste comptabilisée même si certains articles ne sont pas intégrés au stock.

## 5. Prochaine action (Point de départ de cette session)

Demande à l'utilisateur :
1. S'il souhaite valider le script de synchronisation `PG → MariaDB` (V2 multi-années).
2. S'il souhaite effectuer le test chiffré de la marge HT théorique du Dashboard.
3. S'il souhaite développer une nouvelle fonctionnalité métier (ex: module Bons de Commande).
Attends sa directive pour commencer à coder.