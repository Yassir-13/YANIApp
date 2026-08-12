# Image de l'API Yani Concept.
#
# Trois étapes, pour que l'image livrée ne contienne que ce qui sert à SERVIR :
# ni compilateur, ni Jest, ni Nest CLI. Résultat mesuré : 178 Mo.

# ═══════════════════════════════════════════════════════════════════════════
#  Étape 1 — compilation
# ═══════════════════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Debian plutôt qu'Alpine, à dessein. `argon2` est un module natif et Prisma
# embarque des moteurs liés à OpenSSL : sous Alpine (musl), les deux réclament
# une chaîne de compilation complète et des variantes de moteur spécifiques,
# pour une image à peine plus petite. Le hachage des mots de passe n'est pas
# l'endroit où économiser 40 Mo.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Les dépendances avant le code : tant que package-lock.json ne bouge pas,
# Docker réutilise cette couche et ne réinstalle rien.
COPY package*.json ./
RUN npm ci

# Le client Prisma est GÉNÉRÉ, jamais versionné. Sans cette commande l'image
# démarre normalement, puis échoue au premier accès à la base.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════
#  Étape 2 — élagage des dépendances de développement
# ═══════════════════════════════════════════════════════════════════════════
FROM build AS prune

# Ce qui part : Nest CLI, TypeScript, Jest, ts-node — plusieurs centaines de Mo.
#
# Ce qui RESTE, et ce n'est pas un oubli : `.prisma/client` (le client généré,
# que npm ne connaît pas comme paquet) et le CLI `prisma` lui-même — déclaré en
# dépendance de pair optionnelle par `@prisma/client`, npm le conserve donc
# malgré son classement en devDependency. Vérifié dans l'image construite.
# Tant mieux : c'est ce qui permet de jouer les migrations et de lancer un
# `prisma migrate status` de diagnostic sans image supplémentaire.
RUN npm prune --omit=dev

# ═══════════════════════════════════════════════════════════════════════════
#  Étape 3 — image finale
# ═══════════════════════════════════════════════════════════════════════════
FROM node:22-bookworm-slim AS runtime

# OpenSSL seul : les moteurs Prisma en dépendent à l'exécution. Aucun
# compilateur ici — ce qui compile n'a rien à faire sur un serveur en ligne.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prune /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Le schéma ET les fichiers de migration : `prisma migrate deploy` lit ce
# dossier. C'est ce qui rend l'image autonome — elle sait migrer la base sur
# laquelle on la branche, sans dépendre d'une seconde image.
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Utilisateur non privilégié, fourni par l'image officielle (uid 1000). Une
# faille dans une dépendance ne donne alors pas les droits root du conteneur.
USER node

# Purement documentaire — le port réel vient de PORT (voir main.ts).
EXPOSE 3000

# La sonde utilise `fetch`, natif depuis Node 18 : pas de curl ni de wget à
# installer pour ça. /health teste aussi la base et est exempté du rate
# limiting, précisément pour être interrogé en continu.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Pas de `prisma migrate` dans cette commande, et c'est voulu : les migrations
# sont jouées par un service dédié (voir docker-compose.yml), à partir de cette
# même image. Une migration qui échoue doit se voir comme une étape ratée, avec
# son message — pas comme une application qui redémarre en boucle sans qu'on
# sache pourquoi.
CMD ["node", "dist/main"]
