import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { defaultLinkForGuild } from "@/lib/db/discord-guilds";
import { loadEnv } from "../env";
import { labelCompte, messageEtat, resoudre } from "../liens";
import { recupererCarte, relever } from "../web";

/**
 * `/profil [membre]` — la fiche d'un joueur.
 *
 * Une seule commande plutôt que `/moi` et `/profil` : la différence entre les
 * deux tient à un argument facultatif, et deux entrées dans la liste pour la
 * même chose, c'est une de trop.
 *
 * Le lien Discord ↔ compte de jeu ne demande aucun parcours : le site se
 * connecte en OAuth Discord, donc `users.discord_id` suffit. Tout le travail
 * est dans les états dégradés, que `bot/liens.ts` distingue — « je ne trouve
 * pas » serait une réponse inutile quand la vraie réponse est « connecte-toi
 * une fois sur le site » ou « le prochain relevé s'en charge ».
 */

export const data = new SlashCommandBuilder()
  .setName("profil")
  .setDescription("La fiche SoloQ d'un membre (la tienne par défaut).")
  .setContexts(InteractionContextType.Guild)
  .addUserOption((o) =>
    o.setName("membre").setDescription("De qui ? Par défaut : toi."),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const env = loadEnv();
  const cible = interaction.options.getUser("membre") ?? interaction.user;
  const soi = cible.id === interaction.user.id;

  const lien = resoudre(cible.id);

  if (lien.etat !== "prêt") {
    // Éphémère quand c'est sa propre fiche — c'est une consigne, pas une
    // information pour le salon. Visible quand on interroge quelqu'un
    // d'autre : la personne concernée doit pouvoir la lire.
    await interaction.reply({
      content: soi
        ? messageEtat(lien, env.publicUrl, true)
        : `À propos de ${cible} : ${messageEtat(lien, env.publicUrl, false)}`,
      flags: soi ? MessageFlags.Ephemeral : undefined,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.deferReply();

  // Relevé des comptes de la personne affichée, avant de dessiner : consulter
  // une fiche est le moment où on veut des chiffres à jour, et le site ne
  // relève plus à chaque visite. Le serveur applique son âge minimum, donc
  // enchaîner les commandes ne martèle pas l'API Riot.
  await relever({ kind: "utilisateur", userId: lien.utilisateur.id });

  // Le ladder par défaut du serveur donne la position ; sans lui la fiche
  // reste complète, simplement sans classement.
  const lienLadder = interaction.guildId ? defaultLinkForGuild(interaction.guildId) : null;

  const params = new URLSearchParams({
    puuid: lien.puuid,
    gameName: lien.compte.gameName,
    tagLine: lien.compte.tagLine,
    region: lien.compte.region,
  });
  if (lienLadder) params.set("ladder", lienLadder.ladder.slug);

  const reponse = await recupererCarte(`/api/internal/cards/player?${params}`);

  if (!reponse || reponse.png === null) {
    await interaction.editReply({
      content:
        `**${labelCompte(lien.compte)}** — la fiche n'a pas pu être dessinée. ` +
        (lienLadder
          ? `Le classement complet reste sur ${env.publicUrl}/l/${lienLadder.ladder.slug}`
          : `Tout est sur ${env.publicUrl}`),
      allowedMentions: { parse: [] },
    });
    return;
  }

  const cachet = new Date(reponse.updatedAt).toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const fichier = new AttachmentBuilder(reponse.png, {
    name: `profil-${lien.compte.gameName}-${cachet}.png`,
    description: reponse.alt.slice(0, 1024),
  });

  const composants: ActionRowBuilder<ButtonBuilder>[] = [];
  if (reponse.url) {
    composants.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Voir le classement")
          .setStyle(ButtonStyle.Link)
          .setURL(reponse.url),
      ),
    );
  }

  await interaction.editReply({
    files: [fichier],
    components: composants,
    allowedMentions: { parse: [] },
  });
}
