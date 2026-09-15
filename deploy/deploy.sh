#!/usr/bin/env bash
# Met à jour le site depuis le dépôt. À lancer sur le serveur.
#
#   sudo -u leaderboard /srv/leaderboard/repo/deploy/deploy.sh
#
set -euo pipefail

REPO=/srv/leaderboard/repo
CURRENT=/srv/leaderboard/current

cd "$REPO"
git pull --ff-only
npm ci
npm run build

# `output: "standalone"` produit un serveur autonome, mais il n'embarque **ni**
# .next/static **ni** public — c'est le piège classique : le site démarre,
# et arrive sans aucun style ni aucune image. Les trois rsync sont obligatoires.
mkdir -p "$CURRENT/.next"
rsync -a --delete .next/standalone/ "$CURRENT/"
rsync -a --delete .next/static/ "$CURRENT/.next/static/"
rsync -a --delete public/ "$CURRENT/public/"

sudo systemctl restart leaderboard
sleep 3
curl --fail --silent --show-error -o /dev/null http://127.0.0.1:3000/ranking \
  && echo "déployé — /ranking répond" \
  || { echo "le site ne répond pas : sudo journalctl -u leaderboard -n 50"; exit 1; }
