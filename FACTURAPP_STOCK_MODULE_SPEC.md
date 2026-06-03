# Résumé Complet du Projet FacturApp

## Structure Générale du Projet

FacturApp est une application de gestion de facturation développée avec **Next.js 14.2.5** (App Router), **TypeScript**, **Tailwind CSS**, **Prisma ORM** et **PostgreSQL**. Le projet comprend également une synchronisation bidirectionnelle avec une base MariaDB pour assurer la compatibilité avec un ancien système VB6.

## Architecture Technique

- **Framework**: Next.js 14.2.5 (App Router)
- **Langage**: TypeScript
- **UI**: Tailwind CSS
- **Base de données**: PostgreSQL (primaire) + MariaDB (synchronisation bidirectionnelle pour VB6)
- **ORM**: Prisma
- **Authentification**: NextAuth v5 (JWT)
- **Export**: jsPDF, jsPDF-AutoTable, Excel (xlsx)
- **Runtime**: Node.js (Windows Server)
- **Process Management**: PM2

## Modèle de Données Principal

Le modèle de données comprend:
- **Utilisateurs** avec rôles (ADMIN, SAISIE, CONSULTATION)
- **Entreprise** (informations société)
- **Clients/Fournisseurs** avec types
- **Produits** (référence, description, prix d'achat/vente, TVA)
- **Factures** avec lignes de facture
- **Devis** et **Avoirs**
- **Paiements** avec modes de règlement
- **Charges** avec types
- **Paramètres** catégorisés (unités, TVA, modes règlement, etc.)

## Fonctionnalités Actuelles

1. **Gestion des utilisateurs** avec rôles et permissions
2. **Gestion des clients et fournisseurs**
3. **Gestion des produits** (référence, prix, TVA)
4. **Gestion des factures** (création, validation, paiement)
5. **Gestion des devis** (conversion en facture)
6. **Gestion des avoirs**
7. **Gestion des paiements** (suivi, encaissement)
8. **Gestion des charges**
9. **Exports PDF/Excel** pour divers documents
10. **Synchronisation bidirectionnelle** MariaDB ↔ PostgreSQL

## Sécurité et Authentification

- Authentification basée sur JWT via NextAuth
- Contrôle d'accès basé sur les rôles (ADMIN/SAISIE/CONSULTATION)
- Middleware pour protection des routes
- API routes avec vérification des permissions

## Structure des Pages et Composants

- Les pages sont organisées dans `src/app/(dashboard)/`
- Chaque module a sa propre structure (factures, devis, produits, etc.)
- Pages serveur pour récupération des données
- Composants client pour l'interaction utilisateur
- Formulaires dynamiques pour création/modification

## Synchronisation MariaDB ↔ PostgreSQL

Le projet inclut des scripts de synchronisation bidirectionnelle:
- `prisma/sync-mariadb-to-pg.ts`: Migration de MariaDB vers PostgreSQL
- `prisma/sync-pg-to-mariadb.ts`: Migration de PostgreSQL vers MariaDB
- Les deux bases sont maintenues synchronisées pour assurer la compatibilité avec le système VB6

## Spécifications Techniques Importantes

1. **Configuration dynamique**: Toutes les pages serveur et API routes doivent déclarer `export const dynamic = 'force-dynamic'`
2. **Conversion des décimaux**: Les champs Prisma Decimal doivent être convertis en `Number()` avant transmission au client
3. **Permissions**: Utilisation du module `src/lib/utils/permissions.ts` pour contrôle d'accès
4. **Import de types**: Utilisation de `import type { X } from 'next/server'` pour éviter les erreurs de résolution

## Modules Complètement Implémentés

- ✅ Utilisateurs (gestion complète avec rôles)
- ✅ Clients et fournisseurs
- ✅ Produits (catalogue de base)
- ✅ Factures (création, validation, paiement)
- ✅ Devis (avec conversion en facture)
- ✅ Avoirs (création, édition)
- ✅ Paiements (suivi des encaissements)
- ✅ Charges (gestion des dépenses)
- ✅ Exports (PDF/Excel pour documents)

## Fonctionnalités Manquantes/À Développer

- ❌ **Gestion du stock** (entrées/sorties, inventaire) - **Ce module n'est pas implémenté**
- ❌ Suivi des mouvements de stock
- ❌ Historique des entrées/sorties
- ❌ Calculs automatiques de stock disponible
- ❌ Alertes de stock bas/seuil

## État Actuel du Stock

**Important**: Le système de gestion du stock n'est **PAS** implémenté dans la version actuelle. Bien que des traces de champs liés au stock existent dans la base MariaDB (`stock_initial`, `stock_actuel`, `seuil_alerte`, `alerte`), cette fonctionnalité n'est pas présente dans la partie PostgreSQL et l'interface utilisateur. Les quantités dans les factures sont utilisées uniquement pour le calcul des totaux, sans suivi effectif des stocks.

## Configuration Requise

- Variables d'environnement dans `.env`
- Configuration PM2 pour déploiement Windows Server
- Accès aux deux bases (PostgreSQL et MariaDB) pour la synchronisation

## Normes de Codage

- Respect des spécifications d'API RBAC (contrôle d'accès basé sur les rôles)
- Utilisation des utilitaires de permissions
- Respect des spécifications de sécurité
- Conversion appropriée des types Prisma Decimal

Ce résumé fournit une vue d'ensemble complète du projet FacturApp, en particulier concernant l'état actuel de la gestion du stock qui **n'est pas implémentée** et nécessite un développement complet.