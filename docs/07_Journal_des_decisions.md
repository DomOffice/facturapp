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

## 2026-06-29 — Sprint 3.4 ArticleBuilder OCR

Décision :
La logique `ligneArticleSurDeuxLignes` ne doit pas être conservée comme principe central.

Motif :
Une ligne article peut occuper une, deux ou plusieurs lignes OCR selon le fournisseur, le scan ou le modèle de facture.

Nouvelle orientation :
Créer une logique ArticleBuilder simple :
- accumuler les lignes OCR ;
- vérifier si l’article est complet ;
- construire la ligne article lorsque TVA, PU, quantité et total sont identifiés.

Principe d’architecture :
- le moteur OCR ne connaît aucun fournisseur ;
- les drivers fournisseurs restent déclaratifs ;
- les fallbacks sont conservés ;
- l’interface éditable existante n’est pas modifiée.

## MAJ du 11/07/2026
Décision — TVA facultative sur les lignes importées

Motif :

certains documents fournisseurs, notamment des BL, ne présentent pas la TVA par article.

Conséquence :

une ligne peut être complète avec désignation, quantité, prix et total ;
l’absence de TVA génère une alerte, mais ne bloque plus l’extraction.
Décision — Conservation des fallbacks

Motif :

les coordonnées OCR ne suffisent pas pour tous les formats ;
le fallback séquentiel permet d’obtenir une V1 exploitable.

Conséquence :

profil
→ fallback générique
→ fallback texte
→ fallback tableau séquentiel
Décision — Validation avant création métier

Motif :

l’OCR ne doit jamais créer automatiquement une facture ou modifier le stock.

Conséquence :

les corrections sont d’abord enregistrées dans lignes_importees.
Décision — Produit facultatif

Motif :

une ligne OCR doit pouvoir être validée même lorsqu’aucun produit n’est trouvé.

Conséquence :

produitId renseigné → associee
produitId absent    → a_rapprocher
Décision — Le fournisseur influence mais ne bloque pas la recherche

Motif :

un produit peut être acheté auprès de plusieurs fournisseurs ;
les données synchronisées peuvent contenir un fournisseur principal différent.
Décision — Présélection automatique prudente

Motif :

les correspondances lexicales peuvent confondre des produits proches.

Conséquence :

les résultats faibles restent des propositions ;
la présélection exige un score élevé et une avance nette.
Décision — Mémoriser les choix humains

Motif :

le choix validé par l’utilisateur est plus fiable qu’une nouvelle recherche approximative.

Conséquence :

Sprint 4.2.3 introduit une association stable entre fournisseur, référence détectée et produit.
Décision — Création produit volontaire uniquement

Motif :

éviter les doublons provoqués par une mauvaise lecture OCR ou une désignation légèrement différente.

Conséquence :

aucun article ne sera créé automatiquement ;
l’utilisateur disposera d’une action explicite « Créer un article »

## MAJ du 24/07/2026
## 2026-07-24 — Drivers OCR documentaires déclaratifs

### Décision

Les drivers OCR fournisseurs peuvent désormais déclarer :

- les coordonnées des colonnes ;
- les marqueurs du tableau ;
- le type de document ;
- les motifs du numéro et de la date ;
- les motifs ICE et totaux ;
- les champs obligatoires pour la validation.

### Motif

Les factures et bons de livraison ne présentent pas les mêmes champs
et ne doivent pas être validés selon les mêmes règles.

### Conséquence

Le moteur générique ne contient plus de logique spécifique à Mechouar
ou CasInfo pour ces éléments.

## 2026-07-24 — Validation selon le type de document

### Décision

Les champs obligatoires sont configurables par driver.

### Motif

Un bon de livraison Mechouar peut présenter un net à payer sans afficher
séparément le total HT, la TVA ou l’ICE.

### Conséquence

L’absence de ces champs ne produit plus d’alertes injustifiées et ne
dégrade plus artificiellement la confiance OCR.

## 2026-07-24 — Rapprochement obligatoire avant validation

### Décision

Une ligne fournisseur doit être associée à un produit existant ou à un
nouveau produit avant la validation définitive.

### Motif

Éviter la création de lignes d’achat et de mouvements de stock sans
référence au catalogue interne.

### Suite prévue

Automatiser les propositions de rapprochement et mémoriser les choix
validés.