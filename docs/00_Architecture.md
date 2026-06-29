# 00 — Architecture FacturApp

Dernière mise à jour : 2026-06-28

## 1. Objectif du projet

FacturApp est l'application web TypeScript / Next.js destinée à reprendre progressivement les fonctions métier actuellement assurées par l'application historique VB6. L'application couvre la gestion commerciale, la facturation, les devis, les avoirs, les fournisseurs, les charges, les paiements et le nouveau module d'import des factures fournisseurs avec OCR.

Le principe directeur reste : faire évoluer FacturApp progressivement sans casser l'existant VB6.

## 2. Architecture générale

```text
Application VB6 existante
        │
        │ Base opérationnelle historique
        ▼
MariaDB
        │
        │ Synchronisation VB6 → FacturApp
        ▼
PostgreSQL FacturApp
        │
        ├── Next.js / TypeScript
        ├── Prisma ORM
        ├── NextAuth
        ├── Module facturation
        ├── Module fournisseurs / charges
        └── Module documents importés / OCR
```

## 3. Rôle des bases de données

### MariaDB

MariaDB reste la base de vérité tant que l'application VB6 tourne à 100 % en production.

Elle conserve les données métier historiques et opérationnelles.

### PostgreSQL

PostgreSQL est la base utilisée par FacturApp TS. Elle est alimentée par synchronisation depuis MariaDB et contient aussi des tables spécifiques au développement web, notamment `documents_importes` pour l'import documentaire et l'OCR.

Cette séparation permet de développer FacturApp sans perturber l'application VB6.

## 4. Frontend

FacturApp utilise Next.js avec l'App Router.

Organisation fonctionnelle :

```text
src/app
├── (auth)
├── (dashboard)
│   ├── factures
│   ├── devis
│   ├── avoirs
│   ├── fournisseurs
│   ├── charges
│   └── factures-fournisseurs
└── api
    ├── auth
    ├── admin
    └── factures-fournisseurs
```

Les pages métier sont protégées par session et par rôle.

## 5. Backend applicatif

Le backend est assuré par les routes API Next.js.

Pour le module factures fournisseurs :

```text
/api/factures-fournisseurs/upload
/api/factures-fournisseurs/ocr/[id]
```

La route `upload` gère l'import physique du document et la création de la ligne `DocumentImporte`.
La route `ocr/[id]` déclenche le traitement OCR local via Python / PaddleOCR puis met à jour PostgreSQL.

## 6. Stockage documentaire

Les fichiers PDF et images importés ne sont pas stockés dans le projet Next.js.

Chemin retenu en production Windows :

```text
C:/serveur/Factures_achats
```

Arborescence retenue :

```text
C:/serveur/Factures_achats
└── YYYY
    └── MM
        └── date_numeroFacture_fournisseur_hash.pdf
```

Exemple :

```text
C:/serveur/Factures_achats/2026/06/20260628_sans-numero_casinfo_cde99d5b.pdf
```

Le chemin complet n'est pas codé en dur dans le code applicatif. Il passe par la variable d'environnement `UPLOAD_DIR`.

## 7. Architecture OCR

Décision retenue : architecture hybride.

Implémentation actuelle :

```text
Next.js
  │
  ├── Upload PDF/image
  │
  ▼
DocumentImporte créé en PostgreSQL
  │
  ▼
API OCR Next.js
  │
  ▼
Service Python local
  │
  ▼
PaddleOCR
  │
  ▼
Texte OCR + JSON stockés dans PostgreSQL
```

Le moteur actuel est local : Python + PaddleOCR.

L'architecture doit rester compatible avec un futur provider cloud : Azure Document Intelligence, Google Document AI, Mistral OCR ou autre.

Le traitement OCR ne stocke plus uniquement le texte brut.  
Il conserve aussi les coordonnées PaddleOCR et exploite ces coordonnées pour extraire les lignes articles des factures fournisseurs.

Les lignes extraites restent à l'état de pré-validation :
- elles sont affichées dans l'interface ;
- elles sont éditables côté frontend ;
- elles ne créent pas encore de facture fournisseur réelle ;
- elles n'impactent pas encore le stock.

## 8. Dossier OCR

Organisation retenue :

```text
ocr/
├── .venv/              # non versionné
├── ocr_document.py     # script OCR local
├── requirements.txt    # dépendances Python
└── README.md           # documentation d'installation OCR
```

Le dossier `.venv` est ignoré par Git.

## 9. Variables d'environnement importantes

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
UPLOAD_DIR=
OCR_PROVIDER=local
PYTHON_OCR_PATH=
OCR_SCRIPT_PATH=
OCR_API_URL=
OCR_API_KEY=
```

## 10. Principe d'évolution

FacturApp doit évoluer par étapes :

1. stabiliser une fonctionnalité ;
2. tester localement ;
3. valider le build ;
4. pousser Git ;
5. mettre à jour la documentation ;
6. déployer ensuite en production.

