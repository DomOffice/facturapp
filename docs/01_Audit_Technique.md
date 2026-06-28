# 01_Audit_Technique.md — Audit technique FacturApp

Dernière mise à jour : 28/06/2026

## Synthèse

FacturApp dispose déjà d'une base solide : Next.js App Router, TypeScript, Prisma, architecture par modules, schéma métier riche, début de module OCR. Le projet est exploitable, mais plusieurs points doivent être sécurisés avant d'aller plus loin : routes incohérentes, redirects obsolètes, duplication possible, validation API à renforcer, stratégie claire pour l'import fournisseur/OCR.

## 1. Architecture globale

### Points positifs

- Bonne séparation générale entre `src/app`, `src/components`, `src/lib`, `prisma`.
- Modules métiers clairement identifiables.
- Utilisation du route group `(dashboard)` correcte dans l'ensemble.
- Le schéma Prisma couvre déjà les besoins essentiels.

### Points à améliorer

- Certaines routes pointent vers des chemins inexistants : `/dashboard`, `/login`, `/charges/nouveau`.
- Les conventions de nommage ne sont pas toujours homogènes : `nouveau` vs `nouvelle`.
- Le module `factures-fournisseurs` est actuellement hybride : il affiche des `charges` mais commence à gérer des `documents_importes`.

### Recommandation

Créer une convention claire :

- `/factures/nouvelle` pour facture client ;
- `/factures-fournisseurs/nouveau` pour import fournisseur ;
- `/charges` pour charges simples ;
- éviter de mélanger `/charges` et `/factures-fournisseurs` dans les liens.

## 2. Qualité du code

### Points positifs

- Code lisible dans les pages principales.
- Usage de composants dédiés pour certains formulaires.
- Composant `UploadFacture` déjà isolé.

### Points à améliorer

- Certaines pages contiennent encore des commentaires temporaires.
- Les règles de rôle sont répétées dans plusieurs fichiers.
- Les constantes métier sont dispersées.
- Certaines redirections sont codées en dur.

### Recommandation

Créer progressivement :

```txt
src/lib/routes.ts
src/lib/auth/guards.ts
src/lib/config/upload.ts
src/lib/validation/
```

## 3. Performances

### Points positifs

- Les pages serveur récupèrent les données côté serveur.
- Prisma est correctement centralisé via `src/lib/db/prisma.ts`.

### Risques

- Certaines listes peuvent devenir lentes si elles grossissent sans pagination.
- Les imports complets avec `include` peuvent être coûteux à long terme.
- `force-dynamic` est utile mais empêche certains bénéfices de cache.

### Recommandation

- Ajouter pagination et recherche serveur sur les grandes listes.
- Limiter les `include` aux champs utiles.
- Indexer les champs de recherche fréquents.

## 4. Sécurité

### Points positifs

- Présence d'une authentification NextAuth.
- Certaines pages vérifient `session?.user`.
- La route d'upload vérifie rôle et authentification.

### Risques

- Les permissions sont répétées et non centralisées.
- Les routes API doivent toutes être auditées une par une.
- L'upload accepte PDF/JPEG/PNG mais doit être durci avant production.
- Le chemin local Windows par défaut doit être remplacé par une variable d'environnement fiable.

### Recommandation prioritaire

Créer un helper serveur :

```ts
requireUser()
requireRole(['ADMIN', 'SAISIE'])
```

Puis l'utiliser partout.

## 5. Base de données

### Points positifs

- Schéma Prisma riche et cohérent.
- Relations principales présentes.
- Tables dédiées à l'import OCR déjà prévues.

### Risques

- `DocumentImporte` impose `fournisseurId`, ce qui est cohérent si le fournisseur est toujours sélectionné avant upload.
- Il manque possiblement une entité spécifique `FactureFournisseur` si l'objectif dépasse les charges simples.
- Les statuts sont des `String`, donc risque de valeurs incohérentes.

### Recommandation

À moyen terme, introduire des enums Prisma pour les statuts critiques : facture, devis, document importé, ligne importée.

## 6. Maintenabilité

### Points positifs

- Dossiers bien séparés.
- Fonctions métier déjà amorcées dans `src/lib/business`.

### Points à améliorer

- Centraliser les routes.
- Centraliser les rôles.
- Centraliser les limites upload.
- Centraliser les formats MIME.
- Centraliser les calculs HT/TVA/TTC.

## 7. Évolutivité

Le projet peut évoluer, mais il faut clarifier le rôle du module fournisseurs :

Option A — Factures fournisseurs = charges enrichies.

- Plus simple.
- Suffisant si l'objectif est comptable/charge.
- Limité pour stock et lignes articles.

Option B — Factures fournisseurs = documents importés + lignes + validation.

- Plus adapté à l'OCR.
- Permet reconnaissance articles.
- Peut alimenter produits/prix/stock.
- Demande plus d'architecture.

Recommandation : partir sur l'option B, tout en générant une `Charge` uniquement après validation.

## 8. Refactoring prioritaire

Ordre recommandé :

1. Corriger les liens bloquants.
2. Corriger les redirects `/login` et `/dashboard`.
3. Ajouter `UPLOAD_DIR` propre.
4. Créer helper permissions.
5. Modifier upload pour créer un `DocumentImporte` en BDD.
6. Ajouter page de validation import.
7. Ajouter OCR.
8. Ajouter intégration stock/prix.

## 9. Préparation production

### À faire avant mise en production

- Remplacer tous les chemins locaux par variables d'environnement.
- Configurer `NEXTAUTH_URL` avec le vrai domaine.
- Configurer `NEXTAUTH_SECRET` robuste.
- Vérifier la taille maximale acceptée par reverse proxy.
- Stocker les fichiers dans un dossier persistant hors code source.
- Ajouter stratégie de sauvegarde des fichiers uploadés.
- Ajouter logs serveur propres.
- Vérifier permissions OS du dossier upload.
- Prévoir nettoyage des imports rejetés.

### Références observées

Les références à `localhost` sont présentes dans `.env.example`, `README.md` et un script Prisma, ce qui est normal pour le développement. Elles ne doivent pas être utilisées dans le code runtime production.

