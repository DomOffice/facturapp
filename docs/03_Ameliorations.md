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

Objectif : adapter l'extraction des lignes selon la structure de facture du fournisseur sélectionné.

Première approche :
- conserver un profil générique ;
- ajouter un profil CASINFO validé ;
- prévoir un fallback générique ;
- préparer plus tard l'apprentissage depuis les corrections utilisateur.

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

