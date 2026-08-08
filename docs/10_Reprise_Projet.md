# 10 — Reprise du projet FacturApp

Dernière mise à jour : 2026-08-08

## État actuel

FacturApp est opérationnel avec :

- gestion commerciale historique ;
- OCR fournisseurs ;
- drivers Mechouar, CasInfo et MZ Tech ;
- rapprochement produits ;
- intégration stock ;
- TVA fournisseurs / charges / clients ;
- page `/tva` ;
- détection de doublons ;
- validation partielle forcée ;
- synchronisation VB6 → PostgreSQL ;
- déploiement Windows via PM2.

## Règles métier à ne pas oublier

```text
Facture Mechouar : TVA oui / stock non
BL Mechouar      : TVA non / stock oui
CasInfo           : TVA oui / stock oui
MZ Tech           : TVA oui / stock oui
```

## Limite acceptée

Lors d’une validation partielle forcée, la TVA globale reste comptabilisée en totalité.

## Prochaine priorité fonctionnelle

Créer un nouveau driver fournisseur à partir des drivers existants, puis tester :

1. identification profil ;
2. totaux ;
3. lignes ;
4. TVA ;
5. stock ;
6. doublon.

## Priorité exploitation

Finaliser le redémarrage automatique Windows de PM2.
