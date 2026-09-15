#!/usr/bin/env bash
#
# deploy/serve.sh — héberge le classement à la demande, le temps d'une session.
#
#   ./deploy/serve.sh              build si nécessaire, sert, ouvre un tunnel public
#   ./deploy/serve.sh --local      pareil, mais sans tunnel (127.0.0.1 seulement)
#   ./deploy/serve.sh --build      force le rebuild même si rien n'a changé
#
# Ctrl+C arrête tout : serveur, tunnel, relevés périodiques.
#
# Ce script est le pendant « à la demande » des units systemd du même dossier :
# systemd sert à garder un service en vie 24/7, ici on veut l'inverse — un
# serveur qui vit le temps d'une soirée et qui ne laisse rien derrière lui.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
HOST=127.0.0.1
STANDALONE="$ROOT/.next/standalone"
STAMP="$STANDALONE/.serve-stamp"
RUNDIR="$(mktemp -d -t leaderboard-serve-XXXXXX)"
WITH_TUNNEL=1
FORCE_BUILD=0
PIDS=()

while [ $# -gt 0 ]; do
	case "$1" in
	--local) WITH_TUNNEL=0 ;;
	--build) FORCE_BUILD=1 ;;
	-h | --help)
		sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Option inconnue : $1" >&2
		exit 2
		;;
	esac
	shift
done

if [ -t 1 ]; then
	B=$'\033[1m' DIM=$'\033[2m' GRN=$'\033[32m' YLW=$'\033[33m' RED=$'\033[31m' R=$'\033[0m'
else
	B='' DIM='' GRN='' YLW='' RED='' R=''
fi
step() { printf '%s==>%s %s\n' "$B" "$R" "$*"; }
warn() { printf '%s /!\\ %s%s\n' "$YLW" "$*" "$R"; }
die() {
	printf '%serreur : %s%s\n' "$RED" "$*" "$R" >&2
	exit 1
}

cleanup() {
	trap - EXIT INT TERM
	printf '\n%s==>%s arrêt…\n' "$B" "$R"
	for pid in "${PIDS[@]:-}"; do
		[ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true
	done
	# Laisse au serveur le temps de vider ses requêtes en cours : la doc Next
	# demande un arrêt sur SIGTERM, pas un SIGKILL immédiat.
	for pid in "${PIDS[@]:-}"; do
		[ -n "${pid:-}" ] && { timeout 10 tail --pid="$pid" -f /dev/null 2>/dev/null || true; }
	done
	rm -rf "$RUNDIR"
	printf '%s==>%s arrêté. L'\''historique de LP est conservé dans .data/\n' "$B" "$R"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------- secrets ----
# Les clés vivent dans .env.local, hors du dépôt. La sortie standalone tourne
# depuis .next/standalone : Next n'y trouverait aucun fichier .env, on injecte
# donc les variables dans l'environnement du processus — exactement ce que fait
# `EnvironmentFile=` dans leaderboard.service.
[ -f "$ROOT/.env.local" ] || die ".env.local manquant. Copier .env.example et y mettre la clé Riot."

perms="$(stat -c '%a' "$ROOT/.env.local")"
if [ "$perms" != "600" ]; then
	warn ".env.local est en $perms (lisible par d'autres) — passage en 600"
	chmod 600 "$ROOT/.env.local"
fi

set -a
# shellcheck disable=SC1091
. <(tr -d '\r' <"$ROOT/.env.local") # tr : WSL, fichiers parfois en CRLF
set +a

[ -n "${RIOT_API_KEY:-}" ] || die "RIOT_API_KEY absente de .env.local"

# `lib/store.ts` : DATA_DIR = LADDER_DATA_DIR ?? cwd()/.data. En standalone le
# cwd est .next/standalone — sans cette ligne, l'historique de LP serait écrit
# dans le dossier de build et effacé au rebuild suivant.
export LADDER_DATA_DIR="${LADDER_DATA_DIR:-$ROOT/.data}"
mkdir -p "$LADDER_DATA_DIR"

export NODE_ENV=production
export TZ="${TZ:-Europe/Paris}"
export PORT HOSTNAME="$HOST"
# Le serveur et le tunnel sont locaux : jamais via le proxy d'entreprise.
NO_PROXY="127.0.0.1,localhost,${no_proxy:-}"
no_proxy="$NO_PROXY"
export NO_PROXY no_proxy

# ------------------------------------------------------------------ build ----
SOURCES=(app components lib data public scripts instrumentation.ts next.config.ts package.json postcss.config.mjs tsconfig.json)

needs_build=1
if [ "$FORCE_BUILD" -eq 0 ] && [ -f "$STAMP" ] && [ -f "$STANDALONE/server.js" ]; then
	if [ -z "$(find "${SOURCES[@]}" -type f -newer "$STAMP" -print -quit 2>/dev/null)" ]; then
		needs_build=0
	fi
fi

if [ "$needs_build" -eq 1 ]; then
	step "build (les sources ont changé)…"
	npm run build
	# Documenté dans node_modules/next/dist/docs — output.md : le server.js
	# minimal de la sortie standalone ne copie NI public/ NI .next/static.
	# Sans ces deux copies : site sans CSS, sans police, sans icônes.
	cp -r "$ROOT/.next/static" "$STANDALONE/.next/"
	[ -d "$ROOT/public" ] && cp -r "$ROOT/public" "$STANDALONE/"
	touch "$STAMP"
else
	step "build à jour ${DIM}(--build pour forcer)${R}"
fi

# ----------------------------------------------------------------- serveur ---
# Un serveur d'une session précédente qui tient encore le port ferait passer
# le health check ci-dessous — on servirait alors un build périmé, avec les
# anciens secrets, sans le moindre message. Vérifié plutôt que supposé.
holder="$(ss -ltnp 2>/dev/null | awk -v p=":$PORT\$" '$4 ~ p {print $4, $NF; exit}')"
if [ -n "$holder" ]; then
	die "le port $PORT est déjà occupé par : $holder
  Un serveur d'une session précédente tourne probablement encore.
  L'arrêter, ou relancer avec  PORT=3001 ./deploy/serve.sh"
fi

step "démarrage du serveur sur http://$HOST:$PORT"
(cd "$STANDALONE" && exec node server.js) >"$RUNDIR/server.log" 2>&1 &
PIDS+=("$!")
server_pid="${PIDS[-1]}"

for i in $(seq 1 60); do
	if ! kill -0 "$server_pid" 2>/dev/null; then
		sed 's/^/    /' "$RUNDIR/server.log" >&2
		die "le serveur s'est arrêté au démarrage"
	fi
	code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://$HOST:$PORT/" 2>/dev/null || true)"
	case "$code" in 200 | 3??) break ;; esac
	[ "$i" -eq 60 ] && {
		sed 's/^/    /' "$RUNDIR/server.log" >&2
		die "pas de réponse après 60 s"
	}
	sleep 1
done
printf '    %s✓%s serveur prêt\n' "$GRN" "$R"

# ------------------------------------------------------------------ tunnel ---
public_url=""
if [ "$WITH_TUNNEL" -eq 1 ] && [ -n "${HTTPS_PROXY:-}${HTTP_PROXY:-}" ]; then
	# Mesuré derrière un proxy à inspection TLS : le CONNECT vers le port 7844
	# de l'edge Cloudflare est refusé en 403, et cloudflared ignore HTTPS_PROXY
	# pour son appel d'enregistrement. Le tunnel ne peut pas aboutir — ce n'est
	# pas un réglage à trouver, c'est la politique réseau, et elle a raison de
	# refuser. Depuis un réseau domestique, aucun de ces deux blocages.
	warn "proxy d'entreprise détecté (${HTTPS_PROXY:-$HTTP_PROXY})"
	warn "le tunnel public va échouer : bascule directe en local"
	WITH_TUNNEL=0
fi

if [ "$WITH_TUNNEL" -eq 1 ]; then
	if ! command -v cloudflared >/dev/null 2>&1; then
		warn "cloudflared absent — lancer ./deploy/install-cloudflared.sh, ou --local"
		WITH_TUNNEL=0
	fi
fi

if [ "$WITH_TUNNEL" -eq 1 ]; then
	# Un « quick tunnel » : aucun compte Cloudflare, aucun port à ouvrir, aucune
	# IP fixe. cloudflared ouvre une connexion SORTANTE vers l'edge Cloudflare,
	# ce qui contourne entièrement le NAT de WSL. L'URL change à chaque session.
	#
	# QUIC (UDP 7844) est le transport par défaut et se fait jeter par la
	# plupart des réseaux d'entreprise ; on retombe alors sur http2 (TCP 443).
	for proto in quic http2; do
		step "ouverture du tunnel public ${DIM}($proto)${R}"
		cloudflared tunnel --no-autoupdate --protocol "$proto" \
			--url "http://$HOST:$PORT" >"$RUNDIR/tunnel-$proto.log" 2>&1 &
		PIDS+=("$!")
		tunnel_pid="${PIDS[-1]}"

		for i in $(seq 1 30); do
			kill -0 "$tunnel_pid" 2>/dev/null || break
			public_url="$(grep -ohE 'https://[a-z0-9-]+\.trycloudflare\.com' \
				"$RUNDIR/tunnel-$proto.log" 2>/dev/null | head -1 || true)"
			[ -n "$public_url" ] && break
			sleep 1
		done

		[ -n "$public_url" ] && break
		kill "$tunnel_pid" 2>/dev/null || true
		unset 'PIDS[-1]'
		warn "$proto n'a pas abouti"
	done

	if [ -z "$public_url" ]; then
		warn "tunnel impossible — ce réseau bloque cloudflared."
		warn "Le site reste accessible en local sur http://$HOST:$PORT"
		printf '%s    journaux : %s%s\n' "$DIM" "$RUNDIR" "$R"
	fi
fi

# --------------------------------------------------------------- relevés -----
# Le site relève déjà à la visite quand le dernier dépasse REFRESH_INTERVAL_MS
# (cf. lib/riot/README.md). Cette boucle est l'équivalent du .timer systemd :
# elle garde le classement chaud même pendant les creux, pour que le premier
# visiteur n'attende pas une synchro complète.
if [ -n "${REFRESH_SECRET:-}" ]; then
	interval=$(((${REFRESH_INTERVAL_MS:-300000} + 999) / 1000))
	[ "$interval" -lt 60 ] && interval=60
	(
		while sleep "$interval"; do
			curl --fail --silent --show-error --max-time 300 -X POST \
				-H "Authorization: Bearer $REFRESH_SECRET" \
				"http://$HOST:$PORT/api/refresh" >/dev/null 2>&1 || true
		done
	) &
	PIDS+=("$!")
	step "relevé automatique toutes les ${interval} s"
else
	warn "REFRESH_SECRET absent : pas de relevé périodique (la visite en déclenche un)"
fi

# ------------------------------------------------------------------ prêt -----
echo
if [ -n "$public_url" ]; then
	printf '   %s%s%s\n' "$B$GRN" "$public_url" "$R"
	printf '   %sà partager — valable le temps de cette session%s\n' "$DIM" "$R"
else
	printf '   %shttp://%s:%s%s\n' "$B$GRN" "$HOST" "$PORT" "$R"
	printf '   %saccessible depuis ce poste uniquement%s\n' "$DIM" "$R"
fi
echo
printf '   %sadmin : /admin      logs : tail -f %s/server.log%s\n' "$DIM" "$RUNDIR" "$R"
printf '   %sCtrl+C pour arrêter%s\n' "$DIM" "$R"
echo

wait "$server_pid" 2>/dev/null || true
