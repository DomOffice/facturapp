# 01 — Audit technique FacturApp

Dernière mise à jour : 2026-06-28

## 1. Synthèse

FacturApp repose sur une architecture moderne Next.js / TypeScript / Prisma / PostgreSQL. Le projet est maintenant organisé autour d'un socle web en développement, connecté indirectement à l'écosystème VB6 via synchronisation MariaDB → PostgreSQL.

Le module prioritaire actuellement validé est le chargement des factures fournisseurs avec stockage documentaire et OCR local PaddleOCR.

## 2. Architecture globale

### Points positifs

- Séparation claire entre l'application historique VB6 et FacturApp TS.
- PostgreSQL dédié à FacturApp.
- Prisma utilisé comme couche d'accès aux données.
- Dossier `docs/` désormais présent dans le dépôt.
- Dossier `ocr/` séparé du code Next.js.
- Stockage documentaire hors du projet.

### Points de vigilance

- La synchronisation MariaDB → PostgreSQL doit rester maîtrisée.
- Les tables propres à FacturApp ne doivent pas être écrasées par la synchronisation.
- Les traitements OCR peuvent être longs ; il faudra évoluer vers une file de traitement si le volume augmente.

## 3. Qualité du code

### Points positifs

- Le module upload/OCR a été découpé en deux routes distinctes.
- Le frontend déclenche l'OCR après upload sans tout mélanger dans une seule logique serveur.
- Les chemins système passent par `.env`.

### À améliorer

- Factoriser les contrôles de rôle `admin` / `saisie`.
- Centraliser les constantes de statuts documentaires.
- Créer un service applicatif pour les documents importés.
- Éviter que les routes API deviennent trop volumineuses.

## 4. Performances

### État actuel

- Upload validé avec limite de taille.
- OCR PaddleOCR fonctionnel mais consommateur CPU.
- PDF converti en image avant reconnaissance.

### Risques futurs

- Timeout HTTP sur gros PDF.
- Blocage CPU si plusieurs OCR sont lancés en même temps.
- Répétition inutile de l'OCR si le même document est traité plusieurs fois.

### Recommandations

- Ajouter un mécanisme de file d'attente.
- Ajouter un checksum SHA-256 pour détecter les doublons.
- Limiter le nombre de traitements OCR concurrents.
- Journaliser les durées d'exécution OCR.

## 5. Sécurité

### Points validés

- Les routes upload et OCR nécessitent une session.
- Les rôles autorisés sont limités à `admin` et `saisie`.
- Les fichiers sont stockés hors du dossier public.
- `.env` et `.venv` sont ignorés par Git.

### À renforcer

- Vérifier réellement le contenu du fichier et pas seulement le MIME.
- Refuser les extensions dangereuses.
- Ajouter un scan antivirus si le module devient exposé à plusieurs utilisateurs.
- Ne jamais exposer directement les chemins physiques au frontend.

## 6. Base de données

### Points positifs

- `DocumentImporte` sert de point d'entrée pour tous les documents OCR.
- Le texte OCR et les données JSON sont stockés en base.
- Le statut permet de suivre le cycle du document.

### À améliorer

- Normaliser les statuts : `brouillon`, `en_traitement`, `ocr_termine`, `extraction_terminee`, `valide`, `rejete`.
- Ajouter éventuellement un champ `checksum`.
- Ajouter éventuellement un champ `providerOcr`.
- Prévoir la liaison finale avec la facture fournisseur créée.

## 7. Maintenabilité

### Bonnes pratiques déjà en place

- Documentation Markdown dans `docs/`.
- OCR isolé dans `ocr/`.
- Dépendances Python figées dans `requirements.txt`.

### Recommandations

- Maintenir les fichiers `docs/` à chaque sprint.
- Ajouter `07_Journal_des_decisions.md` pour tracer les décisions structurantes.
- Centraliser les règles métier dans des services plutôt que dans les composants React.

## 8. Évolutivité

Le choix d'une architecture OCR hybride est pertinent.

Aujourd'hui : PaddleOCR local.
Demain : possibilité d'ajouter un provider cloud via `OCR_PROVIDER`.

Il faudra prévoir une interface technique du type :

```ts
interface OcrProvider {
  extract(documentPath: string): Promise<OcrResult>
}
```

Puis implémenter :

```text
LocalPaddleOcrProvider
AzureOcrProvider
GoogleDocumentAiProvider
MistralOcrProvider
```

## 9. Préparation production

### Points validés

- Pas de stockage dans `public/`.
- `UPLOAD_DIR` configurable.
- `.env.example` doit documenter les variables nécessaires.
- `.gitignore` protège les fichiers sensibles et volumineux.

### Points à vérifier avant production

- Droits Windows sur `C:/serveur/Factures_achats`.
- Existence du dossier au démarrage.
- Accès en lecture/écriture pour l'utilisateur Node/PM2.
- Chemins `PYTHON_OCR_PATH` et `OCR_SCRIPT_PATH` corrects sur serveur.
- Installation Python et dépendances OCR sur serveur.

## 10. Priorités techniques actuelles

1. Finaliser l'extraction structurée des données depuis le texte OCR.
2. Préremplir un formulaire de validation utilisateur.
3. Créer la facture fournisseur finale après validation.
4. Gérer les doublons.
5. Ajouter une file de traitement OCR.
6. Renforcer la sécurité fichier.

