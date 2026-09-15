#!/usr/bin/env bash
#
# deploy/install-cloudflared.sh — installe cloudflared dans ~/.local/bin
#
# cloudflared ouvre un tunnel SORTANT vers l'edge Cloudflare : pas de port à
# ouvrir sur la box, pas d'IP fixe, pas de redirection NAT. C'est ce qui rend
# l'hébergement possible depuis WSL, dont l'IP est privée et change à chaque
# redémarrage.
#
# Le binaire officiel suffit : ni paquet système, ni root, ni service.
#
set -euo pipefail

DEST="${DEST:-$HOME/.local/bin}"
BIN="$DEST/cloudflared"

case "$(uname -m)" in
x86_64) arch=amd64 ;;
aarch64 | arm64) arch=arm64 ;;
*) echo "architecture non gérée : $(uname -m)" >&2 && exit 1 ;;
esac

URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$arch"

mkdir -p "$DEST"
echo "==> téléchargement ($arch)…"
# curl respecte HTTP_PROXY / HTTPS_PROXY, contrairement au fetch de Node.
curl --fail --location --progress-bar --max-time 300 -o "$BIN.part" "$URL"
chmod +x "$BIN.part"
mv "$BIN.part" "$BIN"

echo "==> $("$BIN" --version)"
echo "==> installé : $BIN"

case ":$PATH:" in
*":$DEST:"*) ;;
*)
	echo
	echo "/!\\ $DEST n'est pas dans le PATH. Ajouter à ~/.zshrc :"
	echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
	;;
esac
