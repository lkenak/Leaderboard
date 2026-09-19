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
  setReportMode,
  unlinkLadderFromGuild,
  type ReportMode,
} from "@/lib/db/discord-guilds";
import { getLadderBySlug, type LadderRecord } from "@/lib/db/ladders";
import { consumeLinkCode } from "@/lib/db/link-codes";
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
 * Les deux accords sont exigés, mais **pas forcément de la même personne** :
 *
 *  - sur son propre serveur, être propriétaire du ladder et administrateur
 *    suffit — un seul geste ;
 *  - ailleurs, le propriétaire engendre un **code de liaison** depuis les
 *    réglages de son ladder, et l'administrateur le saisit ici. Chacun agit
 *    dans son domaine sans avoir besoin des droits de l'autre.
 *
 * Exiger les deux casquettes sur une seule tête ne marchait que chez soi :
 * dès qu'on sort de son propre serveur, cette personne n'existe pas, et
 * personne ne pouvait relier quoi que ce soit.
 *
 * `setDefaultMemberPermissions` **masque** la commande aux non-administrateurs,
 * et la vérification en tête d'`execute` la **refuse** : les permissions par
 * défaut sont réécrivables depuis Paramètres → Intégrations, elles ne
 * protègent rien toutes seules. Même raisonnement que `guardOwner` côté site.
 *
 * À noter pour qui cherche pourquoi la commande n'apparaît pas : le masquage
 * porte sur **Gérer le serveur**, et Discord considère qu'Administrateur
 * couvre tout. Ne pas la voir en étant administrateur veut dire que le client
 * n'a pas rafraîchi sa liste — les autres commandes, elles, n'étant pas
 * masquées, apparaissent quand même.
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
          .setDescription("Le ladder à relier — inutile si tu fournis un code.")
          .setAutocomplete(true),
      )
      .addChannelOption((o) =>
        o
          .setName("salon")
          .setDescription("Salon des comptes rendus de partie (facultatif).")
          .addChannelTypes(ChannelType.GuildText),
      )
      .addStringOption((o) =>
        o
          .setName("code")
          .setDescription(
            "Code fourni par le propriétaire, si le ladder n'est pas le tien.",
          ),
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
    c
      .setName("annonces")
      .setDescription("À quel rythme annoncer les parties dans le salon.")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Une carte par partie, ou une seule par soirée.")
          .setRequired(true)
          .addChoices(
            { name: "Chaque partie", value: "chaque-partie" },
            { name: "Résumé de soirée", value: "resume-soiree" },
          ),
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

  /* La vérification que `setDefaultMemberPermissions` ne fait pas.
   *
   * Ce garde-fou manquait, alors que l'en-tête de ce fichier affirmait le
   * contraire. `setDefaultMemberPermissions` ne fait que **masquer** la
   * commande, et un administrateur du serveur peut rétablir son accès à
   * n'importe quel rôle depuis Paramètres → Intégrations. Sans contrôle ici,
   * n'importe qui aurait alors pu délier un ladder ou détourner le salon des
   * comptes rendus.
   *
   * `has()` tient compte d'Administrateur, qui couvre tout par définition. */
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return repondre(
      "Il faut la permission **Gérer le serveur** pour configurer le bot ici.",
    );
  }

  if (sous === "etat") return etat(interaction, env.publicUrl);

  /* — Les sous-commandes qui écrivent — */

  const slugDemande = interaction.options.getString("slug");

  if (sous === "lier") {
    /* Deux chemins, un seul principe : le propriétaire du ladder doit avoir
       donné son accord.
         - c'est toi → la propriété suffit ;
         - ce n'est pas toi → il te faut un code qu'il a engendré.

       Sans ce second chemin, un ladder ne pouvait être relié qu'à un serveur
       dont son propriétaire était administrateur. Dès qu'on sort de son propre
       serveur, cette personne n'existe pas : l'administrateur n'est pas le
       propriétaire, et le propriétaire n'est pas administrateur. Personne ne
       pouvait relier quoi que ce soit, et le bot restait muet.

       Le compte sur le site n'est exigé que par le premier chemin, celui qui
       doit comparer une propriété. Le porteur d'un code n'a rien à prouver :
       le code **est** la preuve, et l'envoyer se connecter au site serait une
       barrière pour rien — précisément dans le cas où il n'a aucune raison
       d'avoir un compte, puisque le ladder n'est pas le sien. */
    const codeSaisi = interaction.options.getString("code");
    let ladder: LadderRecord | null;
    let ajoutePar: string | null = null;

    if (codeSaisi) {
      // Le code est consommé ici, donc avant toute autre validation qui
      // pourrait échouer. À dire clairement à qui le saisit : un code refusé
      // plus loin serait perdu pour rien.
      const res = consumeLinkCode(codeSaisi, interaction.guildId);
      if (!res.ok) {
        const raisons: Record<typeof res.raison, string> = {
          inconnu: "Ce code n'existe pas — vérifie la saisie.",
          expiré: "Ce code a expiré. Demande-lui d'en engendrer un nouveau.",
          "déjà-utilisé": "Ce code a déjà servi. Les codes ne valent qu'une fois.",
          "ladder-supprimé": "Le ladder de ce code n'existe plus.",
        };
        return repondre(raisons[res.raison]);
      }
      ladder = res.ladder;

      if (slugDemande && slugDemande !== ladder.slug) {
        return repondre(
          `Ce code concerne **${ladder.name}**, pas « ${slugDemande} ». ` +
            "Il vient d'être consommé : demandes-en un nouveau.",
        );
      }
    } else {
      if (!slugDemande) {
        return repondre(
          "Précise quel ladder relier — soit `slug`, si c'est le tien, soit " +
            "`code`, si son propriétaire t'en a donné un.",
        );
      }

      const lien = resoudre(interaction.user.id);
      if (lien.etat === "aucun-compte") {
        return repondre(messageEtat(lien, env.publicUrl, true));
      }

      ladder = getLadderBySlug(slugDemande);
      if (!ladder) return repondre(`Aucun ladder « ${slugDemande} ».`);

      if (ladder.ownerUserId !== lien.utilisateur.id) {
        return repondre(
          `**${ladder.name}** ne t'appartient pas. Demande à son propriétaire ` +
            "d'engendrer un code depuis les réglages du ladder, puis relance " +
            "`/ladder lier` avec l'option `code`.",
        );
      }
      ajoutePar = lien.utilisateur.id;
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
      // `null` quand la liaison vient d'un code : la personne qui l'a
      // saisie n'a pas forcément de compte sur le site, et la colonne
      // est prévue pour (0004).
      addedByUserId: ajoutePar,
    });

    return repondre(
      `**${ladder.name}** est relié à ce serveur.\n` +
        (cree.isDefault ? "C'est le ladder par défaut de `/classement`.\n" : "") +
        (salonId
          ? `Les comptes rendus iront dans <#${salonId}>, une carte par partie. ` +
            "`/ladder annonces` pour n'en recevoir qu'une par soirée.\n"
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
      `Les comptes rendus de **${cible.ladder.name}** iront dans <#${salon.id}> — ` +
        `${libelleMode(cible.reportMode)}. ` +
        "`/ladder annonces` pour changer de rythme.",
    );
  }

  if (sous === "annonces") {
    const liens = listLinksForGuild(interaction.guildId);
    if (liens.length === 0) return repondre("Aucun ladder n'est relié à ce serveur.");

    const cible = slugDemande
      ? liens.find((l) => l.ladder.slug === slugDemande)
      : (liens.find((l) => l.isDefault) ?? (liens.length === 1 ? liens[0] : undefined));
    if (!cible) {
      return repondre("Ce serveur suit plusieurs ladders : précise lequel avec l'option `slug`.");
    }

    const mode = interaction.options.getString("mode", true) as ReportMode;
    setReportMode(interaction.guildId, cible.ladder.id, mode);

    if (!cible.reportChannelId) {
      return repondre(
        `**${cible.ladder.name}** : ${libelleMode(mode)}. ` +
          "Reste à choisir où — `/ladder salon`, sans quoi rien ne sera envoyé.",
      );
    }
    return repondre(
      `**${cible.ladder.name}** : ${libelleMode(mode)} dans <#${cible.reportChannelId}>.` +
        (mode === "resume-soiree"
          ? "\nLe résumé part quand le ladder arrête de jouer, environ 25 minutes " +
            "après la dernière partie. Ce qui a été joué avant maintenant n'y figurera pas."
          : ""),
    );
  }
}

/** Le même libellé partout — dans la confirmation comme dans `/ladder etat`. */
function libelleMode(mode: ReportMode): string {
  return mode === "resume-soiree"
    ? "une carte par soirée"
    : "une carte par partie";
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
        ? `\n   Comptes rendus : <#${l.reportChannelId}> · ${libelleMode(l.reportMode)}` +
          (l.reportMode === "resume-soiree" && l.lastDigestAt
            ? `\n   Dernier résumé jusqu'au ${shortDate(l.lastDigestAt)}`
            : "")
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
