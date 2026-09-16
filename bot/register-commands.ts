import { REST, Routes } from "discord.js";
import { COMMANDES } from "./commands";
import { loadEnv } from "./env";

/**
 * Publication des commandes auprès de Discord.
 *
 *   npm run bot:commands            → portée globale (production)
 *   npm run bot:commands -- --serveur → portée serveur (immédiat, pour itérer)
 *
 * **Manuellement, jamais au démarrage.** La publication globale est limitée à
 * 200 par jour ; un service en `Restart=always` qui republierait à chaque
 * démarrage brûlerait le quota en une matinée de déploiements.
 *
 * ## Une seule portée à la fois, garantie par le script
 *
 * Discord range les commandes dans deux jeux distincts : le jeu global, et un
 * jeu par serveur. Contrairement à ce qu'on pourrait croire, **une commande
 * de serveur ne masque pas la commande globale de même nom** : les deux
 * apparaissent, et l'utilisateur voit chaque commande en double. L'erreur a
 * été commise ici, et elle n'est pas rattrapable côté utilisateur — seul un
 * appel d'API efface un jeu.
 *
 * Ce script écrit donc dans une portée **et vide l'autre**, à chaque fois.
 * Quel que soit l'état d'avant, l'état d'après est « exactement un jeu ».
 * C'est pour pouvoir vider le jeu de serveur que `DISCORD_DEV_GUILD_ID` doit
 * rester définie même quand on publie en global : elle désigne le serveur
 * d'itération, elle ne choisit pas la portée. C'est `--serveur` qui choisit.
 *
 * ## Laquelle choisir
 *
 *  - **Globale** par défaut : un ladder peut être suivi par plusieurs
 *    serveurs, et les serveurs arrivent par invitation OAuth — il n'y a pas
 *    de liste à tenir, et le bot fonctionne partout où on l'invite.
 *    Contrepartie : Discord met parfois jusqu'à une heure à propager, et rien
 *    ne distingue cette attente d'une panne de déploiement.
 *  - **`--serveur`** pendant le développement : disponible immédiatement, au
 *    prix de ne plus répondre ailleurs.
 */

async function publier(): Promise<void> {
  const env = loadEnv();
  const corps = COMMANDES.map((c) => c.data.toJSON());
  const rest = new REST().setToken(env.token);
  const noms = corps.map((c) => `/${c.name}`).join(", ");

  const surServeur = process.argv.includes("--serveur");
  const globale = Routes.applicationCommands(env.applicationId);
  const serveur = env.devGuildId
    ? Routes.applicationGuildCommands(env.applicationId, env.devGuildId)
    : null;

  if (surServeur && !serveur) {
    throw new Error(
      "--serveur demandé mais DISCORD_DEV_GUILD_ID n'est pas définie : " +
        "le script ne sait pas sur quel serveur publier.",
    );
  }

  if (surServeur) {
    await rest.put(serveur!, { body: corps });
    await rest.put(globale, { body: [] });
    console.log(
      `[bot] ${corps.length} commande(s) sur le serveur ${env.devGuildId}, ` +
        `disponibles tout de suite : ${noms}`,
    );
    console.log(
      "[bot] jeu global vidé — le bot ne répond plus ailleurs. " +
        "`npm run bot:commands` (sans --serveur) pour repasser en global.",
    );
    return;
  }

  await rest.put(globale, { body: corps });
  // Vider le jeu du serveur d'itération s'il en reste un : sans ça, les deux
  // jeux coexistent et chaque commande apparaît deux fois.
  if (serveur) await rest.put(serveur, { body: [] });

  console.log(`[bot] ${corps.length} commande(s) publiée(s) globalement : ${noms}`);
  if (serveur) console.log(`[bot] jeu du serveur ${env.devGuildId} vidé (pas de doublon).`);
  console.log(
    "[bot] Discord peut mettre jusqu'à une heure à propager une nouveauté. " +
      "`npm run bot:commands -- --serveur` pour la voir immédiatement.",
  );
}

// Pas d'`await` de premier niveau : tsx transpile `bot/` en CommonJS.
publier().catch((err) => {
  console.error("[bot] publication des commandes impossible :", err);
  process.exit(1);
});
