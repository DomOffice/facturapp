# facturapp-db-tools

Outils de sauvegarde de la production et de réinitialisation de la base
PostgreSQL DEV de FacturApp.

## Objectif

Ces outils permettent de :

1. sauvegarder les données de production ;
2. conserver le schéma PostgreSQL spécifique à DEV ;
3. vider les données de DEV ;
4. restaurer uniquement les données de production ;
5. recalculer les séquences ;
6. effectuer des vérifications ;
7. protéger le fichier `prisma/schema.prisma`.

Le processus est volontairement séparé du code applicatif.

## Principe de restauration

La restauration utilise :

```text
pg_restore --data-only
```

Elle ne restaure pas le schéma de production.

Cette règle est importante car DEV peut contenir des tables qui ne sont pas
encore présentes en production, notamment pour :

- l’OCR ;
- le rapprochement fournisseur-produit ;
- l’intégration du stock ;
- les mouvements de stock.

## Structure

```text
facturapp-db-tools/
├── backups/
├── backups_schema/
├── 00_backup_prisma_schema.bat
├── 01_backup_prod.bat
├── 02_reset_dev.sql
├── 03_restore_dev.bat
├── 04_reset_sequences.sql
├── 05_verification.sql
├── 06_compare_prisma_schema.ps1
├── README.md
└── .gitignore
```

## Configuration

Avant la première utilisation, adapter les variables présentes au début des
scripts `.bat`.

### Dans `00_backup_prisma_schema.bat`

Configurer :

```bat
set "FACTURAPP_DIR=C:\CHEMIN\VERS\facturapp"
```

### Dans `01_backup_prod.bat`

Configurer :

```bat
set "PG_BIN=C:\Program Files\PostgreSQL\16\bin"

set "PROD_HOST=adresse-du-serveur"
set "PROD_PORT=5432"
set "PROD_DB=facturapp"
set "PROD_USER=postgres"
```

### Dans `03_restore_dev.bat`

Configurer :

```bat
set "PG_BIN=C:\Program Files\PostgreSQL\16\bin"

set "DEV_HOST=localhost"
set "DEV_PORT=5432"
set "DEV_DB=facturapp_dev"
set "DEV_USER=postgres"
```

Vérifier particulièrement que `DEV_DB` désigne bien la base de développement.

## Sauvegarde du schéma Prisma

Depuis le dossier des outils :

```bat
00_backup_prisma_schema.bat
```

Ce script copie uniquement :

```text
prisma/schema.prisma
```

dans le dossier `backups_schema`.

Il ne se connecte pas à PostgreSQL.

## Sauvegarde de production

Exécuter sur un poste ayant accès à la production :

```bat
01_backup_prod.bat
```

Le script crée un fichier de type :

```text
backups/facturapp_prod_20260726_201500.dump
```

Le mot de passe demandé est celui de PostgreSQL PROD.

Les données de la table `_prisma_migrations` sont exclues du dump.

## Restauration DEV

Copier le dump dans le dossier :

```text
backups
```

Puis exécuter sur le poste DEV :

```bat
03_restore_dev.bat
```

Sans argument, le script utilise le dump `.dump` le plus récent.

Il est également possible d’indiquer explicitement le fichier :

```bat
03_restore_dev.bat "C:\Sauvegardes\facturapp_prod_20260726.dump"
```

Le mot de passe demandé pendant la restauration est celui de PostgreSQL DEV.

## Étapes exécutées

Le script principal effectue :

1. `02_reset_dev.sql` ;
2. `pg_restore --data-only --disable-triggers` ;
3. `04_reset_sequences.sql` ;
4. `05_verification.sql`.

## Commandes Prisma non exécutées

Les outils ne lancent jamais automatiquement :

```bash
npx prisma db pull
npx prisma db push
npx prisma migrate dev
npx prisma migrate reset
```

Après restauration, les contrôles autorisés sont :

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
```

Ils doivent être lancés depuis le projet FacturApp.

## Introspection exceptionnelle

`prisma db pull` ne fait pas partie de la restauration.

Lorsqu’une introspection est réellement nécessaire :

1. sauvegarder le schéma avec `00_backup_prisma_schema.bat` ;
2. exécuter volontairement `npx prisma db pull` ;
3. conserver le résultat introspecté sous un autre nom ;
4. remettre le schéma de référence ;
5. comparer les fichiers ;
6. intégrer manuellement les différences validées.

Ne jamais accepter automatiquement le schéma produit par `db pull`.

## Comparaison de schémas

Exemple PowerShell :

```powershell
.\06_compare_prisma_schema.ps1 `
  -SchemaReference "C:\Projet\facturapp\prisma\schema.prisma" `
  -SchemaCompare ".\backups_schema\schema_apres_db_pull.prisma.backup"
```

Le script ouvre une comparaison Visual Studio Code lorsque la commande `code`
est disponible.

Il ne remplace aucun fichier.

## Incident connu : triggers et clés étrangères

Une restauration `data-only` peut charger les tables dans un ordre incompatible
avec les clés étrangères.

Le script utilise donc :

```text
--disable-triggers
```

L’utilisateur PostgreSQL DEV doit disposer des droits nécessaires.

## Incident connu : table temporaire de vérification

Ne pas utiliser :

```sql
CREATE TEMP TABLE ... ON COMMIT DROP;
```

dans le script de vérification sans transaction explicite.

Avec l’autocommit de `psql`, la table peut être supprimée immédiatement.

## Incident connu : Prisma sous Windows

`npx prisma generate` peut échouer avec une erreur `EPERM` si un processus
Node.js verrouille le moteur Prisma.

Dans ce cas :

1. arrêter `npm run dev` ;
2. fermer les processus Node.js ;
3. relancer `npx prisma generate`.

## Sécurité

Les dumps peuvent contenir des données commerciales réelles.

Ne jamais :

- les commiter dans Git ;
- les publier ;
- les envoyer dans un dépôt public ;
- les conserver inutilement ;
- les copier sur un poste non autorisé.

## Contrôles après restauration

Dans le projet FacturApp :

```bash
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run dev
```

Contrôler ensuite :

- la connexion ;
- les clients ;
- les fournisseurs ;
- les produits ;
- les documents importés ;
- l’OCR ;
- la création d’un nouvel enregistrement ;
- les séquences ;
- le stock.

## Avertissement

Ces scripts détruisent les données présentes dans la base DEV.

Ils ne doivent jamais être configurés avec l’adresse ou le nom de la base de
production comme destination.