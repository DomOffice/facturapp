FACTURAPP — REPRISE DU DÉVELOPPEMENT
Projet

FacturApp est la nouvelle application qui remplacera progressivement une application historique VB6.

Architecture actuelle :

VB6
    ↓
MariaDB
    ↓
Synchronisation (/admin/sync)
    ↓
PostgreSQL
    ↓
FacturApp (Next.js)

Stack :

Next.js 15
TypeScript
Prisma
PostgreSQL

OCR :

Python
PaddleOCR local
Architecture prévue hybride Local + Cloud.

Repository GitHub :

https://github.com/DomOffice/facturapp

Toujours consulter le dépôt avant toute proposition.

Documentation

Le dossier :

/docs

contient :

00_Architecture.md
01_Audit_Technique.md
02_Base_de_donnees.md
03_Ameliorations.md
04_Bugs_connus.md
05_Feuille_de_route.md
06_Conventions_de_code.md
07_Journal_des_decisions.md

Ils sont désormais à jour.

Avant tout développement, toujours les consulter.

Après chaque évolution importante, proposer les mises à jour.

Principe d'architecture

FacturApp n'est pas un OCR.

FacturApp est un moteur de lecture intelligente de documents fournisseurs.

L'objectif n'est pas d'extraire du texte mais de comprendre un document comme le ferait un humain.

Toutes les évolutions doivent respecter ce principe.

OCR

Le moteur OCR est aujourd'hui composé de :

OCR
        ↓
Texte OCR
        ↓
Extraction
        ↓
ArticleBuilder
        ↓
Validation

Les drivers restent volontairement simples.

Ils décrivent uniquement :

alias
corrections
spécificités

Aucune logique métier.

Les fallbacks sont indispensables.

Ne jamais les supprimer.

Pipeline actuel :

profil

↓

fallback_generique

↓

fallback_texte

↓

fallback BL séquentiel
Sprint 3

Terminé.

Fonctionnalités :

✓ Upload PDF

✓ Upload JPG

✓ Upload PNG

✓ OCR PaddleOCR

✓ Extraction :

fournisseur
date
numéro
ICE
HT
TVA
TTC

✓ Extraction intelligente des lignes

✓ ArticleBuilder

✓ Gestion des articles sur 1,2,3,N lignes

✓ Tableau React éditable

✓ Confiance par ligne

✓ Diagnostic OCR

Amélioration réalisée

Un nouveau fallback a été ajouté.

Il permet de lire les documents de type :

Référence

Désignation

Quantité

Prix

Total

Il fonctionne sur les bons de livraison Mechouar.

Résultat obtenu :

14 articles détectés

Confiance moyenne :
85 %
Sprint 4.1

Terminé.

Fonctionnalités :

Validation des lignes OCR.

Création des :

lignes_importees

Le document passe au statut :

lignes_validees
Sprint 4.2

Très largement avancé.

Etat actuel :

✓ Recherche produit

✓ Endpoint :

/api/produits/recherche

✓ Recherche :

référence

désignation

✓ Score de pertinence

✓ Bonus fournisseur

(non bloquant)

✓ Proposition automatique

✓ Recherche manuelle

✓ "A rapprocher"

✓ produitId optionnel

✓ Validation en base :

associee

ou

a_rapprocher
Amélioration importante réalisée

La recherche automatique effectue plusieurs essais :

1

référence + désignation

↓

si rien

↓

désignation seule

↓

si rien

↓

référence seule

Cela améliore énormément les résultats.

Cas particulier Mechouar

Le fournisseur Mechouar représente environ 50 % des achats.

Le document analysé est un BL.

Le texte OCR est excellent.

Le problème n'était pas l'OCR.

Le problème était uniquement l'extraction.

Le fallback séquentiel résout le problème.

Le moteur reste en profil :

generic

Il n'existe PAS de driver Mechouar.

Décision volontaire.

Recherche produit

Aujourd'hui :

Une ligne OCR peut :

être associée

ou

rester :

A rapprocher

L'utilisateur garde toujours le contrôle.

Aucune création automatique.

Problème identifié

Exemple :

AGRAFE

↓

Agrafeuse

Le moteur lexical peut produire des faux positifs.

Décision :

présélection automatique uniquement si le score est très élevé.

Les autres restent des propositions.

Prochaine étape

Sprint 4.2.3

Mémorisation des associations.

Architecture retenue :

Nouvelle table :

AssociationArticleFournisseur

Clé unique :

fournisseurId

+

referenceNormalisee

Objectif :

Lorsqu'un utilisateur choisit un produit :

Mechouar

+

5602024329461

↓

Produit #112

l'association est mémorisée.

Au prochain OCR :

5602024329461

↓

Produit #112

pré-sélection immédiate

Le choix humain devient prioritaire sur toute recherche approximative.

Etat actuel du développement

Le prochain développement est précisément :

Sprint 4.2.3

Etape A

Modifier :

prisma/schema.prisma

Ajouter :

AssociationArticleFournisseur

avec :

fournisseurId

produitId

referenceDetectee

referenceNormalisee

designationDetectee

createdAt

updatedAt

Créer :

migration Prisma
Etape B

Modifier :

src/app/api/factures-fournisseurs/valider-lignes/[id]/route.ts

La transaction devra :

1

Supprimer les anciennes lignes

↓

2

Créer les nouvelles lignes

↓

3

Créer ou mettre à jour :

AssociationArticleFournisseur

via :

upsert()
Etape C

Créer :

/api/produits/associations

Cette API retournera les associations mémorisées.

Etape D

Modifier :

upload-facture.tsx

Ordre de recherche :

Association mémorisée

↓

Recherche automatique

↓

Recherche manuelle

↓

A rapprocher
Sprint suivant

4.2.4

Création d'un produit depuis une ligne OCR.

Workflow :

Créer un article

↓

Formulaire pré-rempli

↓

Création produit

↓

Association immédiate

↓

Mémorisation

Jamais de création automatique.

Toujours validation utilisateur.

Etat Git

Avant de commencer 4.2.3 :

Le dépôt est propre.

Les modifications OCR, recherche produit et extraction BL ont été validées et documentées.

Les fichiers /docs ont été mis à jour.

Le prochain commit concernera uniquement :

feat(ocr): memorize supplier product associations

4.2.3-A — Schéma Prisma
1. Modifier prisma/schema.prisma
2. Valider puis migrer
4.2.3-B — Mémoriser lors de la validation
Tests de 4.2.3-B
4.2.3-C : l’endpoint de lecture des associations, puis on le branchera avant la recherche approximative.

Quelques recommandations pour la reprise

Toujours consulter le dépôt GitHub avant de proposer du code.
Toujours consulter les fichiers /docs avant de développer.
Privilégier des modifications incrémentales plutôt que des refontes.
Ne jamais casser un fonctionnement existant.
Préférer une V1 simple, testable et exploitable avant d'ajouter de la sophistication.
Toujours proposer les tests à effectuer après chaque étape.
Mettre à jour la documentation à la fin de chaque évolution importante.