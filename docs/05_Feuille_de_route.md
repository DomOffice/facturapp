# 05 — Feuille de route FacturApp

Dernière mise à jour : 2026-08-08

## Phase actuelle — Stabilisation + extension fournisseurs

### P0 — Exploitation serveur

- [ ] Valider la tâche Windows `DomOffice API (PM2)`.
- [ ] Tester `pm2 kill` puis déclenchement manuel de la tâche.
- [ ] Tester un vrai redémarrage Windows.
- [ ] Corriger / recréer la tâche si son ancien répertoire de travail pose problème.
- [ ] Versionner `ecosystem.config.cjs` après nettoyage.
- [ ] Documenter une procédure de déploiement unique.

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
- [ ] Tests de migration VB6.
- [ ] Tests sur `/tva`.

### P2 — Dépendances

- [ ] Planifier la mise à niveau Next.js.
- [ ] Traiter les vulnérabilités npm sans `--force` aveugle.

### P3 — OCR avancé

- [ ] File de traitement.
- [ ] Provider cloud optionnel.
- [ ] Journalisation détaillée des durées OCR.
- [ ] Recherche documentaire.

## Critère de passage en production réelle

Avant que FacturApp remplace définitivement VB6 :

- migrations PostgreSQL versionnées ;
- sauvegardes automatisées ;
- restauration testée ;
- déploiement reproductible ;
- redémarrage automatique validé ;
- tests de non-régression sur les fonctions financières et stock.
