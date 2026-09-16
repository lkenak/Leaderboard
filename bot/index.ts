import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { PAR_NOM } from "./commands";
import { ouvrirBase } from "./db";
import { loadEnv } from "./env";
import { gererBouton, gererMenu } from "./pp/interactions";
import { demarrerRappels } from "./pp/rappels";

/**
 * Le bot Discord de SOLOQ/LADDER.
 *
 * Processus séparé du serveur Next, sur la même machine et le même fichier
 * SQLite (voir `bot/db.ts`). Il lit la base directement et ne passe par le
 * serveur web que pour deux choses : déclencher un relevé Riot et récupérer
 * une carte rendue (`bot/web.ts`).
 *
 * Pas de verrou PID, contrairement à l'ancien bot « Organisation PP » :
 * systemd en `Type=simple` garantit déjà une seule instance, et
 * `ProtectSystem=strict` rend le répertoire de travail en lecture seule — un
 * `openSync(lock, "wx")` y lèverait `EROFS` et le service boucherait en
 * redémarrage.
 *
 * Intents : `Guilds` uniquement. Ni `MessageContent` ni `GuildMembers` — le
 * bot n'en a aucun usage, et s'en passer le tient hors du processus de
 * vérification de Discord.
 */

// Pas d'`await` de premier niveau dans ce fichier : le `package.json` du
// projet n'a pas `"type": "module"`, donc tsx transpile `bot/` en CommonJS,
// qui ne le permet pas. Tout passe par `demarrer()`.

const env = loadEnv();
const etat = ouvrirBase();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (c) => {
  // Balayage des rappels de PP : démarré ici et pas plus tôt, il n'a rien à
  // envoyer tant que la passerelle n'est pas prête.
  demarrerRappels(c);

  console.log(
    `[bot] connecté en tant que ${c.user.tag} · ${c.guilds.cache.size} serveur(s) · ` +
      `schéma ${etat.appliquees.at(-1)} · site ${env.internalUrl}`,
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  // L'autocomplétion a sa propre boucle : Discord attend une réponse en 3 s,
  // et une erreur ici ne doit surtout pas partir dans le chemin d'erreur des
  // commandes (on ne peut pas « répondre » à une autocomplétion).
  if (interaction.isAutocomplete()) {
    const commande = PAR_NOM.get(interaction.commandName);
    try {
      await commande?.autocomplete?.(interaction);
    } catch (err) {
      console.error(`[bot] autocomplétion de /${interaction.commandName} :`, err);
      // Une liste vide vaut mieux qu'un champ qui tourne indéfiniment.
      try {
        await interaction.respond([]);
      } catch {
        /* déjà répondu ou expiré */
      }
    }
    return;
  }

  // Lobbys de PP : un seul préfixe, un seul aiguillage — le motif
  // `pp:<action>:<id>[:<champ>]` de l'ancien bot, qui évite d'avoir à tenir
  // un registre de composants.
  if (interaction.isButton() && interaction.customId.startsWith("pp:")) {
    try {
      await gererBouton(interaction);
    } catch (err) {
      console.error("[pp] bouton :", err);
    }
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("pp:")) {
    try {
      await gererMenu(interaction);
    } catch (err) {
      console.error("[pp] menu :", err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const commande = PAR_NOM.get(interaction.commandName);
  if (!commande) {
    console.warn(`[bot] commande inconnue : ${interaction.commandName}`);
    return;
  }

  try {
    await commande.execute(interaction);
  } catch (err) {
    // Une commande qui échoue ne doit jamais laisser l'utilisateur devant un
    // « L'application ne répond pas » : Discord invalide le jeton
    // d'interaction au bout de 3 s, et le message d'échec natif n'apprend
    // rien à personne.
    console.error(`[bot] échec de /${interaction.commandName} :`, err);
    const contenu =
      "Quelque chose a échoué de mon côté. Si ça se reproduit, `/ping` dit " +
      "lequel des trois maillons est cassé.";
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: contenu, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: contenu, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Jeton d'interaction expiré : plus rien à faire, le journal suffit.
    }
  }
});

// discord.js se reconnecte seul ; ces deux écouteurs servent à ce que le
// journal dise pourquoi le bot est muet, plutôt que de rester silencieux.
client.on(Events.Error, (err) => console.error("[bot] erreur de passerelle :", err));
client.on(Events.ShardDisconnect, (_event, id) =>
  console.warn(`[bot] fragment ${id} déconnecté, reconnexion en cours`),
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[bot] ${signal} reçu, fermeture.`);
    void client.destroy().finally(() => process.exit(0));
  });
}

async function demarrer(): Promise<void> {
  await client.login(env.token);
}

demarrer().catch((err) => {
  // Un token invalide ou une passerelle injoignable au démarrage : sortir en
  // échec pour que systemd réessaie, plutôt que de rester en vie sans être
  // connecté à quoi que ce soit.
  console.error("[bot] connexion impossible :", err);
  process.exit(1);
});
