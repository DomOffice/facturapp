# Résumé Complet du Projet FacturApp - Module Stock

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

## Modèle de Données Principal (PostgreSQL - Actuel)

Le modèle de données PostgreSQL actuel comprend:
- **Utilisateurs** avec rôles (ADMIN, SAISIE, CONSULTATION)
- **Entreprise** (informations société)
- **Clients/Fournisseurs** avec types
- **Produits** (référence, description, prix d'achat/vente, TVA) - *sans gestion de stock*
- **Factures** avec lignes de facture
- **Devis** et **Avoirs**
- **Paiements** avec modes de règlement
- **Charges** avec types
- **Paramètres** catégorisés (unités, TVA, modes règlement, etc.)

## Analyse Comparative - Existant vs. À Développer

### Fonctionnalités Actuellement Implémentées

1. **Gestion des utilisateurs** avec rôles et permissions
2. **Gestion des clients et fournisseurs**
3. **Gestion des produits** (référence, prix, TVA) - *sans suivi de stock*
4. **Gestion des factures** (création, validation, paiement) - *quantités utilisées uniquement pour calculs*
5. **Gestion des devis** (conversion en facture)
6. **Gestion des avoirs**
7. **Gestion des paiements** (suivi, encaissement)
8. **Gestion des charges**
9. **Exports PDF/Excel** pour divers documents
10. **Synchronisation bidirectionnelle** MariaDB ↔ PostgreSQL

### État Actuel des Données de Stock

**Important**: L'analyse du code révèle que les champs liés au stock existent **dans la base MariaDB (VB6)** mais **NE sont PAS présents dans le schéma PostgreSQL actuel** :
- Champs MariaDB VB6: `stock_initial`, `stock_actuel`, `seuil_alerte`, `alerte`, `coeff_marge`
- Ces champs sont gérés dans les scripts de synchronisation (`sync-pg-to-mariadb.ts`)
- Mais **ils ne sont pas synchronisés vers PostgreSQL** ni exposés dans l'interface utilisateur
- Le modèle [Produit](file://c:\Users\Berrada\Documents\facturapp\src\app\(dashboard)\produits\page-client.tsx#L9-L20) dans Prisma ne contient aucun champ lié au stock

### Sécurité et Authentification

- Authentification basée sur JWT via NextAuth
- Contrôle d'accès basé sur les rôles (ADMIN/SAISIE/CONSULTATION)
- Middleware pour protection des routes
- API routes avec vérification des permissions

### Structure des Pages et Composants

- Les pages sont organisées dans `src/app/(dashboard)/`
- Chaque module a sa propre structure (factures, devis, produits, etc.)
- Pages serveur pour récupération des données
- Composants client pour l'interaction utilisateur
- Formulaires dynamiques pour création/modification
- **Aucun module dédié à la gestion de stock n'existe**

## Spécifications Techniques Importantes

1. **Configuration dynamique**: Toutes les pages serveur et API routes doivent déclarer `export const dynamic = 'force-dynamic'`
2. **Conversion des décimaux**: Les champs Prisma Decimal doivent être convertis en `Number()` avant transmission au client
3. **Permissions**: Utilisation du module `src/lib/utils/permissions.ts` pour contrôle d'accès
4. **Import de types**: Utilisation de `import type { X } from 'next/server'` pour éviter les erreurs de résolution

## Modules Complètement Implémentés

- ✅ Utilisateurs (gestion complète avec rôles)
- ✅ Clients et fournisseurs
- ✅ Produits (catalogue de base - *sans suivi de stock*)
- ✅ Factures (création, validation, paiement - *quantités sans impact sur stock*)
- ✅ Devis (avec conversion en facture)
- ✅ Avoirs (création, édition)
- ✅ Paiements (suivi des encaissements)
- ✅ Charges (gestion des dépenses)
- ✅ Exports (PDF/Excel pour documents)

## Fonctionnalités Manquantes/À Développer - Module Stock

### Niveau Modèle de Données (PostgreSQL)
- ❌ Ajouter les champs de stock au modèle [Produit](file://c:\Users\Berrada\Documents\facturapp\src\app\(dashboard)\produits\page-client.tsx#L9-L20) dans Prisma:
  - `stock_initial` (Decimal)
  - `stock_actuel` (Decimal) 
  - `seuil_alerte` (Decimal)
  - `alerte` (Boolean)
  - `coeff_marge` (Decimal)
- ❌ Créer un modèle `MouvementStock` pour suivre les entrées/sorties
- ❌ Créer un modèle `AlerteStock` pour gérer les notifications

### Niveau Logique Métier
- ❌ Système de calcul automatique du stock disponible (entrée - sortie)
- ❌ Déclenchement automatique des alertes de stock bas
- ❌ Mise à jour du stock lors des opérations (facturation, retours, ajustements)
- ❌ Historique des mouvements de stock

### Niveau Interface Utilisateur
- ❌ Module dédié "Stock" dans le menu principal
- ❌ Page de gestion des stocks (vue d'ensemble)
- ❌ Page de détail des mouvements de stock par produit
- ❌ Page de gestion des alertes de stock
- ❌ Page d'ajustement de stock manuel
- ❌ Intégration du stock dans la page de détail des produits

### Niveau API
- ❌ Endpoints API pour la gestion des mouvements de stock
- ❌ Mécanisme de mise à jour du stock lors de la création/modification des factures
- ❌ Endpoint pour les alertes de stock
- ❌ Endpoint pour les ajustements de stock

## Plan de Développement du Module Stock

### Phase 1: Extension du modèle de données
1. Modifier le schéma Prisma pour ajouter les champs de stock
2. Mettre à jour la base PostgreSQL (migrations)
3. Tester la synchronisation avec MariaDB

### Phase 2: Logique métier
1. Créer les services de gestion de stock dans `src/lib`
2. Implémenter les règles de calcul automatique du stock
3. Intégrer la mise à jour du stock dans les processus existants (facturation, avoirs)

### Phase 3: Interface utilisateur
1. Créer le module "Stock" dans le dashboard
2. Développer les pages de gestion des stocks
3. Intégrer l'affichage du stock dans les formulaires produits et factures

### Phase 4: Intégration et tests
1. Assurer la cohérence entre les différentes parties du système
2. Tester la synchronisation bidirectionnelle avec MariaDB
3. Vérifier la sécurité et les permissions

## Configuration Requise

- Variables d'environnement dans `.env`
- Configuration PM2 pour déploiement Windows Server
- Accès aux deux bases (PostgreSQL et MariaDB) pour la synchronisation

## Normes de Codage

- Respect des spécifications d'API RBAC (contrôle d'accès basé sur les rôles)
- Utilisation des utilitaires de permissions
- Respect des spécifications de sécurité
- Conversion appropriée des types Prisma Decimal
- Conformité avec les normes de codage existantes dans le projet

## Conclusion

Le module de gestion de stock est un complément essentiel pour FacturApp qui nécessite une refonte significative du modèle de données et de la logique métier. La présence de champs de stock dans la base MariaDB VB6 indique que cette fonctionnalité était prévue ou existait dans l'ancien système, ce qui renforce la pertinence de son implémentation dans la version moderne.