# 07 — Journal des décisions FacturApp

Dernière mise à jour : 2026-06-28

Ce document trace les décisions d'architecture importantes du projet FacturApp.

## 2026-06-28 — MariaDB reste la base de vérité

### Décision

MariaDB reste la base opérationnelle principale tant que l'application VB6 tourne à 100 %.

### Motif

L'application VB6 est actuellement stable et utilisée en production. FacturApp TS est encore en développement.

### Conséquence

La synchronisation se fait dans le sens :

```text
VB6 / MariaDB → FacturApp / PostgreSQL
```

## 2026-06-28 — PostgreSQL est la base FacturApp TS

### Décision

FacturApp utilise PostgreSQL comme base applicative.

### Motif

Cela permet de développer les nouveaux modules web sans modifier directement la base MariaDB de production.

### Conséquence

Certaines tables peuvent exister uniquement dans PostgreSQL, par exemple `documents_importes`.

## 2026-06-28 — `documents_importes` est propre à FacturApp TS

### Décision

La table `documents_importes` n'est pas développée côté VB6.

### Motif

Elle sert au module web d'import PDF/OCR et n'est pas nécessaire à l'application historique.

### Conséquence

Elle doit être protégée des processus de synchronisation qui pourraient écraser PostgreSQL.

## 2026-06-28 — Stockage documentaire hors projet

### Décision

Les PDF et images importés sont stockés hors du dossier Next.js.

Chemin production Windows :

```text
C:/serveur/Factures_achats
```

### Motif

Éviter de mélanger code applicatif et documents métier.

### Conséquence

Le projet peut être mis à jour ou redéployé sans toucher aux fichiers importés.

## 2026-06-28 — Arborescence année/mois

### Décision

Les documents sont rangés par année et par mois.

```text
UPLOAD_DIR/YYYY/MM/fichier.pdf
```

### Motif

Éviter un dossier unique contenant des milliers de fichiers.

## 2026-06-28 — Nommage automatique des fichiers

### Décision

Le nom stocké suit une logique :

```text
date_numeroFacture_fournisseur_hash.pdf
```

Lorsque le numéro n'est pas encore connu :

```text
date_sans-numero_fournisseur_hash.pdf
```

### Motif

Le numéro réel peut n'être connu qu'après OCR.

## 2026-06-28 — OCR hybride

### Décision

L'architecture OCR est hybride.

Implémentation actuelle : PaddleOCR local.

Évolution future possible : provider cloud.

### Motif

Conserver la confidentialité et limiter les coûts, tout en gardant la possibilité d'améliorer la qualité plus tard via une API spécialisée.

## 2026-06-28 — OCR en Python séparé de Next.js

### Décision

Le moteur OCR est placé dans un dossier `ocr/` séparé.

### Motif

L'écosystème OCR est plus mature en Python qu'en Node.js.

### Conséquence

Next.js lance le script Python depuis une route API serveur.

## 2026-06-28 — PaddlePaddle figé en 3.2.2

### Décision

Utiliser `paddlepaddle==3.2.2`.

### Motif

Une version plus récente a provoqué une erreur oneDNN/PIR sous Windows CPU.

### Conséquence

La version doit rester figée dans `ocr/requirements.txt`.

## 2026-06-28 — Documentation intégrée au dépôt

### Décision

Les documents techniques sont placés dans `docs/`.

### Motif

Garder l'historique et le contexte technique avec le code source.

### Conséquence

Les fichiers `.md` doivent être mis à jour à chaque évolution significative.

# 07 — Journal des décisions FacturApp

Dernière mise à jour : 2026-06-29

## 2026-06-29 — Sprint 3 OCR lignes articles

Décision :
Le module factures fournisseurs extrait désormais les lignes articles à partir des coordonnées PaddleOCR, et non uniquement depuis le texte OCR brut.

Motif :
Le texte brut ne conserve pas suffisamment la structure des tableaux. Les coordonnées X/Y permettent de reconstruire les colonnes : désignation, TVA, PU TTC, quantité et total TTC.

Implémentation actuelle :
- extraction des lignes dans `src/lib/ocr/extract-facture-fournisseur.ts` ;
- stockage dans `donnees_extraites.extraction.lignes` ;
- affichage dans `src/components/ocr/EditableInvoiceLines.tsx` ;
- badge de confiance dans `src/components/ocr/ConfidenceBadge.tsx`.

Limite connue :
La logique actuelle fonctionne sur CASINFO et doit être généralisée avec des profils OCR fournisseurs.

Décision suivante :
Créer un système simple de profils fournisseurs :
- profil générique par défaut ;
- profil CASINFO ;
- fallback si aucun profil spécifique n'existe.