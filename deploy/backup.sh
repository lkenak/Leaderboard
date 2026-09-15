#!/usr/bin/env bash
# Sauvegarde de l'historique de LP. À mettre dans un cron quotidien.
#
# Pourquoi c'est la seule sauvegarde qui compte vraiment : l'API Riot ne
# renvoie aucun LP par partie, donc cette série temporelle ne peut PAS être
# reconstruite. Tout le reste (rangs, parties, icônes) se retélécharge.
set -euo pipefail

SRC=${LADDER_DATA_DIR:-/var/lib/leaderboard}
DEST=${BACKUP_DIR:-/var/backups/leaderboard}
KEEP=30

mkdir -p "$DEST"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
tar -czf "$DEST/store-$STAMP.tar.gz" -C "$SRC" .

# Rétention : on garde les KEEP dernières archives.
ls -1t "$DEST"/store-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "sauvegardé : $DEST/store-$STAMP.tar.gz ($(du -h "$DEST/store-$STAMP.tar.gz" | cut -f1))"
