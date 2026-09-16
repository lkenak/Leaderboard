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
 * **Deux portées, et non l'une ou l'autre.**
 *
 * La publication globale est la bonne en production — un ladder peut être lié
 * à plusieurs serveurs, et les serveurs arrivent par invitation OAuth, il n'y
 * a donc pas de liste à tenir. Mais Discord met **jusqu'à une heure** à la
 * propager : après un déploiement, les nouvelles commandes n'apparaissent
 * nulle part, et rien ne distingue cette attente d'une panne.
 *
 * Quand `DISCORD_DEV_GUILD_ID` est définie, on publie donc **aussi** sur ce
 * serveur, où la propagation est immédiate. Une commande de serveur prend le
 * pas sur la commande globale de même nom : pas de doublon dans la liste, et
 * les deux copies restent identiques puisqu'elles sont écrites dans le même
 * appel.
 *
 * Publier les deux plutôt que l'une ou l'autre, c'est ce qui évite le piège
 * inverse : un jeu de commandes de serveur à jour masquant indéfiniment un
 * global périmé.
 */

async function publier(): Promise<void> {
  const env = loadEnv();
  const corps = COMMANDES.map((c) => c.data.toJSON());
  const rest = new REST().setToken(env.token);
  const noms = corps.map((c) => `/${c.name}`).join(", ");

  await rest.put(Routes.applicationCommands(env.applicationId), { body: corps });
  console.log(`[bot] ${corps.length} commande(s) publiée(s) globalement : ${noms}`);

  if (!env.devGuildId) {
    console.log(
      "[bot] la propagation globale peut prendre jusqu'à une heure. Définir " +
        "DISCORD_DEV_GUILD_ID pour publier aussi sur un serveur, où c'est immédiat.",
    );
    return;
  }

  await rest.put(Routes.applicationGuildCommands(env.applicationId, env.devGuildId), {
    body: corps,
  });
  console.log(
    `[bot] et sur le serveur ${env.devGuildId}, où elles sont disponibles tout de suite.`,
  );
}

// Pas d'`await` de premier niveau : tsx transpile `bot/` en CommonJS.
publier().catch((err) => {
  console.error("[bot] publication des commandes impossible :", err);
  process.exit(1);
});
