# Plan d'implémentation technique — YANIApp

**État de référence : 31 août 2026**  
**Périmètre : code, données techniques, tests, CI, Docker, sauvegarde et préparation au déploiement.**  
**Hors périmètre : achats et souscriptions** (nom de domaine, hébergement, fournisseur SMTP, comptes stores, offre EAS, stockage externe, etc.).

Ce document remplace les plans d'action dispersés dans `YANIApp_RECAP_3.md`,
`YANIApp_RECAP_4.md` et `YANIApp_RECAP_5.md`. Il ne considère pas qu'un ancien
constat est encore vrai par défaut : les points ci-dessous ont été recroisés avec
le code et l'état courant du projet.

## 1. Baseline vérifiée

| Contrôle | Résultat actuel |
|---|---|
| Backend — tests unitaires/intégration | **231/231**, 25 suites, vert |
| Backend — e2e | **2/2**, vert |
| Backend — build NestJS | Vert |
| Backoffice — build production Vite | Vert |
| Mobile — TypeScript | Vert |
| Mobile — textes i18n | 0 texte en dur détecté |
| Mobile — variables i18n | 310 clés cohérentes dans les 3 langues |
| Docker | PostgreSQL et backend `healthy`, migration sortie avec code 0 |
| Audit npm backend | **3 high** (`deepmerge-ts` via l'outillage Prisma) |
| Audit npm backoffice | **0** vulnérabilité |
| Audit npm mobile | **16** vulnérabilités : 5 high, 11 moderate |

Deux blocages de l'audit du 24 août sont déjà réglés : la migration
`20260822090000_rdv_occupe_un_creneau` et
`mobile/scripts/i18n-variables.js` sont maintenant suivis par Git (anciens Q1 et
Q2).

Les dossiers `brand/product-images/` et `brand/service-images/` sont en revanche
encore non suivis. Les scripts SQL créés pour relier les nouvelles images sont
dans `backups/`, donc volontairement ignorés par Git. La base locale est à jour,
mais le résultat n'est pas reproductible depuis un clone propre.

### Nouveau défaut P0 découvert pendant la vérification des images

Les nouvelles URLs ont des noms lisibles et versionnés, par exemple
`/uploads/product-…-20260831.webp` et `/uploads/service-…-20260831.webp`. Or le
contrat backend `UPLOADED_IMAGE_PATH` n'accepte que :

```text
/uploads/<UUID-v4>.jpg|png|webp
```

Les images s'affichent, car le serveur statique sert les fichiers, mais une
modification ultérieure d'une fiche qui renvoie l'`imageUrl` existante peut être
refusée par la validation. Ce décalage doit être corrigé avant toute autre passe
sur le catalogue.

## 2. Verdict et ordre de travail

Le projet est **fonctionnel et bien plus proche d'un lancement que d'une
réécriture**, mais il n'est pas encore « déploiement reproductible » : la base
locale, le dossier d'images et le dépôt ne décrivent pas encore le même état.

Ordre recommandé :

1. **P0 — rendre le catalogue et ses images reproductibles et conformes** ;
2. **P0 — verrouiller les règles de rendez-vous et les invariants backend** ;
3. **P1 — corriger la robustesse mobile/backoffice** ;
4. **P1 — ajouter les tests frontend et durcir la CI** ;
5. ~~**P2 — faire le catalogue trilingue en base**~~ — **livré le 1er septembre 2026** ;
6. **P0 final — répéter un déploiement et une restauration à blanc**.

Les lots sont volontairement découpés pour qu'un lot puisse être livré, testé et
commité sans attendre les suivants.

## 3. Décisions fonctionnelles nécessaires, sans achat

Ces décisions doivent être prises avant le lot correspondant. Elles ne demandent
aucune souscription.

| ID | Décision | Recommandation par défaut |
|---|---|---|
| D1 | Un rendez-vous peut-il occuper une cabine plus de 60 minutes ? | Si oui, autoriser au moins 90 et 120 min. Sinon, documenter explicitement que 60 min est une règle métier. |
| D2 | Modifier l'intervalle doit-il réinterpréter les rendez-vous déjà pris ? | Conserver le comportement actuel, mais afficher une confirmation claire. Si la réponse est non, il faut figer l'occupation à la réservation dans le schéma. |
| D3 | Une installation neuve doit-elle contenir le catalogue courant ? | **Oui** : fournir un import initial idempotent, sans écraser un catalogue déjà exploité. |
| D4 | Les traductions de catalogue doivent-elles être obligatoires immédiatement ? | Ajouter les champs et un statut « à traduire », avec repli français pendant la transition. |

## 4. Lot 0 — catalogue et images reproductibles

**Priorité : P0 — avant une nouvelle modification du catalogue**  
**Effort : 1,5 à 2,5 jours**

### 0.1 Créer une source de vérité versionnée

- Déplacer ou recopier les 15 images produits et 21 images services retenues dans
  un répertoire versionné dédié, par exemple
  `backend/catalog-assets/{products,services}/`.
- Ajouter un manifeste versionné, par exemple
  `backend/catalog-assets/manifest.json`, qui associe chaque produit/service à
  son image canonique.
- Ne pas utiliser `backups/*.sql` comme mécanisme de déploiement : `backups/` est
  ignoré pour protéger les données clientes.
- Décider explicitement du sort de `.claude/` : le versionner s'il fait partie de
  l'outillage du projet, sinon l'ignorer. Ne pas le supprimer automatiquement.

### 0.2 Ajouter un import idempotent du catalogue et des médias

Créer un script backend, par exemple `npm run catalog:sync`, avec deux modes :

- `--check` : aucune écriture ; valide le manifeste, les fichiers, les doublons,
  les formats et la présence des fiches ;
- `--apply` : copie les fichiers vers `UPLOADS_DIR` et met à jour les références
  dans une transaction Prisma.

Règles du script :

- générer ou utiliser des noms conformes au contrat UUID actuel ;
- ne jamais écraser un fichier sous une URL `immutable` ;
- vérifier le nom attendu en plus de l'identifiant avant une mise à jour ;
- échouer avec la liste exacte des fiches absentes ou ambiguës ;
- pouvoir être rejoué sans créer de doublons ;
- ne jamais modifier les prix, stocks ou textes d'un catalogue déjà exploité,
  sauf option d'import initial explicite ;
- sur base vide, charger le catalogue initial seulement si les tables catalogue
  sont vides (D3).

Le seed Prisma doit continuer à créer les horaires et l'administrateur. L'import
catalogue doit être une étape distincte et explicite, afin qu'un `db seed` rejoué
en production n'écrase jamais le travail de la gérante.

### 0.3 Réconcilier immédiatement la base active

- Créer de nouvelles copies aux noms UUID, sans modifier en place les fichiers
  déjà mis en cache.
- Mettre à jour les `imageUrl` des produits et services.
- Vérifier que chaque URL enregistrée respecte le même validateur que les DTO.
- Vérifier un `PUT` réel sur une fiche produit et une fiche service qui gardent
  leur image actuelle.
- Une fois validé, garder les anciens fichiers jusqu'au passage du nettoyeur ; ne
  pas les supprimer à la main pendant la migration.

### 0.4 Gérer les images orphelines (ancien Q5)

Ajouter une commande sûre, par exemple :

```text
npm run uploads:prune -- --dry-run
npm run uploads:prune -- --apply --older-than=24h
```

Elle doit comparer le dossier aux références de `services.image_url` et
`products.image_url`, ignorer les fichiers récents, refuser de supprimer hors de
`UPLOADS_DIR`, et être en `dry-run` par défaut. C'est plus sûr que supprimer le
fichier dans la même requête que la mise à jour SQL, car le système de fichiers
ne participe pas à la transaction Prisma.

### 0.5 Tests et documentation du lot

- Tests de signatures JPEG/PNG/WebP, fichier tronqué, type inconnu et chemin
  public (ancien Q7).
- Tests du manifeste et de l'idempotence de l'import.
- Test du nettoyeur sur un dossier temporaire.
- Mettre à jour `README.md`, `scripts/backup.sh` et les commentaires qui parlent
  encore de l'ancien volume nommé `yani_uploads` : le Compose utilise maintenant
  le bind mount `./backend/uploads:/app/uploads`.
- Documenter clairement qu'une sauvegarde complète contient **le dump et
  l'archive des images du même horodatage** (ancien Q11).

**Critères d'acceptation :**

- 100 % des `imageUrl` passent le validateur backend ;
- 100 % des fichiers référencés répondent HTTP 200 ;
- un clone propre peut reproduire le catalogue initial et ses images ;
- modifier une fiche existante ne produit plus de 400 lié à son ancienne URL ;
- `catalog:sync --check` et `uploads:prune --dry-run` tournent en CI.

## 5. Lot 1 — règle de réservation et capacité

**Priorité : P0**  
**Effort : 0,5 à 1 jour**

### 1.1 Rendre le réglage compréhensible (ancien Q3)

Dans `OpeningHoursPage.tsx` et le DTO Swagger :

- remplacer « Écart entre créneaux » par « Un rendez-vous occupe » ou « Durée
  d'occupation d'une cabine » ;
- expliquer que cette valeur pilote à la fois la grille proposée et la capacité ;
- prévenir qu'une modification change aussi l'interprétation des rendez-vous
  existants ;
- afficher une confirmation avant l'enregistrement si la valeur change.

### 1.2 Trancher le plafond de 60 minutes (ancien Q4)

- Appliquer D1 aux constantes backend **et** backoffice.
- Ajouter des tests de disponibilité pour 60, 90 et 120 minutes si ces valeurs
  sont autorisées.
- Tester les pauses, la fin de journée et un changement de valeur avec des RDV
  existants.

### 1.3 Nettoyage associé

- Retirer `endAt` de la valeur retournée par `assertSlotAvailable` puisqu'il n'est
  jamais consommé (Q22), ou le rendre réellement utile si D2 impose de le figer.
- Corriger le commentaire périmé dans
  `backoffice/src/api/appointments.ts` (Q10).
- Corriger le commentaire trompeur de la migration
  `20260822090000_rdv_occupe_un_creneau` sans modifier son SQL déjà livré (Q21).

**Critères d'acceptation :** la gérante peut expliquer l'effet du réglage à partir
du texte de l'écran ; les tests prouvent la capacité, la pause et le comportement
rétroactif choisi.

## 6. Lot 2 — durcissement backend

**Priorité : P0/P1**  
**Effort : 2 à 3 jours**

| ID | Travail | Validation attendue |
|---|---|---|
| B1 — Q13 | Rendre la rotation du refresh token atomique avec un `updateMany` conditionné par `revokedAt: null`, puis traiter `count === 0` comme un rejeu. | Test concurrent : deux refresh simultanés, un seul succès et famille compromise selon la règle actuelle. |
| B2 — Q12 | Échapper le prénom et toute donnée variable avant interpolation dans le HTML des emails. | Tests avec `&`, `<`, `>`, guillemets et prénom normal ; version texte inchangée. |
| B3 — Q14 | Ajouter `@MaxLength(72)` à `LoginDto.password` et aligner Swagger. | 72 accepté, 73 refusé avant Argon2. |
| B4 — Q15/Q16 | Valider `CORS_ORIGINS` et `CENTER_TIMEZONE` au démarrage ; découper, trimer, retirer les entrées vides et refuser une origine invalide. | Démarrage refusé sur fuseau/origine invalide ; liste avec espaces normalisée. |
| B5 — Q17 | Refuser `updateRole` quand `deletedAt` n'est pas nul. | Test d'un compte anonymisé/supprimé. |
| B6 — Q18 | Exiger `from <= to` dans les exports. | Erreur 400 traduisible, plus de classeur vide silencieux. |
| B7 — Q6 | Compter les vraies lignes des deux feuilles avant chaque export, notamment les `orderItem` et les agrégats `COMPLETED`. | Tests sous/au-dessus du plafond pour les deux feuilles et tous les statuts. |
| B8 — Q8 | Faire passer `ImageTooLargeFilter` par la même traduction que les autres erreurs, ou supprimer le motif mort avec justification. | Réponse FR/AR/EN testée. |
| B9 — Q9 | Remplacer le 401 générique « Unauthorized » par un message stable et traduisible. | Route protégée testée dans les trois langues. |
| B10 — Q24 | Migrer la configuration du seed de `package.json` vers `prisma.config.ts` avant Prisma 7. | `prisma db seed` fonctionne dans une base vide en local et en CI. |
| B11 — Q25 | Aligner les `maxLength` HTML de `CatalogForm` sur les DTO backend. | Impossible de saisir côté UI une valeur que l'API refusera uniquement pour sa longueur. |
| B12 | Ajouter un `lint:check` non mutateur. Le script `lint` actuel utilise `--fix`, donc il ne convient pas comme garde CI. | Build, lint, 231 tests et e2e verts. |

Les corrections B1, B4, B6 et B7 doivent être livrées avant un lancement public.
Les autres peuvent partager le même lot, car elles touchent peu de fichiers et
leurs tests sont courts.

## 7. Lot 3 — robustesse mobile et backoffice

**Priorité : P1**  
**Effort : 3 à 5 jours hors création de l'infrastructure de tests**

L'ancien audit annonce « 17 constats », mais sa table contient en réalité **18
lignes**. Le plan conserve les 18, plus Q19 côté réservation.

### 3.1 Mobile — erreurs, cycle de vie et données

- **I20** : remplacer le tout-ou-rien des six appels de `LoyaltyScreen` par un
  chargement partiel maîtrisé. Le compte/solde peut être bloquant ; historique,
  récompenses, paliers, grants et bons doivent pouvoir afficher leur propre
  erreur et être retentés sans vider les autres sections.
- **M5** : recharger `MyOrdersScreen` avec `useFocusEffect`, comme les données qui
  peuvent changer pendant que l'écran est quitté.
- **Q19** : mémoïser les quatorze jours de `BookingScreen`, gérer le passage de
  minuit et supprimer le `find(...)!` sans repli.
- **M15** : accepter `null`, `undefined`, `NaN` et les valeurs non finies dans
  `formatPrice` ; afficher `—` au lieu de planter.
- **M21** : centraliser l'affichage distant dans un composant image avec
  `onError`, placeholder, ratio stable et nouvelle tentative raisonnable.
- **M23** : revenir en arrière seulement depuis l'action de confirmation du
  message de succès du profil, pas immédiatement après son ouverture.

### 3.2 Mobile — accessibilité et qualité d'interface

- **I28** : rendre le splash skippable, arrêter animations/timers au démontage et
  garantir que `onFinish` n'est appelé qu'une fois.
- **I29** : conserver le nom accessible du bouton pendant `loading`, avec état
  `busy`/désactivé.
- **M16** : porter la cible tactile des `Chip` à au moins 44 pt.
- **M24** : ajouter `autoComplete`, `textContentType`, type de clavier et gestion
  du mot de passe sur `ChangePassword` et `EditProfile`.
- **M19** : remplacer les usages dépréciés de `pointerEvents` selon l'API RN 0.86.
- **M22** : unifier les trois formulations du bandeau de fidélité.
- **M9** : ne dire « À partir de » que si le modèle porte réellement plusieurs
  prix ; sinon afficher simplement le prix.
- **M11** : plafonner le nombre de pastilles de fidélité affichées et conserver un
  texte numérique exact pour les grands seuils.
- **Point 59** : inverser les quatre dégradés directionnels en RTL
  (`LoyaltyBanner`, `LoyaltyScreen`, `Button`, `SplashScreen`).

### 3.3 Mobile — dette simple

- **I30** : supprimer `components/Screen.tsx` s'il reste inutilisé. Ne pas migrer
  24 écrans uniquement pour justifier son existence.
- **M4** : déplacer la préférence de thème, non secrète, de `SecureStore` vers
  `AsyncStorage`, avec reprise de l'ancienne valeur une seule fois.
- **M17** : générer un identifiant de gradient SVG unique dans `Drop`.
- **M18** : mémoïser la valeur fournie par `AlertProvider`.
- **M20** : retirer `cartCount` mort dans `ProductDetailScreen`.

### 3.4 Backoffice

- **Q20** : ne plus faire tomber tout le tableau de bord si une seule source
  échoue. Charger commandes, rendez-vous et stock séparément, avec une erreur et
  un bouton de reprise par bloc.
- Réutiliser le même comportement partiel pour I20 côté mobile, mais sans forcer
  les deux interfaces à partager une abstraction artificielle.
- Ajouter l'état de progression/erreur à l'upload du catalogue et empêcher la
  sauvegarde tant qu'un fichier est encore en cours d'envoi.

**Critères d'acceptation :** aucun écran critique ne devient vide à cause d'une
source secondaire ; passage de minuit testé ; images cassées dégradées proprement ;
contrôles tactiles et boutons de chargement annoncés correctement par le lecteur
d'écran.

## 8. Lot 4 — tests frontend, dépendances et CI

**Priorité : P1**  
**Effort : 2,5 à 4 jours**

### 4.1 Installer un vrai filet mobile

Ajouter Jest + React Native Testing Library, avec au minimum :

1. `formatPrice` sur valeurs valides et invalides ;
2. `Button` normal/loading/disabled et son accessibilité ;
3. `BookingScreen` au passage de minuit ;
4. `LoyaltyScreen` avec une des six APIs en erreur ;
5. `MyOrdersScreen` au retour de focus ;
6. composant d'image en succès et en erreur ;
7. store/session : refresh, expiration et changement de compte.

### 4.2 Ajouter le filet backoffice

Ajouter Vitest + Testing Library, avec au minimum :

1. garde d'authentification et rôles ;
2. tableau de bord en succès partiel ;
3. `CatalogForm` : limites, upload, annulation, erreur et conservation d'image ;
4. réglage d'occupation : texte, confirmation et valeurs autorisées ;
5. export : validation de période côté UI.

### 4.3 Traiter les vulnérabilités sans `--force` aveugle (ancien Q23)

- **Backend** : rechercher une version Prisma corrigée compatible ; ne pas suivre
  la suggestion actuelle qui force une rétrogradation vers Prisma 6.12 sans
  vérifier les migrations et le client.
- **Mobile** : appliquer d'abord les mises à jour patch compatibles Expo 57 et
  `npx expo install --fix`; traiter `image-size` via Metro/Expo et `uuid` via une
  version Expo/config-plugins corrigée ou un override prouvé par les tests.
- Rejouer `expo doctor`, typecheck et les tests sur Android au minimum.
- Le critère n'est pas forcément « zéro alerte » à n'importe quel prix : toute
  alerte restante doit avoir une analyse d'exploitabilité, un propriétaire et
  une date de révision. Aucune vulnérabilité high non acceptée ne doit rester.

### 4.4 Renforcer la CI

Ajouter aux jobs existants :

- tests mobile et backoffice ;
- `lint:check` sur les trois projets ;
- `npm audit --omit=dev --audit-level=high` après assainissement ;
- `catalog:sync --check` et validation du manifeste média ;
- test du seed via `prisma.config.ts` ;
- `docker compose config` ;
- vérification qu'aucun fichier attendu n'est non suivi dans la livraison.

Conserver les tests backend avec PostgreSQL réel et `--runInBand` : les garanties
de concurrence en dépendent.

## 9. Lot 5 — catalogue trilingue en base — **LIVRÉ**

**Livré le 1er septembre 2026.** Ce lot correspond au point 61 de la RECAP 3.

### Ce qui a été fait

1. **Migration additive** `20260901161011_catalogue_trilingue` : `name_ar`,
   `name_en`, `description_ar`, `description_en` sur `services`, `products` et
   `rewards` ; `name_ar` et `name_en` sur les deux tables de catégories. Les
   colonnes françaises ne bougent pas et restent la saisie de la gérante.
2. **Pas de statut « à traduire » en base** : une colonne vide le dit déjà, et
   un booléen aurait menti dès qu'on modifie un texte sans le remettre à jour.
   Cela remplace l'étape « recopier le français dans les trois langues » du
   plan initial, ainsi que la migration de suppression qu'elle impliquait.
3. **Sérialisation** par `LocalizeCatalogInterceptor`, global : tout objet de
   réponse portant une traduction est servi traduit, où qu'il soit imbriqué —
   rendez-vous, bons, historique de points, commandes. En français, la réponse
   n'est pas touchée, ce qui laisse au back-office les colonnes à éditer.
4. **`X-Locale` l'emporte sur `Accept-Language`**, et le back-office envoie
   `X-Locale: fr`. Un navigateur pose lui-même `Accept-Language` : sans cela,
   un Chrome en anglais aurait chargé la traduction anglaise dans le champ
   français du formulaire et l'aurait réenregistrée par-dessus l'original.
   Corrige au passage un défaut existant sur les messages d'erreur.
5. **Back-office** : onglets FR / AR / EN sur le formulaire du catalogue, avec
   pastille sur les langues manquantes, badge « À traduire » sur les lignes des
   listes, champs arabe et anglais pour les catégories et les récompenses.
6. **Contenu** : 123 fiches traduites — 88 prestations, 15 produits,
   18 catégories, 2 récompenses — dans `backend/prisma/catalog-translations.json`,
   versionné, chargé par `npm run catalog:translate` (idempotent, n'écrase
   jamais une traduction saisie dans le back-office).
7. **Mobile** : aucune ligne d'affichage à changer, l'API renvoie déjà `name`
   traduit. Seuls les deux écrans de détail rechargent désormais sur changement
   de langue, faute de `useFocusEffect`.

### Ce qui reste ouvert

- La relecture des traductions par une personne arabophone du métier, comme
  pour l'interface (voir l'entête de `mobile/src/i18n/locales/ar.ts`).
- Les noms français comportent des fautes de frappe d'origine (« Visage +
  coup », « Detatouage », « Savon eclairssisent »). Les traductions écrivent la
  forme correcte ; le français n'a pas été corrigé, c'est la saisie de la
  gérante et la clé de rapprochement du fichier de traductions.
- La recherche mobile filtre sur le nom servi, donc dans la langue affichée.
  Chercher un mot français dans l'interface arabe ne donne rien : à trancher si
  la clientèle mélange les deux.

## 10. Lot 6 — répétition technique du déploiement

**Priorité : P0 final**  
**Effort : 1 à 1,5 jour**

### 6.1 Test depuis un clone propre

- Cloner dans un dossier vide.
- Créer les `.env` depuis les modèles.
- Construire les trois projets avec `npm ci`.
- Lancer `docker compose up --build`.
- Appliquer migrations, seed et import catalogue.
- Vérifier `/health`, l'authentification, une inscription/confirmation, un RDV,
  une commande, les points, un export et un upload.
- Vérifier chaque image publique depuis l'adresse réellement utilisée par le
  mobile et le backoffice.

### 6.2 Validation de configuration

- Compléter `env.validation.ts` pour toutes les valeurs silencieusement
  dangereuses.
- Ajouter une commande `config:check` sans démarrer le serveur.
- Documenter le port PostgreSQL local configurable (`55432` est nécessaire sur
  ce poste Windows) sans imposer cette valeur en production.
- Fournir un exemple de reverse proxy qui transmet toutes les routes, y compris
  `/uploads`, et positionne les en-têtes attendus. L'achat/configuration du
  domaine et du certificat reste hors périmètre.

### 6.3 Sauvegarde et restauration réelles

- Produire un nouveau couple dump + archive média après la normalisation des
  images.
- Restaurer le couple dans une base et un dossier vides.
- Comparer les comptages des tables critiques.
- Vérifier que toutes les URLs référencées existent sur disque et réciproquement
  lister les orphelins.
- Écrire le résultat et la date de l'exercice dans un runbook, sans versionner de
  données clientes.

### 6.4 Rollback

- Définir pour chaque migration si le rollback est applicatif ou par restauration
  de sauvegarde.
- Conserver l'image Docker précédente et tester son démarrage contre le schéma
  nouvellement migré quand la migration est additive.
- Pour les médias, ne supprimer les anciens fichiers qu'après expiration du cache
  et validation du nouveau manifeste.

**Critère final :** une personne qui n'a pas participé au développement doit
pouvoir suivre le runbook, partir d'un clone propre, obtenir une pile saine et
restaurer le couple base/images sans connaissance orale.

## 11. Backlog technique conditionnel

Ces points sont réels, mais les implémenter maintenant apporterait peu par rapport
à leur coût. Ils doivent avoir un seuil de déclenchement explicite.

| Sujet | État accepté aujourd'hui | Déclencheur d'implémentation |
|---|---|---|
| Rate limiting distribué | Mémoire locale, une instance | Avant de lancer une deuxième instance backend : Redis/store partagé. |
| Pagination catalogues publics | Tout le catalogue actif | À partir d'environ 100 éléments ou si la réponse dépasse 500 kB. |
| Pagination listes secondaires backoffice | Bons, fermetures, récompenses/paliers non paginés | Quand une page dépasse 100 lignes ou montre une latence mesurée. |
| Alerte stock du dashboard | Charge tout le catalogue produits | Créer un endpoint agrégé/low-stock au même seuil que la pagination catalogue. |
| Observabilité centralisée | Logs Docker + healthcheck | Avant trafic public significatif : request ID, journalisation structurée, erreurs centralisées et alertes de sauvegarde. |
| Notifications push | Non implémentées | Après disponibilité des identifiants natifs et du canal externe ; les achats/comptes restent hors de ce plan. |

## 12. Découpage en livraisons

| Livraison | Contenu | Condition de sortie |
|---|---|---|
| R1 — médias fiables | Lot 0 | Clone propre reproductible, URLs conformes, sauvegarde paire validée. |
| R2 — cœur métier durci | Lots 1 et 2 | Tests backend/e2e verts, décisions D1/D2 appliquées. |
| R3 — clients robustes | Lot 3 | Correctifs mobile/backoffice et smoke manuel sur appareil. |
| R4 — filets automatiques | Lot 4 | Tests frontend et CI verts, highs npm traités ou acceptés formellement. |
| R5 — trilingue | ~~Lot 5~~ **levé** | Migration additive livrée, repli FR vérifié, onglets FR/AR/EN dans le back-office, 123 fiches traduites. |
| R6 — répétition générale | Lot 6 | Déploiement et restauration à blanc documentés et réussis. |

## 13. Estimation globale

- **Noyau technique avant lancement, hors catalogue trilingue : 11 à 17
  jours-développeur.**
- ~~**Catalogue trilingue côté code : +3 à 5 jours-développeur.**~~ Livré.
- La traduction/saisie réelle des noms et descriptions n'est pas une tâche de
  code et n'entre pas dans cette estimation.
- Les achats, ouvertures de comptes et délais de validation externes sont exclus.

L'estimation haute suppose qu'on ajoute les tests frontend avant de déclarer les
correctifs terminés. La retirer ferait gagner quelques jours, mais laisserait
exactement la zone la moins couverte du projet — mobile et backoffice — sans
garde-fou.

## 14. Definition of Done technique

Le projet est techniquement prêt quand toutes les conditions suivantes sont
vraies :

- arbre Git propre et tous les assets/scripts nécessaires versionnés ;
- clone propre reproductible sans SQL caché dans `backups/` ;
- migrations, seed et import catalogue idempotents ;
- base et dossier d'images cohérents, URLs conformes et accessibles ;
- build backend/backoffice, typecheck mobile, i18n, 231 tests backend et e2e verts ;
- tests critiques mobile/backoffice verts ;
- aucune vulnérabilité high non analysée et acceptée ;
- configuration invalide refusée avant le démarrage ;
- sauvegarde base + images restaurée avec succès ;
- smoke test complet réussi sur la pile construite depuis un clone propre ;
- runbook de déploiement et rollback lisible sans connaissance orale du projet.

