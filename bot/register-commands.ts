import { REST, Routes } from "discord.js";
import { COMMANDES } from "./commands";
import { loadEnv } from "./env";

/**
 * Publication des commandes auprès de Discord — `npm run bot:commands`.
 *
 * **Manuellement, jamais au démarrage.** La publication globale est limitée à
 * 200 par jour ; un service en `Restart=always` qui republierait à chaque
 * démarrage brûlerait le quota en une matinée de déploiements.
 *
 * Portée :
 *  - `DISCORD_DEV_GUILD_ID` définie → publication sur ce seul serveur, visible
 *    immédiatement. C'est le mode d'itération.
 *  - sinon → publication globale. C'est le bon choix en production : un
 *    ladder peut être lié à plusieurs serveurs, et les serveurs arrivent par
 *    invitation OAuth — il n'y a pas de liste de serveurs à tenir.
 */

async function publier(): Promise<void> {
  const env = loadEnv();
  const corps = COMMANDES.map((c) => c.data.toJSON());
  const rest = new REST().setToken(env.token);

  const route = env.devGuildId
    ? Routes.applicationGuildCommands(env.applicationId, env.devGuildId)
    : Routes.applicationCommands(env.applicationId);

  const portee = env.devGuildId ? `le serveur ${env.devGuildId}` : "toutes les installations";

  await rest.put(route, { body: corps });

  console.log(
    `[bot] ${corps.length} commande(s) publiée(s) sur ${portee} : ` +
      corps.map((c) => `/${c.name}`).join(", "),
  );
  if (!env.devGuildId) {
    console.log("[bot] publication globale : la propagation peut prendre quelques minutes.");
  }
}

// Pas d'`await` de premier niveau : tsx transpile `bot/` en CommonJS.
publier().catch((err) => {
  console.error("[bot] publication des commandes impossible :", err);
  process.exit(1);
});
