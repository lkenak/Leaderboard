#!/usr/bin/env bash
#
# Prépare une VM Ubuntu 24.04 (Oracle Cloud, arm64) à héberger SOLOQ/LADDER.
#
# Depuis la VM :
#   curl -fsSL https://raw.githubusercontent.com/lkenak/Leaderboard/main/deploy/bootstrap.sh -o bootstrap.sh
#   less bootstrap.sh          # on lit avant d'exécuter en root
#   sudo bash bootstrap.sh
#
# Idempotent : on peut le relancer sans rien casser.
#
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/lkenak/Leaderboard.git}
SRV=/srv/leaderboard
DATA=/var/lib/leaderboard
SVC_USER=leaderboard

say()  { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "À lancer avec sudo."

# ── Vérifications préalables ────────────────────────────────────────────────
say "Vérifications"
ARCH=$(uname -m)
ok "architecture : $ARCH"
[ "$ARCH" = "aarch64" ] || echo "  (attendu aarch64 sur une instance Ampere A1 — on continue quand même)"

# Sans passerelle Internet, apt et npm échoueraient plus loin avec des messages
# obscurs. Autant nommer la cause tout de suite.
if ! curl -fsS --max-time 10 -o /dev/null https://deb.nodesource.com/ 2>/dev/null; then
  die "La VM n'a pas accès à Internet.
  Dans la console Oracle, page de l'instance → onglet Networking → action rapide
  « Connect public subnet to internet » → Connect. Puis relance ce script."
fi
ok "accès Internet"

# ── 1. Pare-feu local ──────────────────────────────────────────────────────
# Les images Oracle embarquent des règles iptables qui ne laissent passer que le
# port 22. Ouvrir les ports dans la console ne suffit donc pas : c'est la
# première cause de « mon site ne répond pas » sur Oracle.
say "Pare-feu local (iptables)"
if ! command -v netfilter-persistent >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null
fi

open_port() {
  local port=$1
  if iptables -S INPUT | grep -q -- "--dport $port -j ACCEPT"; then
    ok "port $port déjà ouvert"
    return
  fi
  # On insère AVANT la règle de rejet plutôt que d'ajouter à la fin, sinon la
  # nouvelle règle est inatteignable. Et surtout jamais de `iptables -F`, qui
  # couperait la session SSH en cours.
  local reject
  reject=$(iptables -L INPUT --line-numbers -n | awk '/REJECT|DROP/{print $1; exit}')
  if [ -n "$reject" ]; then
    iptables -I INPUT "$reject" -m state --state NEW -p tcp --dport "$port" -j ACCEPT
  else
    iptables -A INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT
  fi
  ok "port $port ouvert"
}
open_port 80
open_port 443
netfilter-persistent save >/dev/null
ok "règles enregistrées (elles survivront au redémarrage)"

# ── 2. Paquets ─────────────────────────────────────────────────────────────
say "Mise à jour du système"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "système à jour"

say "Node.js 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource.sh
  bash /tmp/nodesource.sh >/dev/null
  apt-get install -y -qq nodejs
fi
ok "$(node -v) / npm $(npm -v)"

say "git, rsync, Caddy, mises à jour automatiques"
apt-get install -y -qq git rsync debian-keyring debian-archive-keyring apt-transport-https
if ! command -v caddy >/dev/null; then
  # Le dépôt officiel : celui d'Ubuntu est souvent très en retard.
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
ok "caddy $(caddy version | head -1)"
apt-get install -y -qq unattended-upgrades
ok "correctifs de sécurité automatiques"

# ── 3. Utilisateur de service et arborescence ──────────────────────────────
say "Utilisateur de service et dossiers"
if ! id "$SVC_USER" >/dev/null 2>&1; then
  adduser --system --group --home "$SRV" --shell /usr/sbin/nologin "$SVC_USER" >/dev/null
fi
mkdir -p "$SRV/repo" "$SRV/current" "$DATA"
# L'historique de LP vit hors du dossier de déploiement : c'est la seule donnée
# que rien ne peut reconstruire, elle doit survivre à chaque mise à jour.
chown -R "$SVC_USER:$SVC_USER" "$SRV" "$DATA"
ok "$SRV et $DATA"

# ── 4. Dépôt ───────────────────────────────────────────────────────────────
say "Dépôt"
if [ -d "$SRV/repo/.git" ]; then
  sudo -u "$SVC_USER" git -C "$SRV/repo" pull --ff-only
  ok "dépôt mis à jour"
else
  sudo -u "$SVC_USER" git clone --depth 20 "$REPO_URL" "$SRV/repo"
  ok "dépôt cloné"
fi

# ── 5. systemd et environnement ────────────────────────────────────────────
say "Services systemd"
install -m 644 "$SRV/repo/deploy/leaderboard.service" /etc/systemd/system/
install -m 644 "$SRV/repo/deploy/leaderboard-refresh.service" /etc/systemd/system/
install -m 644 "$SRV/repo/deploy/leaderboard-refresh.timer" /etc/systemd/system/
systemctl daemon-reload
ok "unités installées"

if [ ! -f /etc/leaderboard.env ]; then
  install -m 600 -o root -g root \
    "$SRV/repo/deploy/leaderboard.env.example" /etc/leaderboard.env
  # Les deux secrets sont générés ici : personne n'a à inventer un mot de passe,
  # et ils n'auront jamais transité par un historique de commandes.
  ADMIN_PW=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64url'))")
  REFRESH=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=$ADMIN_PW|" /etc/leaderboard.env
  sed -i "s|^REFRESH_SECRET=.*|REFRESH_SECRET=$REFRESH|" /etc/leaderboard.env
  ok "/etc/leaderboard.env créé, secrets générés"
  GENERATED=1
else
  ok "/etc/leaderboard.env existe déjà, laissé intact"
  GENERATED=0
fi

# ── 6. Sudo non interactif pour le redémarrage ─────────────────────────────
# deploy.sh se termine par `sudo systemctl restart leaderboard` : sans cette
# règle, cette ligne bloque en attente d'un mot de passe dès que deploy.sh est
# lancé par un script (CI, cron) plutôt qu'à la main devant un terminal.
say "Sudo non interactif (redémarrage du service)"
install -m 440 -o root -g root "$SRV/repo/deploy/leaderboard-sudoers" /etc/sudoers.d/leaderboard
visudo -cf /etc/sudoers.d/leaderboard >/dev/null
ok "règle installée et validée"

printf '\n\033[1;32m═══ Préparation terminée ═══\033[0m\n\n'
if [ "${GENERATED:-0}" = "1" ]; then
  printf 'Ton mot de passe /admin a été généré :\n\n    \033[1;33m%s\033[0m\n\n' "$ADMIN_PW"
  printf 'Note-le maintenant. Pour le relire plus tard :\n'
  printf '    sudo grep ADMIN_PASSWORD /etc/leaderboard.env\n\n'
fi
cat <<'NEXT'
Il reste trois choses, dans cet ordre :

  1. La clé Riot — sans elle le site tourne en mode démonstration, ce qui
     suffit d'ailleurs pour valider le déploiement :
       sudo nano /etc/leaderboard.env     # remplir RIOT_API_KEY

  2. Le premier déploiement :
       sudo -u leaderboard /srv/leaderboard/repo/deploy/deploy.sh
       sudo systemctl enable --now leaderboard
       curl -s localhost:3000/ranking -o /dev/null -w '%{http_code}\n'   # attendu : 200

  3. Le domaine et HTTPS — l'enregistrement A doit déjà pointer sur cette IP :
       sudo cp /srv/leaderboard/repo/deploy/Caddyfile /etc/caddy/Caddyfile
       sudo nano /etc/caddy/Caddyfile      # remplacer ladder.exemple.fr
       sudo systemctl reload caddy

Et n'oublie pas d'ouvrir 80 et 443 côté console Oracle (Security List du subnet
et, s'il en existe un, le Network Security Group) : le pare-feu local est fait,
mais celui d'Oracle est une couche séparée.
NEXT
