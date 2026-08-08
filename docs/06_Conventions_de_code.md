# 06 — Conventions de code FacturApp

Dernière mise à jour : 2026-08-08

## 1. Principe général

Faire des modifications petites, ciblées et testables. Éviter les réécritures massives sans nécessité.

## 2. TypeScript

- conserver le typage strict ;
- éviter `any` sauf justification ;
- préférer les fonctions utilitaires partagées aux duplications ;
- lancer `npx tsc --noEmit` après une évolution significative.

## 3. Prisma

- ne jamais supposer que `prisma generate` modifie la base ;
- valider avec `npx prisma validate` ;
- analyser toute évolution de `schema.prisma` avant déploiement ;
- ne pas lancer de commande destructive sur une base non identifiée.

## 4. OCR

- moteur générique d’abord ;
- drivers simples et déclaratifs ;
- conserver les fallbacks ;
- aucune création automatique de produit ;
- aucune modification silencieuse de TVA produit existante ;
- la validation humaine garde la priorité.

## 5. Règles métier fournisseurs

Les règles TVA / stock doivent être centralisées côté serveur et déterminées par le type de document / profil OCR.

Ne pas réimplémenter ces règles uniquement dans le frontend.

## 6. Montants

Pour l’affichage comptable français :

```text
1 250,00
25 000,50
1 000 000,00
```

Réutiliser l’utilitaire existant de formatage ; ne pas créer plusieurs fonctions concurrentes.

## 7. Git

Avant commit :

```powershell
git status
npx tsc --noEmit
```

Lors d’un déploiement serveur :

```powershell
git fetch origin
git log --oneline HEAD..origin/main
git pull --ff-only origin main
```

Ne pas versionner :

- `.env` ;
- `node_modules` ;
- `.next` ;
- environnements Python ;
- caches générés comme `tsconfig.tsbuildinfo`.

## 8. Documentation

Toute évolution importante doit mettre à jour au minimum :

- architecture si la structure change ;
- base de données si un modèle change ;
- journal des décisions si une règle métier est décidée ;
- bugs connus si une limite est acceptée ;
- feuille de route si une priorité change.
