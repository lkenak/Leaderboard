# Mise en ligne sur Oracle Cloud Always Free

Checklist pour une soirée. Les fichiers de ce dossier sont à copier tels quels,
il n'y a rien à rédiger.

---

## 1. Créer l'instance — les choix qu'on ne peut pas refaire

| Choix | Quoi prendre | Pourquoi ça compte |
| --- | --- | --- |
| **Région d'origine** | la plus proche **ayant de la capacité A1** | **Définitive.** Elle ne peut plus être changée après la création du compte |
| Forme | `VM.Standard.A1.Flex`, **2 OCPU / 12 Go** | C'est le plafond Always Free depuis le 15 juin 2026. Au-delà, l'instance est arrêtée puis supprimée |
| Image | **Ubuntu 24.04 LTS (aarch64)** | ARM vérifié : `@next/swc`, `@tailwindcss/oxide`, `lightningcss` et `sharp` ont tous un binaire `linux-arm64` |
| Clé SSH | la tienne, à l'écran de création | Ajouter une clé après coup demande la console série |

**La capacité A1 est le vrai obstacle.** La forme est souvent en
« Out of capacity » dans les régions populaires. Réessaie à des heures creuses,
et si ça ne passe pas, accepte une région voisine plutôt que de te rabattre sur
les micro-instances AMD : celles-ci n'ont qu'1 Go de RAM, et `next build` ne
tient pas dans 1 Go.

## 2. Les deux pare-feu — c'est **le** piège d'Oracle

Oracle en a deux, et ouvrir seulement le premier donne un site qui ne répond
pas, sans aucun message.

**a. Le pare-feu réseau (console Oracle).** Networking → ta VCN → Security Lists
→ Default Security List → *Add Ingress Rules* :

| Source | Protocole | Port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

**b. Le pare-feu local.** Les images Oracle embarquent des règles `iptables` qui
bloquent tout sauf le port 22. Sur la machine :

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

On **insère** les règles plutôt que de vider la chaîne : un `iptables -F` te
coupe ta propre session SSH. Et évite d'installer `ufw` par-dessus, il entre en
conflit avec les règles préinstallées.

## 3. Préparer la machine

```bash
# Utilisateur de service, sans shell de connexion
sudo adduser --system --group --home /srv/leaderboard leaderboard
sudo mkdir -p /srv/leaderboard/{repo,current} /var/lib/leaderboard
sudo chown -R leaderboard:leaderboard /srv/leaderboard /var/lib/leaderboard

# Node 22 (arm64) + Caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git rsync caddy
sudo apt-get install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

## 4. Déployer l'application

```bash
sudo -u leaderboard git clone https://github.com/lkenak/Leaderboard.git /srv/leaderboard/repo

# Secrets : hors du dépôt, illisibles par le service
sudo cp /srv/leaderboard/repo/deploy/leaderboard.env.example /etc/leaderboard.env
sudo chmod 600 /etc/leaderboard.env && sudo chown root:root /etc/leaderboard.env
sudo nano /etc/leaderboard.env     # clé Riot, ADMIN_PASSWORD, REFRESH_SECRET

sudo cp /srv/leaderboard/repo/deploy/leaderboard*.service /etc/systemd/system/
sudo cp /srv/leaderboard/repo/deploy/leaderboard-refresh.timer /etc/systemd/system/
sudo systemctl daemon-reload

sudo -u leaderboard /srv/leaderboard/repo/deploy/deploy.sh
sudo systemctl enable --now leaderboard
sudo systemctl enable --now leaderboard-refresh.timer   # facultatif
```

Générer les deux secrets :

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## 5. Domaine et HTTPS

Dans le panneau DNS IONOS, un enregistrement **A** vers l'IP publique de
l'instance. Puis :

```bash
sudo cp /srv/leaderboard/repo/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile        # remplacer ladder.exemple.fr
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy obtient et renouvelle le certificat seul. Rien à automatiser ensuite.

## 6. Sauvegardes — la seule à ne pas remettre à plus tard

L'API Riot ne renvoie **aucun LP par partie** : l'historique de
`/var/lib/leaderboard` est la seule donnée du système qui ne peut pas être
reconstruite. Tout le reste se retélécharge.

```bash
sudo crontab -e
# 30 3 * * *  LADDER_DATA_DIR=/var/lib/leaderboard /srv/leaderboard/repo/deploy/backup.sh
```

Et **teste une restauration** une fois, tout de suite : une sauvegarde jamais
restaurée n'est pas une sauvegarde.

## 7. Ce qu'il reste à faire, ensuite

| | Fréquence |
| --- | --- |
| Renouvellement HTTPS | jamais, Caddy s'en charge |
| Relevés du classement | jamais, déclenchés à la visite et par le minuteur |
| Clé Riot | jamais, **si** c'est une clé personnelle |
| Correctifs de sécurité | automatiques |
| Redémarrage après mise à jour du noyau | ~10 min/mois |
| `npm run champions:sync` | 2–3 fois par an, et sans gravité si oublié |
| Vérifier une restauration de sauvegarde | une fois par trimestre |

## Dépannage

| Symptôme | Cause la plus probable |
| --- | --- |
| Le site ne répond pas de l'extérieur | Un seul des deux pare-feu ouvert (§2) |
| Page sans style ni image | `.next/static` ou `public` non copiés — `deploy.sh` fait les trois `rsync` |
| Heures décalées de 2 h | `TZ=Europe/Paris` absent de `/etc/leaderboard.env` |
| Le build se fait tuer | Pas le cas avec 12 Go ; sinon ajouter du swap |
| Classement vide, comptes « en erreur » | Clé Riot invalide — `npm run riot:check` dans le dépôt |
| L'historique repart de zéro après un déploiement | `LADDER_DATA_DIR` non défini, donc écrit dans le dossier de déploiement |

```bash
sudo journalctl -u leaderboard -f          # journal de l'application
systemctl list-timers leaderboard-refresh  # prochain relevé
curl -s localhost:3000/ranking -o /dev/null -w '%{http_code}\n'
```
