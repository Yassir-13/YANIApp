# Figures du rapport

Ce dossier reçoit les **images et diagrammes** du rapport.

Tant qu'un fichier manque, le rapport affiche à sa place un **cadre d'attente**
portant le nom de fichier attendu et la légende. Le document compile donc
complètement dès maintenant.

**Pour insérer une figure : déposer le fichier ici sous le nom exact indiqué
ci-dessous, puis recompiler.** Aucune modification du texte n'est nécessaire.

- Formats acceptés : `.png`, `.jpg`, `.pdf`. Le PDF est préférable pour les
  diagrammes (net à toute échelle) ; le PNG convient aux captures d'écran.
- Résolution conseillée pour les captures : au moins 1080 px de large pour le
  mobile, 1600 px pour le back-office.
- Le nom de fichier doit être **exactement** celui de la colonne « Fichier »,
  extension comprise. Pour livrer un diagramme en PDF plutôt qu'en PNG, changer
  l'extension dans l'appel `\figProjet` correspondant du fichier `.tex`.

---

## Page de garde

| Fichier | Contenu attendu |
|---|---|
| `logo.png` | Logo de l'institut. Disponible dans le dépôt : `brand/logo-master.png` — le copier ici sous le nom `logo.png`. |

## Chapitre 1 — Organisme d'accueil et contexte

| Fichier | Contenu attendu |
|---|---|
| `organisation-centre.png` | Organigramme du centre : la gérante, le personnel, les clientes, et le rôle système correspondant à chacun. |
| `scrum.png` | Schéma du cycle SCRUM : product backlog → sprint planning → sprint (24 h) → incrément → revue → rétrospective. |
| `tdd.png` | Cycle du développement piloté par les tests : rouge → vert → refactorisation. |
| `gantt.png` | Diagramme de Gantt du projet. Les six sprints (6 juillet – 27 août 2026) sont détaillés dans le tableau 1.4 du rapport. |

## Chapitre 2 — Analyse et conception

### Cas d'utilisation

| Fichier | Contenu attendu |
|---|---|
| `cu-general.png` | Diagramme de cas d'utilisation général, tous acteurs : visiteuse, cliente, personnel, gérante, service de messagerie. |
| `cu-reservation.png` | Cas d'utilisation du domaine rendez-vous : consulter les disponibilités, réserver, annuler, réserver pour une cliente, confirmer, clôturer, reporter. |
| `cu-commande.png` | Cas d'utilisation du domaine commande : panier, passer commande, suivre, annuler, confirmer, préparer, remettre. |
| `cu-fidelite.png` | Cas d'utilisation du programme de fidélité, avec les **deux circuits** de récompense (palier de visites et échange de points) convergeant vers l'émission d'un bon. |
| `cu-backoffice.png` | Cas d'utilisation réservés au personnel et à la gérante : catalogue, horaires, réglages, utilisateurs, journal d'audit, exports. |

### Séquences

| Fichier | Contenu attendu |
|---|---|
| `seq-inscription.png` | Inscription puis vérification de l'adresse e-mail. Acteurs : cliente, application, API, base, service de messagerie. Montrer que l'inscription renvoie **directement** les jetons de session. |
| `seq-reservation.png` | Réservation d'un créneau. **Point clé à faire apparaître** : ouverture de la transaction, prise du verrou consultatif `pg_advisory_xact_lock`, puis contrôles (prestation active, date non passée, jour ouvert, capacité) et insertion — le tout à l'intérieur du verrou. |
| `seq-commande.png` | Commande puis confirmation par le personnel, avec le décrément **conditionnel et atomique** du stock, et le retour en arrière si la condition n'est pas satisfaite. |
| `seq-fidelite.png` | Clôture d'un rendez-vous : changement de statut, calcul des points sur le tarif figé, incrément du solde et du compteur de visites, écriture du mouvement, évaluation des paliers — dans une transaction unique. |
| `seq-refresh.png` | Rafraîchissement des jetons : rotation, et **cas de la réutilisation détectée** qui révoque toute la famille de jetons. |

### Structure des données

| Fichier | Contenu attendu |
|---|---|
| `diagramme-classes.png` | Diagramme de classes des 19 entités. La source de vérité est `backend/prisma/schema.prisma`. Faire apparaître les modes de suppression, qui portent des règles métier : `Restrict` sur rendez-vous et commandes (préserve l'historique), `SetNull` sur les employées, `Cascade` sur les données personnelles. |

## Chapitre 3 — Étude technique

| Fichier | Contenu attendu |
|---|---|
| `couches.png` | Les quatre couches : présentation (mobile + back-office), métier (NestJS), accès aux données (Prisma), persistance (PostgreSQL). |
| `architecture.png` | Architecture de déploiement : reverse proxy HTTPS → API conteneurisée → PostgreSQL, avec le service de migration à usage unique et les volumes persistants. |

## Chapitre 4 — Sécurité

| Fichier | Contenu attendu |
|---|---|
| `securite-surface.png` | Surface d'attaque et **frontières de confiance**. Placer la frontière à l'entrée de l'API : côté non fiable, l'application mobile, le back-office et tout ce qui vient d'un client ; côté fiable, l'API, la base (port non publié) et le dossier des images. C'est le schéma qui porte l'idée directrice du chapitre. |
| `securite.png` | Chaîne de traitement d'une requête : Helmet → limitation de débit → CORS → authentification JWT → autorisation par rôle → validation des entrées → service métier, avec le filtre d'exceptions en sortie. |

Le chapitre réutilise par ailleurs `seq-refresh.png` (chapitre 2) pour la
rotation des jetons : il n'y a pas de second fichier à produire.

## Chapitre 5 — Mise en œuvre

### Structure du code

| Fichier | Contenu attendu |
|---|---|
| `structure-backend.png` | Arborescence de `backend/src` : les 14 modules et les 3 dossiers partagés (`common`, `config`, `i18n`). |
| `structure-backoffice.png` | Arborescence de `backoffice/src` : pages, composants, api, stores, theme. |
| `structure-mobile.png` | Arborescence de `mobile/src` : screens, components, navigation, api, stores, theme, i18n. |

### Tests

| Fichier | Contenu attendu |
|---|---|
| `ci-github.png` | Capture de l'exécution du workflow GitHub Actions (les trois travaux : backend, back-office, mobile). |
| `resultats-tests.png` | Sortie de `npx jest --runInBand` : 25 suites, 231 tests, tout au vert. |

### Captures — application mobile

Ces figures vont **par paires** (deux captures côte à côte). Il faut donc les
deux fichiers d'une ligne pour que la paire s'affiche complètement.

| Fichiers | Contenu attendu |
|---|---|
| `mobile-connexion.png` · `mobile-inscription.png` | Connexion · Inscription |
| `mobile-verification.png` · `mobile-mdp-oublie.png` | Saisie du code de vérification · Mot de passe oublié |
| `mobile-accueil.png` · `mobile-prestations.png` | Accueil · Catalogue des prestations |
| `mobile-detail-prestation.png` · `mobile-produits.png` | Détail d'une prestation · Catalogue des produits |
| `mobile-reservation.png` · `mobile-recap-reservation.png` | Grille des créneaux (montrer des créneaux désactivés) · Récapitulatif |
| `mobile-confirmation-rdv.png` · `mobile-mes-rdv.png` | Confirmation du rendez-vous · Mes rendez-vous |
| `mobile-detail-produit.png` · `mobile-panier.png` | Détail d'un produit · Panier |
| `mobile-checkout.png` · `mobile-mes-commandes.png` | Validation de commande (retrait/livraison) · Mes commandes |
| `mobile-fidelite.png` · `mobile-recompenses.png` | Écran de fidélité (solde, palier, catalogue) · Mes bons de récompense avec leur code |
| `mobile-profil.png` · `mobile-edition-profil.png` | Profil et réglages (langue, thème) · Modification du profil |

### Captures — back-office

| Fichier | Contenu attendu |
|---|---|
| `bo-connexion.png` | Écran de connexion. |
| `bo-dashboard.png` | Tableau de bord : commandes en attente, rendez-vous du jour, alertes de stock faible. |
| `bo-commandes.png` | Gestion des commandes, par statut. |
| `bo-rendezvous.png` | Gestion des rendez-vous, avec la réservation pour le compte d'une cliente. |
| `bo-catalogue.png` | Gestion du catalogue : prestations, produits, catégories, stocks. |
| `bo-fidelite.png` | Récompenses, paliers, bons dus au comptoir, ajout manuel de points. |
| `bo-horaires.png` | Plages d'ouverture, fermetures exceptionnelles, capacité et écart entre créneaux. |
| `bo-utilisateurs.png` | Gestion des comptes et des rôles. |
| `bo-export.png` | Fenêtre d'export Excel (choix de la période). |

### Courriel

| Fichier | Contenu attendu |
|---|---|
| `mail-verification.png` | Courriel de vérification d'adresse reçu par la cliente. En mode `console`, le contenu s'affiche dans les journaux du serveur. |

---

## Récapitulatif

**54 fichiers** au total : 1 logo, 4 pour le chapitre 1, 11 pour le chapitre 2,
2 pour le chapitre 3, 2 pour le chapitre 4 (sécurité), et 34 pour le chapitre 5
(dont 20 captures mobile).

Pour vérifier ce qui manque encore, compiler et parcourir le PDF : chaque cadre
d'attente restant porte le nom du fichier à fournir.
