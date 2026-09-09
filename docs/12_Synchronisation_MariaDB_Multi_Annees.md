# 12 — Synchronisation MariaDB annuelle / PostgreSQL consolidé

Dernière mise à jour : 2026-09-03

## 1. Décision d'architecture

MariaDB/VB6 est organisée par exercice annuel : une base indépendante par année, avec les mêmes tables.

Exemples :

```text
erp2025
erp2026
erp2027
erp2028
...
```

PostgreSQL FacturApp reste au contraire une base consolidée multi-années :

```text
MariaDB erp2025 ─┐
MariaDB erp2026 ─┼──► PostgreSQL facturapp_db
MariaDB erp2027 ─┤       toutes les années
MariaDB erp2028 ─┘
```

Règle cible du flux inverse :

```text
PostgreSQL année 2025 ──► erp2025 uniquement
PostgreSQL année 2026 ──► erp2026 uniquement
PostgreSQL année 2027 ──► erp2027 uniquement
...
```

Chaque base MariaDB doit rester indépendante. Une synchronisation 2026 ne doit jamais injecter des factures 2025 ou 2027 dans `erp2026`.

## 2. Script MariaDB → PostgreSQL V2

Fichier :

```text
prisma/sync-mariadb-to-pg.ts
```

La V2 introduit `SYNC_YEAR`.

Exemple, avec `.env` contenant :

```env
MYSQL_DATABASE="erp2026"
```

pour importer 2025 sans modifier `.env` :

```powershell
$env:SYNC_YEAR="2025"
npx tsx prisma/sync-mariadb-to-pg.ts
Remove-Item Env:SYNC_YEAR
```

Le script construit alors automatiquement la base cible MariaDB `erp2025`.

Sans `SYNC_YEAR`, l'année est déduite du suffixe de `MYSQL_DATABASE`.

## 3. Pourquoi les IDs MariaDB annuels ne peuvent pas être utilisés comme IDs PostgreSQL

Les IDs transactionnels recommencent potentiellement dans chaque base annuelle.

Exemple :

```text
erp2025.factures.id = 14
erp2026.factures.id = 14
```

PostgreSQL ne peut pas stocker ces deux factures avec le même `id`.

La V2 n'utilise donc plus l'ID MariaDB comme identifiant PostgreSQL pour les documents transactionnels.

La facture PostgreSQL est identifiée par sa clé métier :

```text
annee + numero_sequence
```

Exemple :

```text
erp2025 : facture id 14 / numéro 52
        ↓
PostgreSQL : F2025/00052 / id global propre à PostgreSQL

erp2026 : facture id 14 / numéro 14
        ↓
PostgreSQL : F2026/00014 / autre id global PostgreSQL
```

Pendant l'import, des mappings temporaires mémorisent les correspondances MariaDB → PostgreSQL pour rattacher correctement les lignes, paiements, devis et avoirs.

## 4. Protection des paiements

L'ancienne synchronisation MariaDB → PostgreSQL contenait un :

```sql
DELETE FROM paiements
```

global.

Cette logique est interdite dans une architecture multi-années : importer 2025 aurait pu supprimer les paiements 2026.

La V2 supprime ce comportement. Les paiements sont upsertés à partir de leur facture PostgreSQL réelle, sans suppression globale.

## 5. Mode historique des référentiels

Lorsqu'une année ancienne est importée alors qu'une année plus récente existe déjà dans PostgreSQL, le script passe en mode historique.

Objectif : ne pas remplacer l'état courant 2026 d'un client, fournisseur ou produit par une ancienne valeur 2025.

Principe :

```text
référentiel déjà présent dans PG
    → réutiliser / mapper
    → ne pas écraser avec l'ancien état

référentiel absent
    → créer si nécessaire
```

Les documents transactionnels 2025 sont néanmoins importés avec leurs dates, numéros et montants propres.

## 6. Première opération prévue

Objectif immédiat :

```text
erp2025 → PostgreSQL DEV
```

Avant exécution :

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

Contrôles PostgreSQL :

```sql
SELECT annee, COUNT(*) AS nb_factures
FROM factures
GROUP BY annee
ORDER BY annee;
```

Puis :

```sql
SELECT numero_facture, date_facture, total_ttc
FROM factures
WHERE annee = 2025
ORDER BY numero_sequence DESC
LIMIT 20;
```

Et paiements :

```sql
SELECT
    f.annee,
    COUNT(*) AS factures,
    COUNT(p.id) AS suivis_paiement
FROM factures f
LEFT JOIN paiements p ON p.facture_id = f.id
GROUP BY f.annee
ORDER BY f.annee;
```

## 7. Étape suivante non encore réalisée

Le flux inverse doit encore recevoir sa V2 multi-années :

```text
scripts/sync-pg-to-mariadb.ts
```

Objectifs de cette prochaine V2 :

1. accepter `SYNC_YEAR` ;
2. sélectionner automatiquement `erpYYYY` ;
3. filtrer les factures sur `factures.annee = SYNC_YEAR` ;
4. filtrer lignes, paiements, devis et avoirs sur la même année ;
5. ne jamais toucher aux documents d'un autre exercice ;
6. conserver les référentiels nécessaires dans chaque base annuelle ;
7. prévoir 2027, 2028 et exercices futurs sans modification du code.

Ne pas lancer une synchronisation PostgreSQL consolidée vers une base MariaDB annuelle avec l'ancien script sans vérifier le filtrage annuel.

## 8. Création d'un nouvel exercice MariaDB

À terme, prévoir un script séparé, par exemple :

```text
scripts/create-mariadb-year.ts
```

Usage envisagé :

```powershell
npx tsx scripts/create-mariadb-year.ts 2027
```

Il devra créer explicitement la structure de `erp2027` depuis un modèle connu.

Décision : la synchronisation métier ne doit pas créer silencieusement une nouvelle base annuelle. Si `erpYYYY` n'existe pas, elle doit s'arrêter avec une erreur explicite.

## 9. Environnements

### DEV

PostgreSQL local de test.

Pour joindre MariaDB sur le serveur :

```env
MYSQL_HOST="100.92.8.37"
```

si NetBird est utilisé comme chemin principal.

### PROD

PostgreSQL et MariaDB étant sur le même serveur :

```env
MYSQL_HOST="127.0.0.1"
```

doit rester la valeur privilégiée.

## 10. Règle de sécurité

Le sens PostgreSQL → MariaDB appartient à la production.

Ne jamais exécuter par erreur un script PG → MariaDB depuis une base DEV contre la MariaDB métier.

Avant toute synchronisation importante, afficher et vérifier explicitement :

```text
PostgreSQL source
MariaDB cible
Année SYNC_YEAR
Nom erpYYYY
sens de synchronisation
```
