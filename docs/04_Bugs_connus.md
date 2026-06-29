# 04 — Bugs connus FacturApp

Dernière mise à jour : 2026-06-28

## 1. Bugs corrigés

### Mauvais lien Nouvelle facture fournisseur

Symptôme : clic sur `Nouvelle facture` depuis `factures-fournisseurs` menait à une page 404.

Cause : lien vers `/charges/nouveau` au lieu de `/factures-fournisseurs/nouveau`.

Statut : corrigé.

### Redirections incorrectes

Symptôme : redirections vers `/login` ou `/dashboard` alors que l'application utilise `/connexion` et `/`.

Statut : corrigé ou à surveiller dans les nouveaux modules.

### Test OCR via curl redirigé vers `/connexion`

Symptôme : appel direct `curl.exe -X POST` retourne `/connexion`.

Cause : curl ne transmet pas la session navigateur. La route API est protégée par authentification.

Statut : comportement normal.

### PaddleOCR `cls=True`

Symptôme : erreur `unexpected keyword argument 'cls'`.

Cause : changement d'API dans les versions récentes de PaddleOCR.

Correction : utiliser `ocr.predict(...)` et `use_textline_orientation`.

Statut : corrigé.

### Erreur PaddlePaddle oneDNN / PIR

Symptôme : `ConvertPirAttribute2RuntimeAttribute not support`.

Cause : incompatibilité rencontrée avec une version récente de PaddlePaddle en inférence CPU Windows.

Correction : utiliser `paddlepaddle==3.2.2`.

Statut : corrigé.

### Environnement virtuel Python cassé après renommage

Symptôme : `Fatal error in launcher` après renommage `ocr-service` → `ocr`.

Cause : le `.venv` conserve l'ancien chemin interne.

Correction : supprimer et recréer `.venv` dans `ocr/`.

Statut : corrigé.

## 2. Points à surveiller

### Timeout OCR

Les gros documents peuvent dépasser le délai de traitement HTTP.

Recommandation : file d'attente OCR si le volume augmente.

### Doublons documentaires

Actuellement, le même PDF peut être importé plusieurs fois.

Recommandation : ajouter un checksum.

### Sécurité fichier

Le contrôle MIME ne suffit pas toujours.

Recommandation : validation plus stricte du contenu fichier.

### Chemins Windows

Les chemins absolus doivent rester dans `.env`, jamais en dur dans le code.

### Synchronisation

La synchronisation MariaDB → PostgreSQL ne doit pas supprimer ni écraser les tables propres à FacturApp, notamment `documents_importes`.

## 3. Bugs ouverts

Aucun bug bloquant connu à ce stade pour :

- upload document ;
- stockage fichier ;
- OCR local ;
- affichage OCR ;
- mise à jour `ocr_termine`.

### Extraction ligne article CASINFO décalée

Symptôme :
Les lignes articles étaient mal détectées : la deuxième ligne de désignation était interprétée comme référence, ce qui inversait quantité et prix.

Cause :
Les factures CASINFO affichent une ligne article sur deux lignes OCR.

Correction :
Extraction basée sur les coordonnées PaddleOCR et regroupement logique des lignes article.

Statut :
Corrigé pour CASINFO, à généraliser via profils fournisseurs.

## Qualité des scans OCR

Pour Sprint 3, l’extraction des lignes articles est validée uniquement sur des documents correctement scannés :
- page droite ;
- texte lisible ;
- tableau non incliné ;
- résolution suffisante ;
- facture complète.

Les documents inclinés ou de mauvaise qualité peuvent échouer à l’extraction des lignes.  
La correction automatique d’inclinaison ou le redressement d’image n’est pas prioritaire à ce stade.