# Backend — Yani Concept by Fati

API NestJS · Prisma · PostgreSQL.

**La documentation du projet est à la racine du dépôt : [`../README.md`](../README.md)** —
installation, variables d'environnement, démarrage, tests, déploiement et
sauvegardes y sont décrits pour les trois applications à la fois.

Ce fichier ne contient volontairement rien de plus. Il portait jusqu'ici le
modèle livré avec NestJS — badges, liens Discord et « Deploy with Mau » — dans
un dépôt dont chaque autre fichier porte des commentaires écrits à la main.

## Quelques commandes, pour ne pas avoir à remonter

```bash
npx prisma migrate deploy     # applique les migrations (jamais `migrate dev` en ligne)
npx prisma db seed            # horaires d'ouverture + compte administratrice
npx jest --runInBand          # la totalité des tests, concurrence comprise
npm run test:e2e              # le test end-to-end, hors du périmètre de jest
node scripts/i18n-manquants.js  # messages levés sans traduction (code 1 s'il en reste)
```
