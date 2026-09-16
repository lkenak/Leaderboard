import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { createSession, setSessionMessage } from "@/lib/db/pp";
import { construireMessage } from "../pp/message";
import { analyserHeure } from "../pp/temps";
import { getSession } from "@/lib/db/pp";

/**
 * `/pp creer` — la feuille d'inscription d'une partie personnalisée.
 *
 * Portage de `/creerpp` de « Organisation PP », avec les mêmes options :
 * l'ergonomie était bonne, il n'y avait pas de raison de la changer.
 */

export const data = new SlashCommandBuilder()
  .setName("pp")
  .setDescription("Organiser une partie personnalisée.")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((c) =>
    c
      .setName("creer")
      .setDescription("Créer une partie personnalisée.")
      .addStringOption((o) =>
        o.setName("heure").setDescription("Par exemple 21h30, 21h ou 21:30.").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("format")
          .setDescription("Bo1, Bo3 ou Bo5.")
          .setRequired(true)
          .addChoices(
            { name: "Bo1", value: "BO1" },
            { name: "Bo3", value: "BO3" },
            { name: "Bo5", value: "BO5" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Le mode de jeu.")
          .setRequired(true)
          .addChoices(
            { name: "Normal", value: "NORMAL" },
            { name: "Fearless Draft", value: "FEARLESS" },
            { name: "ARAM Mayhem", value: "ARAM_MAYHEM" },
          ),
      )
      .addStringOption((o) =>
        o.setName("date").setDescription("aujourd'hui, demain, ou JJ/MM. Par défaut : aujourd'hui."),
      )
      .addIntegerOption((o) =>
        o
          .setName("joueurs")
          .setDescription("Nombre de places. Par défaut 10.")
          .setMinValue(2)
          .setMaxValue(20),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.channelId) return;

  const heure = interaction.options.getString("heure", true);
  const date = interaction.options.getString("date") ?? "aujourd'hui";

  const instant = analyserHeure(heure, date);
  if (!instant) {
    await interaction.reply({
      content:
        "Je n'ai pas compris l'heure ou la date. L'heure s'écrit `21h30`, `21h` ou " +
        "`21:30` ; la date `aujourd'hui`, `demain` ou `18/09`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Le rendu de la carte prend quelques centaines de millisecondes, et Discord
  // invalide le jeton d'interaction au bout de 3 s.
  await interaction.deferReply();

  const session = createSession({
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    organizerDiscordId: interaction.user.id,
    heureLabel: instant.heureLabel,
    dateLabel: instant.dateLabel,
    startsAt: instant.startsAt,
    format: interaction.options.getString("format", true) as "BO1" | "BO3" | "BO5",
    mode: interaction.options.getString("mode", true) as "NORMAL" | "FEARLESS" | "ARAM_MAYHEM",
    maxPlayers: interaction.options.getInteger("joueurs") ?? 10,
  });

  const payload = await construireMessage(interaction.client, getSession(session.id)!);
  const message = await interaction.editReply(payload);

  // Le pointeur vers le message est écrit tout de suite : sans lui, aucun clic
  // ne saurait quoi redessiner, et l'auto-réparation n'aurait rien à réparer.
  setSessionMessage(session.id, message.channelId, message.id);
}
