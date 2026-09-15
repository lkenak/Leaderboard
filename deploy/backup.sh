#!/usr/bin/env bash
# Sauvegarde de la base (utilisateurs, ladders, et surtout l'historique de
# LP). À mettre dans un cron quotidien.
#
# Pourquoi c'est la seule sauvegarde qui compte vraiment : l'API Riot ne
# renvoie aucun LP par partie, donc cette série temporelle ne peut PAS être
# reconstruite. Tout le reste (rangs, parties, icônes) se retélécharge.
#
# `sqlite3 .backup`, pas `cp`/`tar` du fichier directement : la base tourne en
# mode WAL (lecteurs et écrivain simultanés), et une copie à chaud d'un
# fichier ouvert n'est jamais garantie cohérente — `.backup` prend un lock de
# lecture propre et inclut le contenu du WAL non encore rejoué.
set -euo pipefail

SRC=${LADDER_DATA_DIR:-/var/lib/leaderboard}
DEST=${BACKUP_DIR:-/var/backups/leaderboard}
KEEP=30

mkdir -p "$DEST"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
sqlite3 "$SRC/ladder.sqlite" ".backup '$DEST/ladder-$STAMP.sqlite'"
gzip "$DEST/ladder-$STAMP.sqlite"

# Rétention : on garde les KEEP dernières archives.
ls -1t "$DEST"/ladder-*.sqlite.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "sauvegardé : $DEST/ladder-$STAMP.sqlite.gz ($(du -h "$DEST/ladder-$STAMP.sqlite.gz" | cut -f1))"
