# Arborescence FacturApp — vue utile

Dernière mise à jour : 2026-08-10

```text
facturapp/
├── docs/
├── ocr/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── sync-mariadb-to-pg.ts
│   └── sync-pg-to-mariadb.ts
├── public/
├── scripts/                         # local/serveur, non suivi à date
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── factures/
│   │   │   │   ├── nouvelle/
│   │   │   │   └── [id]/
│   │   │   ├── produits/
│   │   │   ├── factures-fournisseurs/
│   │   │   └── tva/
│   │   ├── admin/
│   │   │   └── sync/
│   │   └── api/
│   │       ├── factures/
│   │       ├── produits/
│   │       └── factures-fournisseurs/
│   │           ├── upload/
│   │           ├── ocr/[id]/
│   │           └── valider-lignes/[id]/
│   ├── components/
│   │   └── ocr/
│   └── lib/
│       ├── exports/
│       │   └── pdf/
│       │       └── facture-pdf.ts
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
tsconfig.tsbuildinfo
```

`tsconfig.tsbuildinfo` est encore suivi à date mais doit être retiré du versionnement.
