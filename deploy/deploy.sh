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
# .next/static **ni** public **ni** db/ — c'est le piège classique : le site
# démarre, et arrive sans aucun style ni aucune image (ou, pour db/, sans ses
# migrations SQL au premier démarrage). Les quatre rsync sont obligatoires.
mkdir -p "$CURRENT/.next"
rsync -a --delete .next/standalone/ "$CURRENT/"
rsync -a --delete .next/static/ "$CURRENT/.next/static/"
rsync -a --delete public/ "$CURRENT/public/"
rsync -a --delete db/ "$CURRENT/db/"

sudo systemctl restart leaderboard

# Attente active plutôt qu'un `sleep` fixe suivi d'un seul essai : un `sleep 3`
# s'est révélé trop court par intermittence (observé sur le déploiement
# automatique GitHub Actions, jamais en lançant ce script à la main) — sans
# qu'on sache si la lenteur vient du redémarrage du service ou du chemin
# réseau vers le runner. Ça absorbe les deux causes sans en supposer une.
for i in $(seq 1 20); do
  if curl --fail --silent --show-error -o /dev/null http://127.0.0.1:3000/login; then
    echo "déployé — /login répond (après ${i}s)"
    exit 0
  fi
  sleep 1
done
echo "le site ne répond toujours pas après 20 s : sudo journalctl -u leaderboard -n 50"
exit 1
