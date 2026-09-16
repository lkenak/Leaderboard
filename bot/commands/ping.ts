import {
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getSyncMeta } from "@/lib/db/riot-players";
import { MIGRATION_MINIMALE } from "../db";
import { siteJoignable } from "../web";

/**
 * Commande de diagnostic — la seule du lot 0.
 *
 * Elle existe pour prouver la chaîne entière d'un seul coup : le bot est
 * connecté à Discord, il lit bien la base du site (donc le fichier SQLite est
 * accessible depuis son unité systemd, `-shm` compris), et il joint le
 * serveur web sur la boucle locale. Trois pannes de déploiement distinctes,
 * un seul aller-retour pour les distinguer.
 *
 * Réponse éphémère : c'est un outil, pas une information à laisser dans un
 * salon.
 */
export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Diagnostic : base, site, relevé.")
  .setContexts(InteractionContextType.Guild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const debut = Date.now();
  const { lastSync, lastSyncError } = getSyncMeta();
  const site = await siteJoignable();

  const releve =
    lastSync === null
      ? "aucun relevé enregistré"
      : `dernier relevé il y a ${Math.round((Date.now() - lastSync) / 60_000)} min`;

  const lignes = [
    `Latence Discord : ${Math.round(interaction.client.ws.ping)} ms`,
    `Base : lue (schéma ≥ ${MIGRATION_MINIMALE})`,
    `Site : ${site ? "joignable" : "INJOIGNABLE sur la boucle locale"}`,
    `Relevé : ${releve}${lastSyncError ? ` — ${lastSyncError}` : ""}`,
    `Diagnostic établi en ${Date.now() - debut} ms`,
  ];

  await interaction.reply({ content: lignes.join("\n"), flags: MessageFlags.Ephemeral });
}
