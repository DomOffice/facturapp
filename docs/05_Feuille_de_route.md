# 05 — Feuille de route FacturApp

Dernière mise à jour : 2026-08-17

## Sprint clôturé — Stock / synchronisation / facturation / PDF

- [x] Synchroniser PostgreSQL PROD → MariaDB.
- [x] Étendre la synchronisation au stock produit.
- [x] Valider la synchronisation par une facture réelle créée dans FacturApp.
- [x] Séparer explicitement PostgreSQL DEV et PROD.
- [x] Copier PROD vers DEV pour des tests cohérents.
- [x] Permettre la modification manuelle du stock dans `/produits`.
- [x] Améliorer la saisie article dans `/factures/nouvelle`.
- [x] Refaire la présentation PDF facture sur la base du modèle VB6.
- [x] Ajouter vraies références et unités.
- [x] Intégrer la ventilation TVA au bloc TOTAL MAD.
- [x] Gérer les factures multipages.
- [x] Éviter les sauts de page inutiles lorsque les totaux tiennent encore.
- [x] Déployer les changements sur le serveur via Git/PM2.

## Phase suivante — Stabilisation exploitation + extension métier

### P0 — Exploitation serveur

- [ ] Valider la tâche Windows `DomOffice API (PM2)` par vrai redémarrage.
- [x] Retirer `tsconfig.tsbuildinfo` du suivi Git et l’ajouter à `.gitignore`.
- [ ] Versionner `ecosystem.config.cjs` après nettoyage.
- [ ] Créer un script de déploiement reproductible.
- [ ] Automatiser les sauvegardes PostgreSQL PROD.
- [ ] Tester une restauration complète documentée.

### P1 — Synchronisation

- [ ] Ajouter une protection explicite contre l’exécution de `sync-pg-to-mariadb.ts` sur DEV.
- [ ] Ajouter des contrôles post-sync automatisés (comptages, totaux, références).
- [ ] Documenter une procédure de rollback.
- [ ] Déterminer à quel moment PostgreSQL PROD deviendra définitivement la seule source métier.

### P1 — Nouveaux fournisseurs

- [ ] Ajouter les prochains drivers sur le modèle CasInfo / MZ Tech.
- [ ] Tester pour chaque driver : totaux, lignes, TVA, stock, doublons.
- [ ] Conserver un jeu de documents de référence.

### P1 — Validation partielle

- [ ] Introduire un statut explicite « en attente de rapprochement ».
- [ ] Permettre la reprise ultérieure des lignes non rapprochées.
- [ ] Intégrer plus tard ces lignes au stock.
- [ ] Ventiler correctement la TVA en cas de validation partielle.

### P2 — Qualité / non-régression

- [ ] Tests automatisés règles TVA / stock par profil.
- [ ] Tests doublons.
- [ ] Tests des deux scripts de synchronisation.
- [ ] Tests sur `/tva`.
- [ ] Tests génération PDF courte / longue / plusieurs taux TVA.

### P2 — Dépendances

- [ ] Planifier la mise à niveau Next.js.
- [ ] Traiter les vulnérabilités npm sans `--force` aveugle.

### P3 — OCR avancé

- [ ] File de traitement.
- [ ] Provider cloud optionnel.
- [ ] Journalisation détaillée des durées OCR.
- [ ] Recherche documentaire.

## Critère de bascule définitive hors VB6

Avant que FacturApp remplace définitivement VB6 :

- migrations PostgreSQL versionnées ;
- sauvegardes automatisées ;
- restauration testée ;
- déploiement reproductible ;
- redémarrage automatique validé ;
- tests de non-régression sur fonctions financières, PDF, synchronisation et stock ;
- décision explicite sur l’arrêt du rôle de MariaDB comme base historique de référence.


## Sprint 2026-08-15 — clôture

- [x] Création rapide d'un produit depuis une facture sans navigation.
- [x] Préremplissage Description depuis la recherche catalogue.
- [x] Suppression sécurisée d'une ligne de facture par quantité `0`.
- [x] Colonnes des tableaux Articles redimensionnables.
- [x] Affichage PA HT / PA TTC dans le catalogue avec `Afficher prix achat`.
- [x] Amélioration de la scrollbar horizontale du catalogue.
- [x] Retrait de `tsconfig.tsbuildinfo` du suivi Git et ajout au `.gitignore`.
- [x] Création transactionnelle de la première ligne `prix_produits` à la création produit.
- [x] Validation de la synchronisation d'un nouveau produit PostgreSQL PROD → MariaDB.
- [x] Diagnostic de compatibilité VB6 : les prix affichés proviennent de `prix_produits`.
- [x] Installation et premier fonctionnement OCR sur le serveur PROD.
- [x] Correction du chemin OCR `ocr-service` → `ocr`.
- [x] Ajout d'une instrumentation de performance OCR.

### Prochaines priorités proposées

- [ ] Rapatrier et versionner depuis DEV la version finale de `ocr/ocr_document.py` actuellement ajustée sur le serveur.
- [ ] Choisir définitivement `MAX_SIDE` (2200 recommandé par prudence tant que 2000 n'est pas validé sur plusieurs fournisseurs).
- [ ] Figer les versions Python/PaddleOCR/PaddlePaddle dans `ocr/requirements.txt`.
- [ ] Tester OCR PROD sur Mechouar, CasInfo, MZ Tech et documents génériques.
- [ ] Étudier une combinaison Paddle permettant de réactiver MKLDNN sans erreur PIR.
- [ ] Sprint dédié à la conception Référence / Type produit.
- [ ] Désactiver dans FacturApp les anciens articles à prix achat nul identifiés comme tests/doublons, après vérification de leur historique commercial.

## Sprint UI commercial — 2026-08-16 / 2026-08-17

### Terminé

- [x] Total articles sur nouvelle facture.
- [x] Achat TTC et marge par ligne.
- [x] Alerte couleur sur marge de ligne.
- [x] Gestion d'un produit déjà présent : ajouter / remplacer / annuler.
- [x] Rafraîchissement de la liste des factures au retour.
- [x] Recherche d'un article dans toutes les factures.
- [x] Affinage de la recherche article par client / numéro de facture.
- [x] Totaux paiements selon clients sélectionnés.
- [x] Sélection fine des factures pour les totaux paiements.
- [x] Fermeture sélecteur clients par ESC + effacement recherche.
- [x] Remontée vers l'encart de saisie lors de la sélection d'une facture.
- [x] Dashboard : brouillons + CA avec brouillons + filtre global de période.
- [x] Dashboard : bouton `Cette année`.

### Reprise immédiate

- [ ] **Corriger et valider la marge HT théorique du dashboard.**
- [ ] Vérifier le calcul sur au moins une facture validée et un brouillon dont quantité, prix achat HT et vente HT sont connus.
- [ ] Après correction, vérifier `Ce mois`, `Cette année` et une période personnalisée.
- [ ] Documenter la source de prix achat retenue pour les factures historiques.

Le reste des priorités P0/P1 d'exploitation serveur, sauvegarde, déploiement et synchronisation reste inchangé.
