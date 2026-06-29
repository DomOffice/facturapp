# 05 — Feuille de route FacturApp

Dernière mise à jour : 2026-06-28

## 1. Vision

FacturApp doit devenir progressivement l'application principale de gestion commerciale, en remplacement ou complément de l'application VB6 existante.

Le développement doit rester incrémental : chaque étape doit être testée, documentée et validée avant la suivante.

## 2. État actuel

### Réalisé

- Architecture Next.js / TypeScript / Prisma.
- PostgreSQL local FacturApp.
- Synchronisation VB6 → PostgreSQL disponible.
- Module factures fournisseurs accessible.
- Upload PDF/image validé.
- Stockage hors projet validé.
- Table `documents_importes` créée.
- OCR PaddleOCR local validé.
- OCR lancé depuis interface web.
- Texte OCR stocké en base.
- Documentation technique structurée dans `docs/`.

## 3. Roadmap module factures fournisseurs

### Phase 1 — Upload documentaire

Statut : terminé.

- Sélection fournisseur.
- Upload PDF / image.
- Stockage dans `UPLOAD_DIR`.
- Création `DocumentImporte`.

### Phase 2 — OCR

Statut : terminé.

- Service Python local.
- PaddleOCR.
- Route API OCR.
- Lancement depuis l'interface.
- Stockage du texte OCR.

### Phase 3 — Extraction intelligente

Statut : en cours avancé.

Réalisé :
- extraction des champs principaux ;
- extraction des lignes articles depuis les coordonnées PaddleOCR ;
- confiance par ligne ;
- affichage éditable des lignes dans l'interface.

Reste à faire :
- ArticleBuilder pour gérer les désignations sur une ou plusieurs lignes ;
- détection automatique des colonnes à partir des en-têtes ;
- drivers fournisseurs légers ;
- sauvegarde des corrections utilisateur ;
- rapprochement avec les articles existants.
### Phase 4 — Validation utilisateur

Statut : démarrée.

Un premier tableau éditable existe côté interface.  
Il reste à persister les corrections, gérer les validations et préparer la création réelle de la facture fournisseur.

### Phase 5 — Création facture fournisseur

Statut : à faire.

Créer la facture fournisseur finale après validation.

### Phase 6 — Archivage et consultation

Statut : à faire.

Permettre de rechercher et consulter les documents importés.

## 4. Roadmap technique

### Court terme

- Ajouter extraction structurée par règles.
- Créer une page validation OCR.
- Centraliser les statuts documents.
- Mettre à jour les documents de référence.

### Moyen terme

- Ajouter checksum anti-doublon.
- Ajouter une file d'attente OCR.
- Ajouter logs d'exécution OCR.
- Ajouter prévisualisation PDF.

### Long terme

- Ajouter provider OCR cloud optionnel.
- Ajouter IA d'interprétation documentaire.
- Généraliser le moteur documentaire à d'autres pièces : BL, BC, devis, justificatifs.
- Préparer migration progressive hors VB6.

## 5. Jalons proposés

| Jalons | Statut |
|---|---|
| Import PDF/image | Terminé |
| OCR local PaddleOCR | Terminé |
| Extraction champs facture | Terminé |
| Validation utilisateur | À faire |
| Création facture fournisseur | À faire |
| Détection doublons | À faire |
| File OCR | À faire |
| OCR cloud hybride | Optionnel futur |
| Extraction lignes articles OCR | En cours avancé |
| ArticleBuilder OCR | À faire |
| Drivers fournisseurs OCR | En cours |
