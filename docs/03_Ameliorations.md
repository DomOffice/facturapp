# 03_Ameliorations.md — Liste priorisée des améliorations

Dernière mise à jour : 28/06/2026

## Priorité P0 — Bloquants immédiats

### 1. Corriger le bouton Nouvelle facture fournisseur

Fichier :

```txt
src/app/(dashboard)/factures-fournisseurs/page.tsx
```

Remplacer :

```tsx
href="/charges/nouveau"
```

par :

```tsx
href="/factures-fournisseurs/nouveau"
```

### 2. Corriger les redirects obsolètes

Fichier :

```txt
src/app/(dashboard)/factures-fournisseurs/nouveau/page.tsx
```

Remplacer :

```tsx
redirect('/login')
```

par :

```tsx
redirect('/connexion')
```

Remplacer :

```tsx
redirect('/dashboard')
```

par :

```tsx
redirect('/')
```

### 3. Corriger les liens breadcrumb vers `/dashboard`

Comme `/dashboard` n'existe pas dans l'arborescence actuelle, remplacer les liens de retour dashboard par `/` ou créer une vraie route `/dashboard`.

Recommandation : utiliser `/`.

## Priorité P1 — Stabilisation module import fournisseur

### 4. Corriger le chemin upload par défaut

Le fallback actuel contient un chemin Windows codé en dur. Il faut utiliser :

```ts
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
```

Et ajouter dans `.env.example` :

```env
UPLOAD_DIR="./uploads"
```

### 5. Créer l'enregistrement `DocumentImporte` lors de l'upload

Actuellement, la route d'upload retourne le fichier mais ne crée pas d'entrée BDD. Le module OCR doit créer un `DocumentImporte` avec statut `brouillon` ou `en_traitement`.

### 6. Retourner `documentId` au composant React

La réponse API devrait contenir :

```json
{
  "success": true,
  "documentId": 123,
  "fichier": {...}
}
```

Ensuite, le bouton Continuer pourra rediriger vers :

```txt
/factures-fournisseurs/imports/123
```

ou :

```txt
/factures-fournisseurs/123/validation
```

## Priorité P2 — Sécurité et maintenabilité

### 7. Centraliser les permissions

Créer :

```txt
src/lib/auth/guards.ts
```

Avec des helpers :

```ts
requireUser()
requireRole(['ADMIN', 'SAISIE'])
```

### 8. Centraliser les routes

Créer :

```txt
src/lib/routes.ts
```

Exemples :

```ts
export const routes = {
  home: '/',
  connexion: '/connexion',
  facturesFournisseurs: '/factures-fournisseurs',
  nouvelleFactureFournisseur: '/factures-fournisseurs/nouveau',
}
```

### 9. Centraliser la configuration upload

Créer :

```txt
src/lib/config/upload.ts
```

Contenu : types MIME, taille max, extensions, dossier upload.

## Priorité P3 — OCR et validation métier

### 10. Ajouter étape OCR

Choisir moteur OCR :

- local : Tesseract ;
- cloud : Google Vision, Azure, AWS Textract ;
- hybride : extraction PDF texte + OCR seulement si nécessaire.

Recommandation : commencer par extraction PDF texte si le PDF contient du texte, puis OCR image si nécessaire.

### 11. Ajouter écran de validation

Objectif : ne jamais intégrer directement en BDD sans contrôle humain.

L'écran doit permettre de corriger :

- fournisseur ;
- numéro facture ;
- date ;
- totaux ;
- lignes ;
- correspondance produit ;
- TVA ;
- prix achat.

### 12. Intégration stock/prix

Après validation :

- créer une charge ou facture fournisseur ;
- créer lignes importées validées ;
- mettre à jour prix achat produit ;
- éventuellement mettre à jour stock si module stock confirmé.

## Priorité P4 — Production

### 13. Logs propres

Remplacer les `console.log` temporaires par une stratégie de logging.

### 14. Sauvegarde fichiers

Prévoir :

- dossier upload persistant ;
- sauvegarde automatique ;
- nettoyage des imports rejetés ;
- droits OS limités.

### 15. Tests minimaux

Créer des tests ou checklists pour :

- connexion ;
- upload fichier valide ;
- upload fichier trop lourd ;
- upload MIME interdit ;
- accès sans session ;
- accès rôle non autorisé ;
- création DocumentImporte.

