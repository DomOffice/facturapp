# 05 — Feuille de route FacturApp

Dernière mise à jour : 2026-08-10

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
- [ ] Retirer `tsconfig.tsbuildinfo` du suivi Git et l’ajouter à `.gitignore`.
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
