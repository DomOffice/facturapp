# 04 — Bugs connus FacturApp

Dernière mise à jour : 2026-08-08

## 1. Limites connues actives

### TVA lors d’une validation partielle forcée

Lorsque certaines lignes ne sont pas rapprochées mais que l’utilisateur force la validation, seules les lignes rapprochées alimentent le stock. En revanche, la TVA globale de la facture reste comptabilisée en totalité.

Statut : accepté temporairement.

### Facture Mechouar multipage

Les totaux HT / TVA / TTC peuvent être correctement reconnus alors que le détail des lignes retombe sur `fallback_generique`.

Statut : acceptable actuellement, car les factures Mechouar servent à la comptabilité et les BL servent au stock / prix.

### Dépendances npm anciennes

`npm ci` signale plusieurs vulnérabilités et Next.js 14.2.5 n’est plus à jour.

Statut : ne pas corriger avec `npm audit fix --force` sans campagne de test dédiée.

### Redémarrage automatique Windows

`pm2 startup` retourne `Init system not found` sous Windows.

Le mécanisme retenu est une tâche planifiée Windows :

```text
DomOffice API (PM2)
→ cmd.exe /c "pm2 resurrect"
```

La tâche possède encore un ancien `WorkingDirectory` (`C:\domoffice-api`). La modification PowerShell a échoué car Windows demande les informations d’identification enregistrées pour la tâche.

Statut : à valider / corriger proprement avant de considérer l’auto-start comme garanti.

## 2. Bugs corrigés récemment

- TVA CasInfo absente du tableau fournisseurs après premier affichage ;
- TVA facture Mechouar non détectée ;
- incohérences TVA dashboard / page TVA ;
- filtres date TVA fournisseurs ;
- réinitialisation client / fournisseur sur `/tva` ;
- doublons facture Mechouar ;
- validation de lignes non rapprochées ;
- absence des tables OCR/stock en production après déploiement ;
- multiples daemons PM2 concurrents ;
- lancement Next.js en mode développement via PM2 ;
- démarrage `next start` sans build `.next`.

## 3. Points à surveiller

- gros PDF OCR et temps de traitement ;
- sécurité réelle du contenu des fichiers importés ;
- dérive entre `schema.prisma` et la base PostgreSQL ;
- anciennes valeurs d’environnement ou anciens chemins Windows après déplacement du projet ;
- `tsconfig.tsbuildinfo` actuellement versionné alors qu’il s’agit d’un cache généré.
