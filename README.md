# Yani Concept by Fati

Application d'un centre de beauté à Casablanca : réservation de prestations,
commande de produits, programme de fidélité, et le back-office qui va avec.

Mono-dépôt, trois applications sur une seule base PostgreSQL.

```
┌─────────────┐     ┌──────────────┐
│  mobile/    │     │  backoffice/ │
│  (clientes) │     │ (gérante et  │
│             │     │   personnel) │
└──────┬──────┘     └──────┬───────┘
       │  HTTP (JSON)      │
       └─────────┬─────────┘
                 ▼
          ┌─────────────┐
          │  backend/   │  NestJS + Prisma
          └──────┬──────┘
                 ▼
          ┌─────────────┐
          │ PostgreSQL  │
          └─────────────┘
```

| Dossier | Rôle | Pile |
|---|---|---|
| `backend/` | API REST, règles métier, base de données | NestJS · Prisma · PostgreSQL |
| `backoffice/` | Interface de gestion (commandes, RDV, catalogue, fidélité, horaires) | React · Vite |
| `mobile/` | Application cliente | Expo · React Native |

---

## Prérequis

- **Node.js 22** ou plus
- **Docker** et Docker Compose (pour PostgreSQL)
- Pour le mobile : l'application **Expo Go**, ou un émulateur Android / simulateur iOS

---

## Démarrage rapide

```bash
git clone https://github.com/Yassir-13/YANIApp.git
cd YANIApp
```

### 1. Configuration

Deux fichiers d'environnement à créer, tous deux à partir de leur modèle :

```bash
cp .env.example .env                  # base de données + port de l'API
cp backend/.env.example backend/.env  # configuration de l'application
```

Les valeurs à renseigner sont commentées une par une dans les modèles. Trois
points d'attention :

- **`JWT_SECRET`** doit faire au moins 32 caractères — l'API refuse de démarrer
  en dessous. Générer avec `openssl rand -base64 48`.
- **`DATABASE_URL`** doit correspondre aux `POSTGRES_*` du `.env` racine.
- **`MAIL_DRIVER=console`** en développement : aucun email ne part, les codes de
  confirmation s'affichent dans les logs du serveur.

Aucun de ces fichiers n'est versionné.

### 2. Backend

```bash
docker compose up -d postgres     # la base seule
cd backend
npm install
npx prisma migrate deploy         # applique le schéma
npx prisma db seed                # horaires d'ouverture + compte administrateur
npm run start:dev
```

L'API écoute sur `http://localhost:3000` (ou sur `PORT` s'il est défini).
Documentation interactive sur `http://localhost:3000/api-docs` — développement
uniquement, elle est coupée en production.

> **Le seed n'est pas optionnel.** Sans horaires d'ouverture, le centre est
> considéré fermé tous les jours et aucune cliente ne peut réserver. Il est
> idempotent : le rejouer ne réécrit jamais des horaires déjà configurés.

### 3. Back-office

```bash
cd backoffice
npm install
npm run dev                       # http://localhost:5173
```

Se connecter avec les identifiants `ADMIN_EMAIL` / `ADMIN_PASSWORD` du seed.
Une cliente est refusée à l'entrée : ce back-office est réservé au personnel.

### 4. Application mobile

```bash
cd mobile
npm install
npx expo start
```

Par défaut, l'application vise `http://10.0.2.2:3000`, l'adresse par laquelle
l'émulateur Android joint la machine hôte. Sur un téléphone réel ou sur iOS, il
faut la changer — créer `mobile/.env.local` :

```
EXPO_PUBLIC_API_URL=http://192.168.1.X:3000
```

Les quatre cas de figure (émulateur, simulateur iOS, téléphone réel, production)
sont détaillés dans `mobile/.env.example`.

---

## Tests

Le back-end est couvert par **179 tests**. Une partie écrit dans une vraie base
PostgreSQL — concurrence, transactions, sessions : ce sont des propriétés qu'un
Prisma simulé ne peut pas démontrer.

```bash
cd backend
npx jest --runInBand               # --runInBand : les tests de concurrence
                                   # partagent la même base et le même verrou
```

Ils ont besoin d'une base migrée **et seedée** (les horaires d'ouverture).

Le back-office et le mobile n'ont pas de tests ; leur filet est la compilation :

```bash
npx tsc --noEmit                   # dans chacun des trois projets
```

L'intégration continue rejoue tout cela à chaque `push` sur `main`
(`.github/workflows/ci.yml`).

---

## Mise en production

### Lancer la pile complète

```bash
docker compose up -d
```

Trois services s'enchaînent : PostgreSQL, puis un conteneur qui applique les
migrations et s'arrête, puis l'API — qui ne démarre que si les migrations ont
réussi.

L'API est publiée sur `127.0.0.1` uniquement. C'est **voulu** : un reverse proxy
(Caddy, nginx) doit se placer devant pour assurer le HTTPS. Publier le port
directement reviendrait à servir l'API en clair.

Si un reverse proxy est en place, passer `TRUST_PROXY=1` — c'est ce qui permet
d'identifier les clientes par leur vraie adresse IP plutôt que par celle du
proxy, faute de quoi elles partageraient toutes le même compteur de requêtes.

### Sauvegardes

```bash
./scripts/backup.sh
```

Écrit un dump horodaté dans `backups/` (jamais versionné) et supprime ceux de
plus de quatorze jours. À automatiser par une tâche planifiée, et à recopier
**hors de la machine** : une sauvegarde qui vit sur le serveur qu'elle sauvegarde
ne protège de rien.

La procédure de restauration — et la vérification qui va avec — est documentée
en bas de `scripts/backup.sh`.

---

## Ce qui reste à faire avant un lancement public

- Nom de domaine et certificat HTTPS (`mobile/eas.json` vise déjà
  `api.yaniconcept.ma`, qui n'existe pas encore)
- Serveur SMTP définitif à la place de la solution provisoire actuelle
- Notifications push (dépend d'un build natif, donc du domaine)

---

## Licence

Projet privé, tous droits réservés.
