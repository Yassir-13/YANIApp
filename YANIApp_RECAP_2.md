# YANIApp — Récapitulatif nº 2

**Yani Concept by Fati** — Application de centre de beauté (Casablanca)
Mono-repo : `mobile/` · `backend/` · `backoffice/`

> Suite du récap nº 1. Ce document décrit l'état **après** la session de
> correction de bugs et de complétion du backoffice.

---

## 1. Ce qui a été fait pendant cette session

Chaque point a été vérifié à l'exécution (serveur démarré, vraie base), sauf
mention contraire.

### 1.1 Bugs corrigés

| # | Bug | Correctif | Vérification |
|---|---|---|---|
| 1 | **Secret JWT incohérent** — signé avec `JWT_SECRET`, vérifié avec `JWT_SECRET ?? 'fallback'`. Secret manquant = serveur qui démarre avec une clé publique écrite dans le code. | `getOrThrow` des deux côtés + `validateEnv` au démarrage (min. 32 caractères) | Config invalide → refus de démarrer |
| 2 | **Pas de machine à états sur les RDV** — `CANCELLED → COMPLETED` créditait des points pour une prestation annulée. | Table `ALLOWED_TRANSITIONS` (miroir des commandes), appliquée à `updateStatus`, `cancel` et `reschedule`. Statut + crédit dans une seule transaction. | 10 tests ; **7 échouent sur l'ancien code** |
| 3 | **Motif d'audit jeté** — le champ `reason` du crédit manuel était déclaré, transmis, validé… et jamais écrit. Colonne inexistante. | Colonne `reason` + migration + persistance + `@MaxLength(255)` | Écrit puis relu via la requête d'audit |
| 4 | **Fuseau horaire faux (backend)** — `localTimeToUtc` calculait l'offset à la main : juste en `TZ=UTC`, faux d'1 h en `TZ=Africa/Casablanca`. | Remplacé par `fromZonedTime` (base IANA) | Testé sur 3 fuseaux serveur |
| 5 | **Fuseau horaire faux (mobile)** — `CASABLANCA_OFFSET_HOURS = 1` en dur. Le Maroc passe à UTC+0 pendant le Ramadan → RDV décalés d'1 h sur toute la période. | Le serveur renvoie désormais `startAt` (UTC exact) par créneau ; le mobile le renvoie tel quel, **sans aucun calcul de fuseau**. | Chaîne complète vérifiée |
| 6 | **Mode sombre inatteignable** — `userInterfaceStyle: "light"` dans `app.json` forçait `useColorScheme()` à `'light'`. L'option « Système » ne basculait jamais. | `"automatic"` | `expo config` confirme la valeur ; **rendu visuel non testé** |
| 7 | **Prix des prestations non figé** — les points fidélité étaient calculés sur le tarif du jour de la complétion. | Colonne `priceAtBooking` + migration avec backfill. Le crédit lit le prix figé (repli si null). | Tarif passé à 777,77 → la cliente reste à 200 |
| 8 | **Prix figé mais non affiché** — le backoffice montrait `service.price` (tarif courant) sur des RDV déjà réservés. Risque de facturer le mauvais montant. | Affiche `priceAtBooking`, avec mention discrète du tarif actuel s'il diffère. | Vérifié bout-en-bout |
| 9 | **`take: 50` en dur sur `/users`** — au-delà de 50 comptes, les suivants étaient **invisibles sans signal**. | Vraie pagination serveur (`page`/`limit`, max 100) | 67 comptes → `total=67`, 3 pages, 0 chevauchement |

### 1.2 Ajouts

- **Sonde de santé** `GET /health` — teste l'API **et** la base (`SELECT 1`),
  renvoie 503 si la base est morte, ne divulgue aucun détail d'infrastructure.
  Remplace le `"Hello World!"` de Nest (`GET /` renvoie désormais 404).
- **Rate limiting** (`@nestjs/throttler`) — 120 req/min par endpoint et par IP ;
  **10/min** sur `login`, `register` et `changePassword` (les trois routes qui
  font tourner argon2, donc les vrais vecteurs de saturation CPU) ;
  `/health` exempté. `TRUST_PROXY` pour l'IP réelle derrière un reverse proxy.
- **Pagination** — composant réutilisable ; serveur sur Utilisateurs,
  client (20/page) sur Commandes, Rendez-vous et Audit fidélité.

### 1.3 Backoffice complété

- **Horaires d'ouverture** — page + client API + route + menu. Le backend
  était prêt depuis le début, il manquait l'écran. **C'était le moteur des
  créneaux : impossible de changer les horaires sans passer par SQL.**
- **Création de catégorie** — `createCategory` existait mais n'était appelée
  nulle part. Sur une base neuve, le formulaire produit exigeait une catégorie
  et il n'y avait aucun moyen d'en créer une : **le catalogue était verrouillé**.
- **RDV pour une cliente** + **reprogrammation** — endpoints existants, jamais
  câblés. Un modal commun aux deux usages, qui consomme le `startAt` du serveur.
- **Nettoyage** — `Placeholder.tsx` supprimé (importé, jamais routé) ; spinner
  « Actualiser » du dashboard corrigé.

---

## 2. Ce qui reste — par priorité

### 2.1 Chapitre en cours : durcissement backend

Commencé, **non terminé**. Le paquet `helmet` est installé mais **pas branché**.

- [ ] **Helmet** — en-têtes de sécurité. ⚠️ Piège identifié : le CSP par défaut
      (`script-src 'self'`) **casse Swagger UI**, qui génère un `<script>` inline.
      Solution retenue : CSP désactivé en dev, actif en production (Swagger n'y
      tourne pas de toute façon).
- [ ] **Filtre d'exceptions global** — les erreurs Prisma fuient encore telles
      quelles. Cas connus : créer un produit avec un `categoryId` inexistant
      (P2003), modifier un id absent (P2025). Traduire P2002/P2003/P2025/P2000
      en réponses françaises, masquer le reste, logger le détail côté serveur.
- [ ] **Logging structuré** — le filtre d'exceptions en est le point d'entrée
      naturel (toutes les erreurs y passent).

### 2.2 Bloquant avant production

- [ ] **Tests** — 11 suites sur 14 échouent encore. Ce sont les squelettes
      générés par Nest (`should be defined`) qui plantent faute de dépendances
      injectées. **`npm test` est rouge en permanence.** Les 3 suites vertes
      sont celles écrites pendant cette session (16 tests réels).
- [ ] **Dockerfile backend** + stratégie de sauvegarde PostgreSQL
- [ ] **Variables d'environnement de production** (secrets, `CORS_ORIGINS`, DB)
- [ ] **L'API ne démarre pas si la base est momentanément absente** —
      `PrismaService.onModuleInit` appelle `$connect()` qui échoue et tue le
      bootstrap. Une micro-panne pendant un redéploiement laisse l'API morte
      au lieu de réessayer.

### 2.3 Mobile — bloquant avant toute distribution

- [ ] **URL d'API en dur** : `http://10.0.2.2:3000` — alias de l'émulateur
      Android, en **HTTP**. Inutilisable sur un téléphone réel ou en production.
- [ ] **Identité de l'app** : `name` et `slug` valent `"mobile"`, aucun
      `ios.bundleIdentifier`, aucun `android.package`.
- [ ] **Session morte, UI toujours connectée** — quand le refresh échoue,
      `mobile/src/api/client.ts` efface les tokens mais ne remet pas
      `authStore.user` à `null` (commentaire `// plus tard : rediriger`).
      L'utilisateur reste sur une interface connectée jusqu'au redémarrage.
      *(Le backoffice, lui, redirige correctement.)*
- [ ] **Pas de pipeline EAS** (`eas.json` absent) — prérequis à tout build natif.

### 2.4 Incohérences fonctionnelles

- [ ] **Validation du téléphone contournable** — l'inscription impose un format
      marocain strict, mais `UpdateProfileDto` accepte n'importe quelle chaîne
      de ≤ 20 caractères. `firstName`/`lastName` peuvent aussi devenir vides
      alors qu'ils sont obligatoires à l'inscription.
- [ ] **`RequireAuth` (backoffice) ne vérifie pas le rôle** — seulement la
      connexion. `/users` est masqué du menu mais atteignable à l'URL (le
      backend bloque, mais l'UX casse).
- [ ] **Devise incohérente** — `« DH »` au mobile, `« dh »` au backoffice.
- [ ] **Seed incomplet** — crée l'admin sans `lastName` ni `phone`, pourtant
      obligatoires à l'inscription.
- [ ] **Compteurs d'onglets Utilisateurs supprimés** — conséquence assumée de
      la pagination serveur. Un endpoint `/users/stats` les rendrait en une
      requête, si le besoin se confirme.

### 2.5 Robustesse — conditions de course (TOCTOU)

Faible risque à l'échelle actuelle (Fati opère seule), mais réelles. Toutes du
même type : vérifier puis écrire en deux étapes.

- [ ] `orders.service.ts` — deux confirmations simultanées peuvent lire
      `stock = 1` et décrémenter chacune → **stock négatif**
- [ ] `loyalty.service.ts` (`redeem`) — deux échanges simultanés → **solde négatif**
- [ ] `appointments.service.ts` (`assertSlotAvailable`) — deux réservations
      simultanées peuvent dépasser la capacité de 2

Correctif type : écriture conditionnelle atomique dans la transaction
(`updateMany` avec `where: { stockQty: { gte: qty } }`).

### 2.6 Fonctionnel — décidé, non fait

- [ ] **Vérification email** (SMTP transactionnel : Brevo, Mailgun, Resend…)
- [ ] **Persistance du panier** (AsyncStorage — vidé à la fermeture)
- [ ] **`MyOrdersScreen` ne se rafraîchit pas au focus** (pull-to-refresh existe)
- [ ] **Favori produit non persisté** — état local, aucun modèle en base
- [ ] **Le staff ne peut pas réapprovisionner** — `PATCH /products/:id` est
      ADMIN-seul (choix assumé)
- [ ] **Prix mobile sur les RDV** — la cliente ne voit aucun prix dans
      « Mes rendez-vous ». Le type expose maintenant `priceAtBooking` :
      l'afficher serait trivial.

---

## 3. Reporté volontairement

- **Gel de la durée des prestations (`endAt`)** — *décision explicite : à
  rediscuter.* Aucune colonne `endAt` n'existe ; la fin est recalculée depuis
  `service.durationMin` à chaque lecture. Changer une durée modifie donc
  rétroactivement **tous** les RDV déjà réservés, y compris passés, et fausse
  les calculs de chevauchement. À noter : `backoffice/src/api/appointments.ts`
  déclare `endAt: string` **obligatoire** pour une colonne inexistante.
- **Notifications push** — prérequis manquant : pas d'`eas.json`, pas de build
  natif. Le push ne fonctionne plus dans Expo Go. À faire **après** le
  déploiement. Commencer par le push événementiel (« commande prête »), qui se
  branche sur la machine à états existante sans scheduler ; les rappels de RDV
  (qui exigent un scheduler) en second.
- **Vérification SMS (OTP)** — coût, dépendance externe. Le staff valide par appel.
- **Paliers de fidélité** — en attente des seuils de la gérante.
- **Sécurité mobile MASVS** — certificate pinning, détection root/jailbreak,
  Play Integrity / App Attest. Avant publication sur les stores.

---

## 4. Ordre recommandé pour la suite

1. **Terminer le durcissement** — Helmet + filtre d'exceptions *(le chapitre
   est ouvert, il reste 2 pièces)*
2. **Réparer les 11 suites de tests cassées** — `npm test` doit pouvoir servir
   de filet
3. **Config mobile** — URL d'API, identité de l'app, session morte
4. **Incohérences fonctionnelles** — téléphone, `RequireAuth`, devise, seed
5. **Déploiement** — Dockerfile, secrets, sauvegardes, EAS
6. **Puis seulement** : email, push, MASVS

---

## 5. Environnement de développement

```bash
# Base de données (à lancer en premier)
docker compose up -d

# Backend (port 3000) — Swagger sur /api-docs, sonde sur /health
cd backend && npm run start:dev

# Mobile (Expo)
cd mobile && npx expo start --clear
adb reverse tcp:8081 tcp:8081   # émulateur Android

# Backoffice (port 5173)
cd backoffice && npm run dev
```

**Comptes**
- `proprietaire@yaniconcept.ma` — ADMIN (seeded)
- `test@yani.ma` — STAFF

**Pièges connus**
- Prisma **6.19.3** — ne pas laisser `npx` installer la v7
- Toujours `npx expo install` (jamais `npm install`) pour les libs natives
- Vider le cache Metro après tout changement d'imports d'assets
- **Docker Desktop plante après une mise en veille** (`com.docker.build:
  exit status 1`). Remède : fermer Docker, `wsl --shutdown`, relancer.
  ⚠️ **Ne jamais cliquer « Reset to factory defaults »** — cela supprimerait
  le volume `yani_pgdata` et donc toute la base.
- Le rate limiting garde ses compteurs **en mémoire** : ils repartent à zéro à
  chaque redémarrage, et ne sont pas partagés entre instances (Redis le jour où).

---

## 6. Migrations ajoutées cette session

```
20260721191044_add_reason_to_loyalty_transaction
20260722172120_add_price_at_booking_to_appointment   (avec backfill)
```

Les deux sont additives et nullables : aucune perte de données.
