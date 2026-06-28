# 05_Feuille_de_route.md — Roadmap FacturApp

Dernière mise à jour : 28/06/2026

## Phase 0 — Stabilisation immédiate

Objectif : supprimer les erreurs bloquantes et incohérences de routes.

Tâches :

- corriger le lien Nouvelle facture fournisseur ;
- remplacer `/login` par `/connexion` ;
- remplacer `/dashboard` par `/` ou créer route dédiée ;
- rendre `UPLOAD_DIR` portable ;
- nettoyer imports inutilisés ;
- vérifier que le build passe.

Critère de réussite :

```txt
/factures-fournisseurs -> fonctionne
/factures-fournisseurs/nouveau -> fonctionne
upload fichier autorisé -> réponse succès
```

## Phase 1 — Upload fournisseur propre

Objectif : transformer l'upload en vrai objet métier traçable.

Tâches :

- créer `DocumentImporte` au moment de l'upload ;
- enregistrer fournisseur, utilisateur, nom original, nom stocké, chemin, MIME, taille ;
- retourner `documentId` ;
- afficher l'historique des documents importés ;
- ajouter statut : brouillon / en_traitement / valide / rejete.

Critère de réussite :

Chaque upload apparaît dans la BDD et peut être retrouvé dans une liste.

## Phase 2 — OCR

Objectif : extraire le texte de la facture fournisseur.

Tâches :

- choisir le moteur OCR ;
- extraire le texte du PDF si possible ;
- appliquer OCR image si PDF scanné ;
- stocker le résultat dans `texteOcr` ;
- stocker un premier JSON dans `donneesExtraites`.

Critère de réussite :

Une facture importée affiche un texte brut exploitable.

## Phase 3 — Extraction structurée

Objectif : transformer le texte OCR en données métier.

Données à extraire :

- fournisseur ;
- numéro facture ;
- date facture ;
- total HT ;
- total TVA ;
- total TTC ;
- lignes article ;
- quantités ;
- prix unitaires ;
- TVA ;
- références détectées.

Critère de réussite :

Le système propose une pré-saisie cohérente à partir du document.

## Phase 4 — Écran de validation

Objectif : donner le contrôle à l'utilisateur avant intégration.

Tâches :

- page détail import ;
- affichage du fichier ;
- affichage OCR ;
- formulaire de correction ;
- mapping lignes vers produits existants ;
- création produit si inconnu ;
- validation/rejet.

Critère de réussite :

L'utilisateur peut corriger une facture fournisseur avant insertion définitive.

## Phase 5 — Intégration BDD métier

Objectif : alimenter les modules existants.

Tâches :

- créer une charge ou facture fournisseur validée ;
- créer les lignes importées ;
- mettre à jour prix d'achat ;
- préparer intégration stock si validée ;
- journaliser l'action.

Critère de réussite :

Après validation, la facture fournisseur impacte les modules concernés.

## Phase 6 — Stock

Objectif : connecter achats fournisseurs et stock.

À confirmer selon spécification stock.

Tâches possibles :

- mouvements de stock entrants ;
- quantité disponible ;
- historique par produit ;
- valorisation ;
- alerte seuil ;
- lien achat -> stock -> vente.

## Phase 7 — Production

Objectif : rendre l'application déployable proprement.

Tâches :

- variables environnement complètes ;
- dossier upload persistant ;
- sauvegardes ;
- logs ;
- sécurité routes API ;
- reverse proxy ;
- documentation installation ;
- tests minimum.

