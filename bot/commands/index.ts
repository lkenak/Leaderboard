import type {
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { SlashCommandBuilder } from "discord.js";
import * as ping from "./ping";

/**
 * Le registre des commandes.
 *
 * Un seul endroit où une commande s'ajoute : `bot/index.ts` la route et
 * `bot/register-commands.ts` la publie à partir de cette liste. Oublier l'un
 * des deux est l'erreur classique d'un bot Discord — ici elle est
 * structurellement impossible.
 */

export interface Commande {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export const COMMANDES: Commande[] = [ping];

export const PAR_NOM = new Map(COMMANDES.map((c) => [c.data.name, c]));
