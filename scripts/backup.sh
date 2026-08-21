#!/bin/sh
# Sauvegarde de Yani Concept : la base PostgreSQL, ET les images du catalogue.
#
# C'est le seul point du projet dont la perte est DÉFINITIVE. Un bug se corrige,
# des données effacées ne reviennent pas : clientes, rendez-vous, commandes,
# points de fidélité, bons non encore honorés.
#
# ⚠️ Les photos de prestations et de produits ne sont PAS dans la base : elles
# vivent dans le volume Docker `yani_uploads`, et `pg_dump` ne les voit pas.
# D'où DEUX fichiers par sauvegarde, à garder ensemble — une base restaurée sans
# ses images rend un catalogue dont toutes les photos manquent.
#
# ── Utilisation ──
#   ./scripts/backup.sh              → écrit dans ./backups
#   BACKUP_DIR=/mnt/sauvegardes ./scripts/backup.sh
#
# Produit, sous un même horodatage :
#   yani_AAAA-MM-JJ_HHMMSS.dump             → la base
#   yani_AAAA-MM-JJ_HHMMSS_images.tar.gz    → les images du catalogue
#
# À lancer depuis la racine du dépôt (là où vivent .env et docker-compose.yml).
# Fonctionne aussi sous Windows dans Git Bash.
#
# ── Automatisation ──
# Sur le serveur, une ligne de crontab suffit — tous les jours à 3 h du matin :
#   0 3 * * * cd /chemin/vers/YANIApp && ./scripts/backup.sh >> /var/log/yani-backup.log 2>&1
#
# ⚠️ LE POINT QUI COMPTE PLUS QUE CE SCRIPT
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde. Il faut en restaurer
# une AU MOINS UNE FOIS, sur une base vide, et vérifier qu'on retrouve les mêmes
# données. Sans ça, on découvre le jour de l'incident que les dumps étaient vides
# depuis six mois. La procédure est en bas de ce fichier.
#
# ⚠️ ET UN AUTRE, TANT QU'ON Y EST
#
# Ne JAMAIS cliquer « Reset to factory defaults » dans Docker Desktop : le
# volume `yani_pgdata` part avec, sans confirmation utile.

set -eu

# ── Configuration ────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
# Nombre de jours de sauvegardes conservés sur place. Les copies plus anciennes
# sont supprimées — ce script ne remplace pas une copie HORS de la machine.
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Emplacement des images DANS le conteneur de l'API : c'est là que
# docker-compose.yml monte le volume `yani_uploads`. À corriger ici si ce
# montage change là-bas, ou si UPLOADS_DIR est redéfini pour le conteneur.
DOSSIER_IMAGES="/app/uploads"

# ── Vérifications ────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "ERREUR : .env introuvable. Lancez ce script depuis la racine du dépôt." >&2
  exit 1
fi

# Les identifiants viennent du .env, jamais du script : rien de sensible ici,
# ce fichier est versionné.
# shellcheck disable=SC1091
. ./.env

if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
  echo "ERREUR : POSTGRES_USER et POSTGRES_DB doivent être définis dans .env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

HORODATAGE=$(date +%Y-%m-%d_%H%M%S)
FICHIER="$BACKUP_DIR/yani_${HORODATAGE}.dump"
FICHIER_IMAGES="$BACKUP_DIR/yani_${HORODATAGE}_images.tar.gz"

# ── Sauvegarde de la base ────────────────────────────────────────────────
# Format personnalisé (-Fc) plutôt que du SQL brut : compressé, et il permet
# une restauration sélective (une seule table) le jour où on en a besoin.
#
# `exec -T` : sans lui, docker tente d'allouer un terminal et le dump ressort
# corrompu par les caractères de contrôle — panne classique, et silencieuse
# jusqu'à la restauration.
echo "Sauvegarde de $POSTGRES_DB vers $FICHIER …"
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$FICHIER"

# Un dump vide ou minuscule signale un échec que pg_dump n'a pas signalé.
# Repli sur `wc -c` : `stat` n'a pas les mêmes options selon les systèmes.
TAILLE=$(wc -c < "$FICHIER" | tr -d ' ')
if [ "$TAILLE" -lt 1000 ]; then
  echo "ERREUR : le dump ne fait que $TAILLE octets. Sauvegarde suspecte, conservée pour inspection." >&2
  exit 1
fi

echo "OK — $FICHIER ($TAILLE octets)"

# ── Sauvegarde des images du catalogue ───────────────────────────────────
# Archivées depuis le conteneur de l'API, et non depuis le volume Docker
# directement : le nom réel du volume est préfixé par celui du projet compose
# (`yaniapp_yani_uploads` ici, autre chose ailleurs). Passer par le conteneur
# évite de le deviner, et n'exige aucune image supplémentaire.
#
# `-C "$DOSSIER_IMAGES" .` plutôt que le chemin complet : l'archive contient les
# fichiers seuls, sans l'arborescence `app/uploads/`. C'est ce qui permet de la
# restaurer telle quelle, y compris si le dossier déménage un jour.
#
# AUCUN seuil de taille ici, contrairement au dump : un catalogue sans photo est
# un état parfaitement normal, surtout à l'installation. L'archive fait alors une
# centaine d'octets, et ce n'est pas une anomalie.
#
# `MSYS_NO_PATHCONV=1` est là pour Git Bash sous Windows, et pour lui seul :
# sans cette variable, il « traduit » l'argument /app/uploads en chemin Windows
# avant de le passer à docker, et tar cherchait le dossier dans l'installation
# de Git. Sur un serveur Linux, c'est une variable inutilisée, sans effet.
echo "Archivage des images vers $FICHIER_IMAGES …"
if ! MSYS_NO_PATHCONV=1 docker compose exec -T backend \
  tar -czf - -C "$DOSSIER_IMAGES" . > "$FICHIER_IMAGES"; then
  # Le fichier partiel est effacé : un flux gzip tronqué ne se lit pas, et le
  # laisser sur place ferait croire à une sauvegarde complète le jour où on en
  # aura besoin. La base, elle, est déjà écrite et reste valable.
  rm -f "$FICHIER_IMAGES"
  echo "ERREUR : archivage des images impossible (conteneur backend arrêté ?)." >&2
  echo "         La base est bien sauvegardée dans $FICHIER." >&2
  exit 1
fi

TAILLE_IMAGES=$(wc -c < "$FICHIER_IMAGES" | tr -d ' ')
echo "OK — $FICHIER_IMAGES ($TAILLE_IMAGES octets)"

# ── Rotation ─────────────────────────────────────────────────────────────
echo "Suppression des sauvegardes de plus de $RETENTION_DAYS jours…"
find "$BACKUP_DIR" \
  \( -name 'yani_*.dump' -o -name 'yani_*_images.tar.gz' \) \
  -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "Terminé."

# ═══════════════════════════════════════════════════════════════════════════
#  RESTAURATION — à faire à la main, jamais par script
# ═══════════════════════════════════════════════════════════════════════════
#
# Volontairement non automatisée : une restauration écrase des données réelles.
# Une commande qu'on tape est une commande qu'on a décidé de taper.
#
# 1. Créer une base VIDE à côté de la vraie (ne jamais restaurer par-dessus
#    sans avoir vérifié le dump d'abord) :
#
#      docker compose exec postgres createdb -U <utilisateur> yani_verif
#
# 2. Y restaurer le dump :
#
#      docker compose exec -T postgres \
#        pg_restore -U <utilisateur> -d yani_verif < backups/yani_AAAA-MM-JJ_HHMMSS.dump
#
# 3. Comparer les comptages avec la base réelle. S'ils correspondent, le dump
#    est bon :
#
#      docker compose exec postgres psql -U <utilisateur> -d yani_verif -c \
#        "select 'users', count(*) from users
#         union all select 'appointments', count(*) from appointments
#         union all select 'orders', count(*) from orders
#         union all select 'reward_vouchers', count(*) from reward_vouchers;"
#
# 4. Supprimer la base de vérification :
#
#      docker compose exec postgres dropdb -U <utilisateur> yani_verif
#
# 5. Les images, si elles sont à restaurer elles aussi. Prendre l'archive du
#    MÊME horodatage que le dump : une base d'hier avec les images d'aujourd'hui
#    laisse des fiches qui pointent vers des fichiers absents.
#
#    Vérifier d'abord ce que contient l'archive, sans rien écrire :
#
#      tar -tzf backups/yani_AAAA-MM-JJ_HHMMSS_images.tar.gz | head
#
#    Puis l'extraire dans le volume, à travers le conteneur (le préfixe
#    MSYS_NO_PATHCONV ne sert que sous Git Bash, voir plus haut) :
#
#      MSYS_NO_PATHCONV=1 docker compose exec -T backend \
#        tar -xzf - -C /app/uploads < backups/yani_AAAA-MM-JJ_HHMMSS_images.tar.gz
#
#    L'extraction AJOUTE et écrase, elle ne fait pas le ménage : un fichier
#    présent aujourd'hui mais absent de l'archive reste en place. Sans effet sur
#    le catalogue (plus personne ne le référence), mais bon à savoir avant de
#    conclure que la restauration a échoué.
