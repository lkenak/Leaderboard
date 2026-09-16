import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { SlashCommandBuilder } from "discord.js";
import * as classement from "./classement";
import * as ladder from "./ladder";
import * as ping from "./ping";
import * as profil from "./profil";

/**
 * Le registre des commandes.
 *
 * Un seul endroit où une commande s'ajoute : `bot/index.ts` la route et
 * `bot/register-commands.ts` la publie à partir de cette liste. Oublier l'un
 * des deux est l'erreur classique d'un bot Discord — ici elle est
 * structurellement impossible.
 */

export interface Commande {
  /** Présente seulement sur les commandes qui ont une option autocomplétée. */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export const COMMANDES: Commande[] = [classement, ladder, ping, profil];

export const PAR_NOM = new Map(COMMANDES.map((c) => [c.data.name, c]));
