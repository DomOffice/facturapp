# 04 — Bugs connus FacturApp

Dernière mise à jour : 2026-08-15

## 1. Limites connues actives

### TVA lors d’une validation partielle forcée

Lorsque certaines lignes ne sont pas rapprochées mais que l’utilisateur force la validation, seules les lignes rapprochées alimentent le stock. En revanche, la TVA globale de la facture reste comptabilisée en totalité.

Statut : accepté temporairement.

### Facture Mechouar multipage OCR

Les totaux HT / TVA / TTC peuvent être correctement reconnus alors que le détail des lignes retombe sur `fallback_generique`.

Statut : acceptable actuellement, car les factures Mechouar servent à la comptabilité et les BL servent au stock / prix.

### Dépendances npm anciennes

Au dernier `npm install` PROD :

```text
20 vulnérabilités
- 1 low
- 1 moderate
- 14 high
- 4 critical
```

Statut : ne pas corriger avec `npm audit fix --force` sans campagne de test dédiée.

### Redémarrage automatique Windows

`pm2 startup` retourne `Init system not found` sous Windows.

Le mécanisme retenu est une tâche planifiée Windows exécutant `pm2 resurrect`.

Statut : validation finale par vrai redémarrage Windows encore à faire.

### `tsconfig.tsbuildinfo`

Le fichier est généré par TypeScript. Il a été retiré du suivi Git et ajouté à `.gitignore` le 2026-08-15.

Statut : corrigé.

### Verrou Prisma sous Windows

`npx prisma generate` peut échouer avec :

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node
```

Cause : processus Node/PM2 utilisant encore le moteur Prisma.

Contournement validé :

```powershell
pm2 stop facturapp
npx prisma generate
npx tsc --noEmit
npm run build
pm2 restart facturapp
```

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
- démarrage `next start` sans build `.next` ;
- synchronisation PostgreSQL → MariaDB du stock ;
- récupération des vraies références/unité dans les PDF ;
- mise en page PDF monopage et multipage ;
- passage inutile sur une page 2 pour les totaux ;
- ergonomie de saisie article dans une nouvelle facture.

## 3. Points à surveiller

- gros PDF OCR et temps de traitement ;
- sécurité réelle du contenu des fichiers importés ;
- dérive entre `schema.prisma` et la base PostgreSQL ;
- anciennes valeurs d’environnement ou anciens chemins Windows après déplacement du projet ;
- confusion possible entre PostgreSQL DEV et PROD ;
- synchronisation inverse exécutée sur le mauvais environnement ;
- comportement visuel du PDF après toute nouvelle modification de jsPDF/autotable.


## Mise à jour 2026-08-15

### OCR PROD — performance CPU

L'OCR fonctionne sur le serveur mais reste lent sur Intel Core i5-7500 (4 cœurs / 4 threads), surtout avec MKLDNN désactivé.

Mesures sur un PDF de référence :

```text
MAX_SIDE=2800 : PaddleOCR ~80,31 s
MAX_SIDE=2200 : PaddleOCR ~55,25 s
MAX_SIDE=2000 : PaddleOCR ~48,50 s
```

Le compromis retenu doit être validé selon la qualité de reconnaissance. Ne pas sacrifier la fiabilité pour quelques secondes.

### PaddlePaddle / oneDNN / PIR

Erreur observée en PROD :

```text
NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support ...
```

Contournement actuel : désactivation de PIR et MKLDNN/oneDNN dans `ocr/ocr_document.py`. Un futur sprint pourra figer une combinaison PaddlePaddle/PaddleOCR permettant de réactiver l'accélération CPU.

### Référence / Type produit

Une incohérence de conception entre la notion métier de Type et le champ historique `reference` a été identifiée dans le catalogue facture. Ne pas corriger superficiellement dans ce sprint ; prévoir une analyse dédiée du modèle de données, des écrans, synchronisations et compatibilité VB6.
