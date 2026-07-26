# FacturApp – Guide d'installation

## Prérequis

- Node.js 20 LTS ou plus récent
- PostgreSQL 15 ou plus récent

---

## Étape 1 – Installer PostgreSQL

### Windows

1. Télécharger PostgreSQL : https://www.postgresql.org/download/windows/
2. Lancer l'installeur, choisir un mot de passe pour l'utilisateur `postgres`
3. Laisser le port par défaut : **5432**

---

## Étape 2 – Créer la base de données

Ouvrir **pgAdmin** (installé avec PostgreSQL) ou lancer dans le terminal :

```sql
-- Se connecter en tant que postgres
psql -U postgres

-- Créer l'utilisateur et la base
CREATE USER facturapp WITH PASSWORD 'motdepasse';
CREATE DATABASE facturapp_db OWNER facturapp;
GRANT ALL PRIVILEGES ON DATABASE facturapp_db TO facturapp;
\q
```

---

## Étape 3 – Configurer le projet

1. Copier `.env.example` en `.env`
2. Éditer `.env` et remplacer la ligne `DATABASE_URL` :

```
DATABASE_URL="postgresql://facturapp:motdepasse@localhost:5432/facturapp_db"
NEXTAUTH_SECRET="une_chaine_de_32_caracteres_au_minimum"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Étape 4 – Installer les dépendances

Ouvrir un terminal dans le dossier du projet :

```bash
npm install
```

---

## Étape 5 – Créer les tables

```bash
npm run db:push
```

---

## Étape 6 – Initialiser les données

```bash
npm run db:seed
```

Cela crée :
- Les rôles (admin, saisie, consultation)
- L'utilisateur admin
- Tous les paramètres métier

**Identifiants par défaut :**
- Email : `admin@facturapp.ma`
- Mot de passe : `admin123`

---

## Étape 7 – Lancer l'application

```bash
npm run dev
```

Ouvrir le navigateur sur : **http://localhost:3000**

---

## En cas de problème

- Vérifier que PostgreSQL est bien démarré (service Windows)
- Vérifier le mot de passe dans `.env`
- Relancer `npm run db:push` si les tables n'ont pas été créées

---

## Commandes utiles

| Commande | Action |
|---|---|
| `npm run dev` | Lancer en développement |
| `npm run build` | Compiler pour production |
| `npm run db:push` | Créer/mettre à jour les tables |
| `npm run db:seed` | Insérer les données initiales |
| `npm run db:studio` | Interface visuelle de la base |

## État actuel du module OCR fournisseurs

Le module d’import des documents fournisseurs prend actuellement en charge :

- l’import des PDF et images ;
- l’OCR local avec PaddleOCR ;
- l’extraction du numéro, de la date, de l’ICE et des totaux ;
- l’extraction des lignes articles à partir des coordonnées OCR ;
- des drivers déclaratifs par fournisseur ;
- les profils CasInfo et Mechouar ;
- un fallback générique ;
- l’édition et la validation des données extraites ;
- la persistance du document validé.

Travaux en cours :

- rapprochement automatique des articles avec le catalogue ;
- création guidée des produits absents ;
- apprentissage des correspondances fournisseur/produit ;
- ajout de nouveaux drivers fournisseurs ;
- branchement des mouvements de stock.

## MAJ du 26/07/2026
## État actuel du projet

FacturApp est en développement actif.

Fonctionnalités principales disponibles :

- gestion commerciale : clients, fournisseurs, produits, devis, factures,
  avoirs, charges et paiements ;
- import de factures fournisseurs PDF ou image ;
- OCR local avec Python et PaddleOCR ;
- extraction structurée des informations et lignes articles ;
- rapprochement des lignes OCR avec les produits existants ;
- correction manuelle avant validation ;
- mémorisation des associations fournisseur → produit ;
- intégration atomique des lignes validées dans le stock ;
- détection des écarts entre prix OCR et prix d’achat enregistrés.

Le projet utilise actuellement Prisma sans historique local Prisma Migrate.
Ne pas exécuter `prisma migrate reset` sur une base contenant des données utiles.

## Base de développement

Les outils de sauvegarde de la production et de réinitialisation de la base DEV
sont conservés séparément dans le dossier/projet `facturapp-db-tools`.

Le principe retenu est :

1. sauvegarder les données de production ;
2. conserver le schéma PostgreSQL de DEV ;
3. vider les données DEV ;
4. restaurer uniquement les données de production ;
5. recalculer les séquences ;
6. vérifier les comptages.

Les tables spécifiques à FacturApp et à l’OCR doivent rester présentes dans DEV.

`npm run db:push` est réservé à la création initiale d’une base vide ou à une
évolution explicitement validée du schéma.

Ne pas lancer `prisma db push`, `prisma migrate reset` ou `prisma db pull`
automatiquement sur une base restaurée.

Prévilégié :
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit