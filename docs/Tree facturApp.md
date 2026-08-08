# Arborescence FacturApp — vue utile

Dernière mise à jour : 2026-08-08

L’ancienne version de ce fichier contenait plusieurs milliers de lignes incluant les dépendances et artefacts générés. Cette vue volontairement concise ne conserve que les zones utiles au développement.

```text
facturapp/
├── docs/
├── ocr/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── sync-mariadb-to-pg.ts
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── factures-fournisseurs/
│   │   │   └── tva/
│   │   └── api/
│   │       └── factures-fournisseurs/
│   │           ├── upload/
│   │           ├── ocr/[id]/
│   │           └── valider-lignes/[id]/
│   ├── components/
│   │   └── ocr/
│   └── lib/
│       └── ocr/
│           └── drivers/
├── .env.example
├── package.json
├── package-lock.json
└── tsconfig.json
```

Ne pas documenter dans cette arborescence :

```text
node_modules/
.next/
ocr/.venv/
```
