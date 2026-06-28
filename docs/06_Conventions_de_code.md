# 06_Conventions_de_code.md — Conventions de développement FacturApp

Dernière mise à jour : 28/06/2026

## 1. Philosophie générale

- Ne pas casser l'existant.
- Avancer par petites modifications testables.
- Corriger les bugs bloquants avant les refactorings lourds.
- Documenter les choix structurants.
- Préférer la clarté à l'abstraction excessive.

## 2. Nommage des routes

### Routes publiques applicatives

Utiliser des chemins relatifs, jamais des URLs absolues avec `localhost`.

Correct :

```ts
redirect('/connexion')
router.push('/factures-fournisseurs')
fetch('/api/factures-fournisseurs/upload')
```

Incorrect :

```ts
redirect('http://localhost:3000/connexion')
fetch('http://localhost:3000/api/...')
```

### Convention `nouveau` / `nouvelle`

À stabiliser :

- garder `/factures/nouvelle` si déjà utilisé ;
- utiliser `/factures-fournisseurs/nouveau` comme route existante ;
- éviter d'ajouter des variantes inutiles.

## 3. Redirections

Route connexion officielle :

```txt
/connexion
```

Dashboard actuel :

```txt
/
```

Éviter :

```txt
/login
/dashboard
```

sauf si ces routes sont explicitement créées.

## 4. Authentification et permissions

Ne pas dupliquer la logique de rôle dans chaque page.

Objectif recommandé :

```txt
src/lib/auth/guards.ts
```

Avec :

```ts
requireUser()
requireRole(['ADMIN', 'SAISIE'])
```

Rôles observés :

```txt
ADMIN
SAISIE
```

Les comparaisons de rôles doivent être normalisées en majuscules.

## 5. Appels API

Depuis le client React :

```ts
fetch('/api/...')
```

Ne jamais utiliser `localhost` dans le code client.

Toujours gérer :

- réponse non OK ;
- erreur réseau ;
- message utilisateur ;
- état de chargement.

## 6. Upload fichiers

Centraliser :

- taille max ;
- MIME autorisés ;
- extensions ;
- dossier de stockage.

Recommandation :

```txt
src/lib/config/upload.ts
```

Formats actuels :

```txt
PDF, JPEG, PNG
```

Taille actuelle :

```txt
10 Mo
```

## 7. Base de données

- Toute modification métier durable doit passer par Prisma.
- Éviter les valeurs de statut libres si possible.
- Préférer enums ou constantes partagées.
- Utiliser des transactions pour les opérations multi-tables.

Exemple : validation facture fournisseur OCR.

```ts
await prisma.$transaction(async (tx) => {
  // créer charge/facture fournisseur
  // créer lignes
  // mettre à jour document
  // journaliser
})
```

## 8. Gestion des montants

- Toujours garder les calculs HT/TVA/TTC côté serveur pour la validation finale.
- Le client peut prévisualiser mais ne doit pas être source de vérité.
- Convertir correctement les `Decimal` Prisma pour affichage.

## 9. Composants React

- Les pages serveur chargent les données.
- Les composants `page-client.tsx` gèrent l'interactivité.
- Les formulaires réutilisables restent dans `src/components/forms`.
- Les composants OCR restent dans `src/components/ocr`.

## 10. Commentaires

Utiliser les commentaires pour expliquer une décision métier ou technique, pas pour décrire une ligne évidente.

À éviter :

```ts
// Added null check...
// Changed link...
```

À préférer :

```ts
// Les imports fournisseurs doivent être validés avant impact stock.
```

## 11. Production

Avant production :

- pas de chemin local utilisateur ;
- pas de secret dans le code ;
- pas d'URL localhost en runtime ;
- variables `.env` complètes ;
- uploads hors dépôt ;
- droits fichiers limités ;
- sauvegardes prévues.

## 12. Méthode de travail avec l'assistant

Pour chaque évolution :

1. fournir le lien GitHub ou ZIP à jour ;
2. analyser la branche concernée ;
3. identifier fichiers impactés ;
4. proposer patch ou code précis ;
5. tester localement ;
6. mettre à jour ces documents si nécessaire.

