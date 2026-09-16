/**
 * Les variables d'environnement du bot, lues et validées une fois au
 * démarrage.
 *
 * Échouer tout de suite et en nommant la variable manquante, plutôt que de
 * planter trois minutes plus tard sur un `undefined` au milieu d'une
 * interaction : le bot tourne sous systemd avec `Restart=always`, un
 * démarrage qui échoue est visible dans `journalctl`, une interaction qui
 * échoue ne l'est pour personne.
 *
 * Le bot partage `/etc/leaderboard.env` avec le service web — il lit la même
 * base et appelle le même serveur.
 */

export interface BotEnv {
  /** Onglet « Bot » de l'application Discord. */
  token: string;
  /** Le Client ID de l'onglet OAuth2 — la même application que la connexion du site. */
  applicationId: string;
  /**
   * Serveur de test. Quand elle est définie, les commandes sont publiées sur
   * ce seul serveur : visibles immédiatement, au lieu du délai de propagation
   * des commandes globales.
   */
  devGuildId: string | null;
  /** Pour les liens cliquables des messages. */
  publicUrl: string;
  /**
   * Pour joindre le serveur web sans repasser par Caddy, le DNS ni le
   * certificat. `AUTH_URL` ne convient pour aucun des deux usages : c'est la
   * variable d'Auth.js, elle sert à calculer des URL de rappel OAuth.
   */
  internalUrl: string;
  /**
   * Le même secret que `/api/refresh`. Les deux points d'entrée sont
   * exclusivement 127.0.0.1 → 127.0.0.1 ; qui détient l'un tourne déjà sur la
   * machine qui contient la base. Deux secrets, ce serait deux rotations pour
   * aucune séparation utile.
   */
  refreshSecret: string | null;
}

function requis(nom: string): string {
  const valeur = process.env[nom]?.trim();
  if (!valeur) {
    throw new Error(
      `[bot] ${nom} est absente. En production elle vit dans /etc/leaderboard.env, ` +
        `en local dans .env.local (voir .env.example).`,
    );
  }
  return valeur;
}

function optionnel(nom: string): string | null {
  return process.env[nom]?.trim() || null;
}

/** Retire le `/` final : tout le code concatène des chemins absolus derrière. */
function base(url: string): string {
  return url.replace(/\/+$/, "");
}

let cache: BotEnv | null = null;

export function loadEnv(): BotEnv {
  if (cache) return cache;
  cache = {
    token: requis("DISCORD_BOT_TOKEN"),
    applicationId: requis("DISCORD_APPLICATION_ID"),
    devGuildId: optionnel("DISCORD_DEV_GUILD_ID"),
    publicUrl: base(requis("LADDER_PUBLIC_URL")),
    internalUrl: base(process.env.LADDER_INTERNAL_URL?.trim() || "http://127.0.0.1:3000"),
    refreshSecret: optionnel("REFRESH_SECRET"),
  };
  return cache;
}
