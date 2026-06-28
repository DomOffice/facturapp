# 02 — Base de données FacturApp

Dernière mise à jour : 2026-06-28

## 1. Principe général

FacturApp utilise PostgreSQL comme base applicative TS. La base historique MariaDB reste la source de vérité tant que l'application VB6 est pleinement opérationnelle.

```text
MariaDB VB6
    │
    │ Synchronisation
    ▼
PostgreSQL FacturApp
```

Les données synchronisées depuis MariaDB ne doivent pas être mélangées sans contrôle avec les tables propres à FacturApp.

## 2. Rôle de PostgreSQL

PostgreSQL contient :

- les données synchronisées utiles à FacturApp ;
- les utilisateurs et rôles web ;
- les tables métier Next.js ;
- les tables spécifiques au module OCR, notamment `documents_importes`.

## 3. Table `documents_importes`

### Rôle

La table `documents_importes` sert de registre documentaire pour les fichiers importés dans FacturApp.

Elle permet de suivre :

- le fournisseur lié ;
- le fichier d'origine ;
- le fichier stocké ;
- le chemin relatif ;
- le statut de traitement ;
- le texte OCR ;
- les données extraites JSON ;
- l'utilisateur ayant importé le document.

## 4. Cycle d'un document importé

```text
Upload fichier
    │
    ▼
DocumentImporte créé
    statut = brouillon
    │
    ▼
OCR lancé
    statut = en_traitement
    │
    ▼
OCR terminé
    statut = ocr_termine
    │
    ▼
Extraction des champs
    statut = extraction_terminee
    │
    ▼
Validation utilisateur
    statut = valide
    │
    ▼
Création facture fournisseur
```

## 5. Statuts recommandés

| Statut | Signification |
|---|---|
| `brouillon` | Document importé, aucun OCR encore terminé |
| `en_traitement` | OCR ou traitement en cours |
| `ocr_termine` | Texte OCR récupéré |
| `extraction_terminee` | Champs structurés extraits |
| `valide` | Document validé par l'utilisateur |
| `rejete` | Document rejeté ou traitement impossible |

## 6. Données OCR

Deux niveaux sont distingués :

### Texte OCR brut

Stocké dans un champ texte.

Exemple :

```text
BL/ FACTURE N°: FV2026-01642
Date facturation: 25/03/2026
Total HT 70,83
Total TVA 20% 14,17
Total TTC 85,00
```

### Données OCR structurées JSON

Stockées dans un champ JSON.

Exemple :

```json
{
  "success": true,
  "texte": "...",
  "pages": [
    {
      "page": 1,
      "texte": "...",
      "lignes": []
    }
  ]
}
```

## 7. Relation fournisseur

Chaque document importé est rattaché à un fournisseur sélectionné par l'utilisateur lors de l'upload.

```text
Fournisseur 1 ─── n DocumentImporte
```

Ce lien est nécessaire même si l'OCR peut retrouver un fournisseur dans le texte. La sélection utilisateur reste la première source de rattachement à cette étape.

## 8. Chemin fichier

La table ne doit pas stocker un BLOB PDF.

Elle stocke uniquement le chemin relatif ou logique du document.

Exemple :

```text
2026/06/20260628_sans-numero_casinfo_cde99d5b.pdf
```

Le chemin complet est reconstruit avec `UPLOAD_DIR`.

## 9. Champs recommandés à ajouter plus tard

À envisager quand le module sera stabilisé :

- `checksum` : détection des doublons ;
- `ocrProvider` : `local`, `azure`, `google`, etc. ;
- `ocrDurationMs` : mesure performance ;
- `factureFournisseurId` : lien final vers la facture créée ;
- `erreurTraitement` : détail exploitable en cas d'échec.

## 10. Synchronisation MariaDB → PostgreSQL

Les tables propres à FacturApp comme `documents_importes` ne doivent pas être écrasées par la synchronisation.

Règle :

```text
MariaDB alimente PostgreSQL pour les données historiques.
PostgreSQL reste maître pour les modules propres à FacturApp TS.
```

