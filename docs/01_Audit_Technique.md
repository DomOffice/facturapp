# 01 — Audit technique FacturApp

Dernière mise à jour : 2026-08-08

## 1. État général

FacturApp dispose désormais d’un socle fonctionnel cohérent couvrant la gestion commerciale, la TVA, les imports fournisseurs, l’OCR, le rapprochement produit et l’intégration du stock.

Le principal risque n’est plus l’absence de fonctionnalités, mais la maîtrise de l’exploitation : cohérence schéma PostgreSQL / Prisma, déploiement Windows, maintien des règles métier par type de document et non-régression des drivers OCR.

## 2. Points solides

- Next.js / TypeScript / Prisma bien séparés du moteur OCR Python.
- Drivers fournisseurs indépendants.
- Fallbacks OCR conservés.
- Validation humaine avant impact métier.
- Contrôle serveur des règles TVA / stock.
- Intégration stock transactionnelle.
- Détection de doublons sur les documents fournisseurs.
- Page `/tva` dédiée.
- Synchronisation VB6 → PostgreSQL conservée comme canal historique.
- Déploiement serveur reconstruit proprement depuis GitHub.

## 3. Points de vigilance

### Prisma / PostgreSQL

`prisma generate` ne met pas à jour PostgreSQL. Lors d’un déploiement comportant une évolution du schéma, vérifier explicitement la structure de la base avant redémarrage de l’application.

### PM2 Windows

`pm2 startup` ne fonctionne pas sous Windows dans cette installation (`Init system not found`). Le redémarrage automatique repose sur une tâche planifiée Windows exécutant `pm2 resurrect`.

Cette tâche doit être testée après arrêt complet de PM2 puis par un vrai redémarrage Windows.

### Dépendances

Le build serveur signale des dépendances anciennes et des vulnérabilités npm, notamment Next.js 14.2.5. Ne pas lancer `npm audit fix --force` sur la branche stable. Prévoir une mise à niveau contrôlée et testée.

### OCR

Les factures Mechouar multipages peuvent encore retomber sur un fallback pour le détail des lignes. Ce comportement est accepté lorsque HT / TVA / TTC sont fiables, car le stock Mechouar provient des BL.

## 4. Dette technique prioritaire

1. Validation complète du redémarrage automatique Windows.
2. Mettre `ecosystem.config.cjs` sous contrôle Git après nettoyage du chemin serveur.
3. Exclure `tsconfig.tsbuildinfo` du versionnement.
4. Ajouter une vraie procédure de déploiement documentée.
5. Mettre à niveau Next.js et les dépendances après campagne de non-régression.
6. Ajouter des tests automatisés sur les règles TVA / stock / doublons.
7. Revoir la TVA lors des validations partielles forcées.

## 5. Sécurité / exploitation

- `.env` ne doit jamais être commité.
- Les chemins de stockage et secrets restent dans l’environnement serveur.
- Les documents fournisseurs ne doivent pas être placés dans `public/`.
- Les commandes Prisma destructives ne doivent être utilisées que lorsque la base ciblée et la perte de données sont explicitement acceptées.

## 6. Conclusion

Le projet est suffisamment stable pour poursuivre l’ajout de nouveaux drivers fournisseurs. La priorité parallèle doit être de figer l’exploitation serveur et la procédure de déploiement afin qu’une mise à jour GitHub reste prévisible et répétable.
