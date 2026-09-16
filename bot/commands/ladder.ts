import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";
import {
  findLink,
  linkLadderToGuild,
  listLinksForGuild,
  setDefaultLink,
  setReportChannel,
  unlinkLadderFromGuild,
} from "@/lib/db/discord-guilds";
import { getLadderBySlug } from "@/lib/db/ladders";
import { laddersForUser } from "@/lib/db/users";
import { shortDate } from "@/lib/format";
import { loadEnv } from "../env";
import { messageEtat, resoudre } from "../liens";

/**
 * Administration de la liaison entre un serveur Discord et un ladder.
 *
 * **Deux autorités doivent consentir**, parce que l'acte touche deux domaines :
 *
 *  - sans l'accord du propriétaire du ladder, n'importe quel serveur pourrait
 *    s'attacher un classement qui n'est pas le sien et en faire sortir des
 *    messages ;
 *  - sans l'accord d'un administrateur du serveur, n'importe quel membre
 *    pourrait faire poster le bot dans un salon.
 *
 * En v1 on exige donc les deux **sur la même personne** : propriétaire du
 * ladder ET `ManageGuild` sur le serveur. C'est le cas réel dans la quasi-
 * totalité des situations (c'est ton serveur, c'est ton ladder). Le cas où
 * les deux rôles sont tenus par deux personnes passera par les codes de
 * liaison (`ladder_link_codes`, table déjà créée en 0004), au lot suivant —
 * d'ici là le message de refus doit le dire, sinon il est incompréhensible.
 *
 * `setDefaultMemberPermissions` **masque** la commande aux non-administrateurs,
 * la vérification en code la **refuse** : les permissions par défaut sont
 * réécrivables par les administrateurs du serveur, elles ne protègent rien
 * toutes seules. Même raisonnement que `guardOwner` côté site.
 */

export const data = new SlashCommandBuilder()
  .setName("ladder")
  .setDescription("Relier ce serveur à un classement SoloQ.")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((c) =>
    c
      .setName("lier")
      .setDescription("Relier un de tes ladders à ce serveur.")
      .addStringOption((o) =>
        o
          .setName("slug")
          .setDescription("Le ladder à relier.")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addChannelOption((o) =>
        o
          .setName("salon")
          .setDescription("Salon des comptes rendus de partie (facultatif).")
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("delier")
      .setDescription("Retirer un ladder de ce serveur.")
      .addStringOption((o) =>
        o.setName("slug").setDescription("Le ladder à retirer.").setAutocomplete(true),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("defaut")
      .setDescription("Choisir le ladder affiché par /classement sans argument.")
      .addStringOption((o) =>
        o
          .setName("slug")
          .setDescription("Le ladder par défaut.")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("salon")
      .setDescription("Choisir (ou couper) le salon des comptes rendus de partie.")
      .addChannelOption((o) =>
        o
          .setName("salon")
          .setDescription("Laisser vide pour couper les envois.")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addStringOption((o) =>
        o.setName("slug").setDescription("Le ladder concerné.").setAutocomplete(true),
      ),
  )
  .addSubcommand((c) =>
    c.setName("etat").setDescription("Ce que le bot sait de ce serveur."),
  );

/* ── Permissions du bot dans un salon ─────────────────────────────────────── */

/**
 * Les droits nécessaires pour poster une carte.
 *
 * Vérifiés **avant** d'enregistrer le salon, pas au premier envoi : un refus
 * de Discord trois heures plus tard, dans un journal que personne ne lit, est
 * la panne la plus pénible à diagnostiquer. L'ancien bot « Organisation PP »
 * rejouait indéfiniment des `50013` pour cette raison.
 */
const DROITS_REQUIS = [
  { drapeau: PermissionFlagsBits.ViewChannel, nom: "Voir le salon" },
  { drapeau: PermissionFlagsBits.SendMessages, nom: "Envoyer des messages" },
  { drapeau: PermissionFlagsBits.AttachFiles, nom: "Joindre des fichiers" },
  { drapeau: PermissionFlagsBits.EmbedLinks, nom: "Intégrer des liens" },
];

function droitsManquants(
  salon: GuildTextBasedChannel,
  botId: string,
): string[] {
  const perms = salon.permissionsFor(botId);
  if (!perms) return ["(permissions illisibles)"];
  return DROITS_REQUIS.filter((d) => !perms.has(d.drapeau)).map((d) => d.nom);
}

/* ── Autocomplétion ───────────────────────────────────────────────────────── */

/**
 * `lier` propose les ladders que la personne possède ; les autres
 * sous-commandes proposent ceux déjà liés à ce serveur — dans les deux cas,
 * exactement l'ensemble sur lequel l'action a un sens.
 */
export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const saisie = interaction.options.getFocused().toLowerCase();
  const sous = interaction.options.getSubcommand();

  let choix: Array<{ name: string; value: string }> = [];

  if (sous === "lier") {
    const lien = resoudre(interaction.user.id);
    if (lien.etat !== "aucun-compte") {
      choix = laddersForUser(lien.utilisateur.id).owned.map((l) => ({
        name: `${l.name} (${l.memberCount} joueur${l.memberCount > 1 ? "s" : ""})`,
        value: l.slug,
      }));
    }
  } else if (interaction.guildId) {
    choix = listLinksForGuild(interaction.guildId).map((l) => ({
      name: l.isDefault ? `${l.ladder.name} — par défaut` : l.ladder.name,
      value: l.ladder.slug,
    }));
  }

  await interaction.respond(
    choix.filter((c) => c.name.toLowerCase().includes(saisie)).slice(0, 25),
  );
}

/* ── Exécution ────────────────────────────────────────────────────────────── */

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;
  const env = loadEnv();
  const sous = interaction.options.getSubcommand();

  // Renvoie `void` et non la réponse : toutes les branches ci-dessous font
  // `return repondre(...)`, et la signature de `execute` est `Promise<void>`.
  const repondre = async (content: string): Promise<void> => {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  };

  if (sous === "etat") return etat(interaction, env.publicUrl);

  /* — Les sous-commandes qui écrivent — */

  const slugDemande = interaction.options.getString("slug");

  if (sous === "lier") {
    // Seule la présence d'un compte sur le site compte ici : lier un ladder
    // ne demande pas d'avoir déclaré un compte Riot, seulement d'être le
    // propriétaire du ladder.
    const lien = resoudre(interaction.user.id);
    if (lien.etat === "aucun-compte") {
      return repondre(messageEtat(lien, env.publicUrl, true));
    }

    const ladder = getLadderBySlug(slugDemande!);
    if (!ladder) return repondre(`Aucun ladder « ${slugDemande} ».`);

    if (ladder.ownerUserId !== lien.utilisateur.id) {
      return repondre(
        `**${ladder.name}** ne t'appartient pas. En attendant les codes de liaison, ` +
          "seul le propriétaire d'un ladder peut le relier à un serveur — et il doit " +
          "aussi être administrateur de ce serveur.",
      );
    }

    const salon = interaction.options.getChannel("salon");
    let salonId: string | null = null;
    if (salon) {
      const vrai = await interaction.guild.channels.fetch(salon.id);
      if (!vrai || !vrai.isTextBased()) return repondre("Ce salon n'accepte pas de messages.");
      const manquants = droitsManquants(vrai as GuildTextBasedChannel, interaction.client.user.id);
      if (manquants.length > 0) {
        return repondre(
          `Je n'ai pas les droits nécessaires dans <#${salon.id}> : ` +
            `**${manquants.join("**, **")}**. Corrige ça et relance la commande.`,
        );
      }
      salonId = salon.id;
    }

    const cree = linkLadderToGuild({
      ladderId: ladder.id,
      guildId: interaction.guildId,
      reportChannelId: salonId,
      addedByUserId: lien.utilisateur.id,
    });

    return repondre(
      `**${ladder.name}** est relié à ce serveur.\n` +
        (cree.isDefault ? "C'est le ladder par défaut de `/classement`.\n" : "") +
        (salonId
          ? `Les comptes rendus de partie iront dans <#${salonId}> (à partir du lot suivant).\n`
          : "Aucun salon de comptes rendus pour l'instant — `/ladder salon` quand tu voudras.\n") +
        `Essaie \`/classement\`.`,
    );
  }

  if (sous === "delier") {
    const liens = listLinksForGuild(interaction.guildId);
    if (liens.length === 0) return repondre("Aucun ladder n'est relié à ce serveur.");

    const cible = slugDemande
      ? liens.find((l) => l.ladder.slug === slugDemande)
      : liens.length === 1
        ? liens[0]
        : undefined;
    if (!cible) {
      return repondre(
        "Ce serveur suit plusieurs ladders : précise lequel retirer avec l'option `slug`.",
      );
    }

    unlinkLadderFromGuild(interaction.guildId, cible.ladder.id);
    return repondre(
      `**${cible.ladder.name}** n'est plus relié à ce serveur. ` +
        "Le ladder lui-même et ses données sont intacts.",
    );
  }

  if (sous === "defaut") {
    const ladder = getLadderBySlug(slugDemande!);
    if (!ladder) return repondre(`Aucun ladder « ${slugDemande} ».`);
    if (!findLink(interaction.guildId, ladder.id)) {
      return repondre(
        `**${ladder.name}** n'est pas relié à ce serveur — \`/ladder lier\` d'abord.`,
      );
    }
    setDefaultLink(interaction.guildId, ladder.id);
    return repondre(
      `**${ladder.name}** est maintenant le ladder par défaut de \`/classement\`.`,
    );
  }

  if (sous === "salon") {
    const liens = listLinksForGuild(interaction.guildId);
    if (liens.length === 0) return repondre("Aucun ladder n'est relié à ce serveur.");

    const cible = slugDemande
      ? liens.find((l) => l.ladder.slug === slugDemande)
      : (liens.find((l) => l.isDefault) ?? (liens.length === 1 ? liens[0] : undefined));
    if (!cible) {
      return repondre("Ce serveur suit plusieurs ladders : précise lequel avec l'option `slug`.");
    }

    const salon = interaction.options.getChannel("salon");
    if (!salon) {
      setReportChannel(interaction.guildId, cible.ladder.id, null);
      return repondre(`Comptes rendus coupés pour **${cible.ladder.name}**.`);
    }

    const vrai = await interaction.guild.channels.fetch(salon.id);
    if (!vrai || !vrai.isTextBased()) return repondre("Ce salon n'accepte pas de messages.");
    const manquants = droitsManquants(vrai as GuildTextBasedChannel, interaction.client.user.id);
    if (manquants.length > 0) {
      return repondre(
        `Je n'ai pas les droits nécessaires dans <#${salon.id}> : ` +
          `**${manquants.join("**, **")}**.`,
      );
    }

    setReportChannel(interaction.guildId, cible.ladder.id, salon.id);
    return repondre(
      `Les comptes rendus de **${cible.ladder.name}** iront dans <#${salon.id}> ` +
        "(dès que le lot « compte rendu d'après-game » sera en place).",
    );
  }
}

/* ── /ladder etat ─────────────────────────────────────────────────────────── */

/**
 * Volontairement bavard : c'est le seul outil de diagnostic disponible sans
 * accès SSH, et le projet n'a aucun test. Il doit répondre à « pourquoi
 * `/classement` ne marche pas » sans qu'on ait à ouvrir un journal.
 */
async function etat(interaction: ChatInputCommandInteraction, publicUrl: string): Promise<void> {
  const liens = listLinksForGuild(interaction.guildId!);

  if (liens.length === 0) {
    await interaction.reply({
      content:
        "Aucun ladder n'est relié à ce serveur.\n" +
        "`/ladder lier` — il faut être propriétaire du ladder et administrateur ici.\n" +
        `Pas encore de ladder ? ${publicUrl}/ladders/new`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lignes = liens.map((l) => {
    const morceaux = [`**${l.ladder.name}** (\`${l.ladder.slug}\`)`];
    if (l.isDefault) morceaux.push("· par défaut");
    morceaux.push(`\n   ${publicUrl}/l/${l.ladder.slug}`);
    morceaux.push(
      l.reportChannelId
        ? `\n   Comptes rendus : <#${l.reportChannelId}>`
        : `\n   Comptes rendus : coupés${l.reportError ? ` — ${l.reportError}` : ""}`,
    );
    morceaux.push(`\n   Relié le ${shortDate(l.createdAt)}`);
    return morceaux.join(" ");
  });

  await interaction.reply({
    content: `Ce serveur suit ${liens.length} ladder(s) :\n\n${lignes.join("\n\n")}`,
    flags: MessageFlags.Ephemeral,
  });
}
