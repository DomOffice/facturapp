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
