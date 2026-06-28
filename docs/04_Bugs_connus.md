# 04_Bugs_connus.md — Suivi des anomalies FacturApp

Dernière mise à jour : 28/06/2026

## BUG-001 — 404 sur Nouvelle facture fournisseur

### Statut

Ouvert.

### Symptôme

Depuis :

```txt
/factures-fournisseurs
```

Le clic sur **Nouvelle facture** mène à une page 404.

### Cause identifiée

Le bouton pointe vers :

```txt
/charges/nouveau
```

Or la route existante est :

```txt
/factures-fournisseurs/nouveau
```

Il n'existe pas de :

```txt
src/app/(dashboard)/charges/nouveau/page.tsx
```

### Correction

Dans :

```txt
src/app/(dashboard)/factures-fournisseurs/page.tsx
```

remplacer :

```tsx
href="/charges/nouveau"
```

par :

```tsx
href="/factures-fournisseurs/nouveau"
```

## BUG-002 — Redirect vers `/login` inexistant

### Statut

Ouvert.

### Symptôme

La page d'import fournisseur redirige vers `/login` si l'utilisateur n'est pas connecté.

### Cause

La route de connexion réelle est :

```txt
/connexion
```

### Correction

Dans :

```txt
src/app/(dashboard)/factures-fournisseurs/nouveau/page.tsx
```

remplacer :

```tsx
redirect('/login')
```

par :

```tsx
redirect('/connexion')
```

## BUG-003 — Redirect/lien vers `/dashboard` inexistant

### Statut

Ouvert.

### Symptôme

Plusieurs liens ou redirects utilisent `/dashboard`.

### Cause

Le dashboard est probablement exposé via :

```txt
/
```

car le fichier est :

```txt
src/app/(dashboard)/page.tsx
```

### Correction

Remplacer les redirections `/dashboard` par `/`, ou créer explicitement une route `/dashboard`.

Recommandation actuelle : remplacer par `/`.

## BUG-004 — Chemin upload Windows codé en dur

### Statut

Ouvert.

### Symptôme

La route d'upload contient un fallback local :

```ts
C:\Users\Berrada\Documents\facturapp_uploads
```

### Risque

- Non portable.
- Peut échouer en production Linux.
- Peut exposer des chemins locaux.

### Correction recommandée

Utiliser :

```ts
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
```

## BUG-005 — Import `getToken` inutilisé

### Statut

Ouvert.

### Fichier

```txt
src/app/api/factures-fournisseurs/upload/route.ts
```

### Cause

`getToken` est importé mais non utilisé.

### Correction

Supprimer l'import pour éviter warnings et confusion.

## BUG-006 — Upload ne crée pas encore DocumentImporte

### Statut

À traiter pour suite OCR.

### Symptôme

Le fichier est écrit sur disque, mais l'import n'est pas persisté dans la table `documents_importes`.

### Impact

Impossible de suivre proprement :

- statut OCR ;
- texte extrait ;
- données extraites ;
- lignes détectées ;
- validation ;
- rejet.

### Correction recommandée

Créer un `prisma.documentImporte.create()` dans la route upload.

## BUG-007 — Module factures fournisseurs affiche actuellement des charges

### Statut

Choix d'architecture à trancher.

### Description

La page `/factures-fournisseurs` récupère :

```ts
prisma.charge.findMany()
```

Cela peut être acceptable provisoirement, mais le module OCR devrait plutôt s'appuyer sur `DocumentImporte` puis créer une charge/facture fournisseur après validation.

