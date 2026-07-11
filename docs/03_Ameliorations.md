# 03 — Améliorations FacturApp

Dernière mise à jour : 2026-06-28

## 1. Améliorations terminées

### Module factures fournisseurs — import documentaire

- Upload PDF / JPEG / PNG.
- Contrôle taille maximale.
- Contrôle type MIME.
- Stockage hors projet dans `UPLOAD_DIR`.
- Arborescence par année et mois.
- Nommage automatique du fichier.
- Création d'une ligne `DocumentImporte`.
- Affichage côté interface après upload.

### Module OCR

- Installation de PaddleOCR local.
- Création du dossier `ocr/`.
- Script `ocr_document.py` fonctionnel.
- Dépendances Python dans `requirements.txt`.
- Route API OCR Next.js.
- Lancement OCR depuis l'interface web.
- Mise à jour du statut `ocr_termine`.
- Remplissage du texte OCR en base.

### Module OCR — extraction structurée

- Extraction des champs principaux depuis OCR :
  - fournisseur ;
  - numéro de facture ;
  - date facture ;
  - ICE fournisseur ;
  - total HT ;
  - TVA ;
  - total TTC ;
  - devise ;
  - confiance globale ;
  - alertes.
- Extraction des lignes articles depuis les coordonnées PaddleOCR.
- Stockage des lignes dans `donnees_extraites.extraction.lignes`.
- Ajout d'une confiance par ligne.
- Affichage des lignes articles dans l'interface.
- Cellules du tableau rendues éditables côté interface, sans insertion BDD à ce stade.

### Configuration projet

- `.gitignore` adapté au Python, OCR, uploads et environnements.
- `.env.example` enrichi pour l'OCR et le stockage.
- Documentation technique déplacée dans `docs/`.

## 2. Priorité haute

### Extraction structurée des données OCR

Objectif : transformer le texte OCR en champs exploitables.

Champs cibles :

- fournisseur reconnu ;
- numéro facture ;
- date facture ;
- ICE fournisseur ;
- total HT ;
- TVA ;
- total TTC ;
- lignes article ;
- devise ;
- conditions éventuelles.

### Profils OCR fournisseurs

### Moteur OCR lignes articles — ArticleBuilder

Objectif : remplacer la logique fixe “article sur une ou deux lignes” par une logique générique.

Principe :
- lire les blocs OCR ligne par ligne ;
- accumuler les lignes d’un article en cours ;
- considérer l’article comme complet uniquement quand référence/désignation, TVA, PU, quantité et total sont détectés ;
- permettre les désignations sur une, deux ou plusieurs lignes.

Les drivers fournisseurs restent simples et ne doivent pas contenir de logique métier.

### Formulaire de validation

Créer une page de validation permettant à l'utilisateur de vérifier et corriger les données extraites avant création de la facture fournisseur.

### Création de la facture fournisseur

Après validation, créer la facture fournisseur définitive en base.

## 3. Priorité moyenne

### Détection des doublons

Ajouter un checksum SHA-256 pour éviter l'import multiple du même PDF.

### Amélioration des statuts

Centraliser les statuts dans une constante TypeScript.

### File de traitement OCR

Prévoir une file si plusieurs documents sont traités simultanément.

### Journalisation OCR

Stocker :

- date de lancement ;
- durée ;
- moteur utilisé ;
- message d'erreur éventuel.

## 4. Priorité basse

### OCR cloud optionnel

Ajouter un connecteur cloud compatible avec `OCR_PROVIDER`.

### Prévisualisation PDF

Afficher le PDF à gauche et les champs extraits à droite.

### Recherche documentaire

Permettre de rechercher dans les textes OCR.

### Archivage documentaire

Mettre en place un cycle : brouillon → validé → archivé.

## 5. Améliorations transversales

- Centraliser les contrôles d'autorisation.
- Créer des services applicatifs métier.
- Mettre en place des tests sur les routes critiques.
- Ajouter une documentation d'installation serveur.
- Documenter la synchronisation MariaDB → PostgreSQL.

## MAJ du 11/07/2026
### Améliorations terminées 
- Extraction OCR
- extraction fournisseur, numéro, date, ICE et totaux ;
- extraction des lignes article ;
- coordonnées et confiance OCR ;
- ArticleBuilder générique ;
- drivers fournisseurs déclaratifs ;
- fallback générique ;
- fallback texte ;
- extraction de BL sans TVA par ligne ;
- diagnostic OCR ;
- qualité A/B/C/D ;
- édition des cellules.

### Validation
- endpoint valider-lignes/[id] ;
- remplacement transactionnel des anciennes lignes ;
- création de LigneImportee ;
- conservation des corrections ;
- association facultative à un produit ;
- statuts associee et a_rapprocher.

### Rapprochement
- endpoint de recherche produit ;
- recherche par référence et désignation ;
- score de pertinence ;
- bonus fournisseur non bloquant ;
- sélection manuelle ;
- option permanente « À rapprocher » ;
- propositions automatiques initiales.

### Nouvelle priorité haute
- mémorisation des associations fournisseur–référence–produit ;
- réutilisation automatique des associations ;
- création d’un produit depuis une ligne OCR ;
- création réelle de la facture fournisseur ;
- impact stock dans une étape séparée.