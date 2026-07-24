# 06 — Conventions de code FacturApp

Dernière mise à jour : 2026-06-28

## 1. Principes généraux

- Ne pas casser l'existant.
- Privilégier les évolutions incrémentales.
- Garder MariaDB comme base de vérité tant que VB6 reste opérationnel.
- Ne pas mélanger logique UI, logique métier et accès disque.
- Documenter chaque décision importante.

## 2. TypeScript / Next.js

### Pages

Les pages doivent rester lisibles et déléguer la logique complexe à des composants ou services.

### Routes API

Les routes API doivent :

- vérifier la session ;
- vérifier les rôles ;
- valider les entrées ;
- retourner des erreurs explicites ;
- ne jamais exposer de chemin physique complet inutilement.

### Redirections

Utiliser des chemins relatifs :

```ts
redirect('/connexion')
redirect('/')
```

Ne jamais utiliser `http://localhost:3000` dans le code applicatif.

## 3. Rôles

Les rôles sont à traiter en minuscules :

```ts
admin
saisie
consultation
```

Recommandation : centraliser les contrôles d'autorisation dans un helper.

## 4. Prisma

- Utiliser Prisma pour PostgreSQL FacturApp.
- Ne jamais utiliser Prisma pour modifier MariaDB VB6.
- Les tables propres à FacturApp peuvent exister uniquement dans PostgreSQL.
- Valider le schéma avant commit :

```bash
npx prisma validate
```

## 5. Fichiers et uploads

Les documents métier ne doivent pas être stockés dans :

```text
public/
src/
```

Ils doivent être stockés hors projet via :

```env
UPLOAD_DIR=C:/serveur/Factures_achats
```

Le code doit stocker de préférence un chemin relatif en base.

## 6. OCR

### Organisation

```text
ocr/
├── .venv/              # ignoré Git
├── ocr_document.py
├── requirements.txt
└── README.md
```

### Règles

- Aucun environnement virtuel ne doit être versionné.
- Les modèles PaddleOCR téléchargés localement ne doivent pas être versionnés.
- Le frontend ne doit pas appeler Python directement.
- Next.js appelle Python via une route API serveur.
- Les chemins Python doivent venir de `.env`.

## 7. Variables d'environnement

Toujours documenter dans `.env.example` les variables nécessaires.

Ne jamais versionner :

```text
.env
.env.local
.env.production.local
```

## 8. Git

Avant chaque push important :

```bash
npm run build
npx prisma validate
git status
```

Vérifier que les éléments suivants ne sont pas inclus :

- `.env` ;
- `.venv` ;
- fichiers uploadés ;
- caches PaddleOCR ;
- `.next` ;
- `node_modules`.

## 9. Documentation

Le dossier `docs/` doit être mis à jour à chaque étape importante.

Documents de référence :

- `00_Architecture.md`
- `01_Audit_Technique.md`
- `02_Base_de_donnees.md`
- `03_Ameliorations.md`
- `04_Bugs_connus.md`
- `05_Feuille_de_route.md`
- `06_Conventions_de_code.md`
- `07_Journal_des_decisions.md`

## MAJ du 11/07/2026
- Une recherche approximative ne doit jamais produire silencieusement une écriture métier définitive.
- Une association automatique doit rester corrigeable par l’utilisateur.
- Toute migration Prisma doit être accompagnée de :
  npx prisma format
  npx prisma validate
  npx prisma migrate dev
  npm run build

  ## MAJ du 24/07/2026
  ## Conventions du moteur OCR

- Aucun `if` fondé sur le nom d’un fournisseur dans le moteur générique.
- Les particularités fournisseurs sont placées dans les drivers.
- Les drivers restent déclaratifs et sans logique métier complexe.
- Toute option de driver doit posséder un comportement générique par défaut.
- Les regex globales doivent être réinstanciées avant utilisation afin
  d’éviter les effets de bord liés à `lastIndex`.
- Les patches doivent rester petits et testables.
- Après chaque modification :
  - lancer `npx tsc --noEmit` ;
  - tester au moins un document Mechouar ;
  - tester au moins un document CasInfo.