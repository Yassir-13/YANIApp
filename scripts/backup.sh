#!/bin/sh
# Sauvegarde de la base PostgreSQL de Yani Concept.
#
# C'est le seul point du projet dont la perte est DÉFINITIVE. Un bug se corrige,
# des données effacées ne reviennent pas : clientes, rendez-vous, commandes,
# points de fidélité, bons non encore honorés.
#
# ── Utilisation ──
#   ./scripts/backup.sh              → écrit dans ./backups
#   BACKUP_DIR=/mnt/sauvegardes ./scripts/backup.sh
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

# ── Sauvegarde ───────────────────────────────────────────────────────────
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

# ── Rotation ─────────────────────────────────────────────────────────────
echo "Suppression des sauvegardes de plus de $RETENTION_DAYS jours…"
find "$BACKUP_DIR" -name 'yani_*.dump' -type f -mtime "+$RETENTION_DAYS" -print -delete

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
