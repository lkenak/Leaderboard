import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { defaultLinkForGuild, listLinksForGuild } from "@/lib/db/discord-guilds";
import { LADDER_CARD } from "@/lib/cards/layout";
import { loadEnv } from "../env";
import { recupererCarte, relever } from "../web";

/**
 * `/classement` — le classement du serveur, en image.
 *
 * L'image est une **pièce jointe nue**, pas un embed : l'embed rajoute
 * exactement la chrome (barre de couleur, cadre, titre) qu'on cherche à
 * supprimer en dessinant nous-mêmes. Le lien vers le site passe par un bouton,
 * plus gros et plus sûr sur mobile qu'un titre cliquable — et une image, elle,
 * ne peut porter ni lien ni mention.
 *
 * Trois textes accompagnent toujours la carte, produits par
 * `lib/cards/models.ts` à partir du même modèle :
 *   - le résumé, dans le contenu du message (images désactivées, recherche
 *     dans l'historique Discord, qui n'indexe pas les PNG) ;
 *   - le texte alternatif, sur la pièce jointe (lecteurs d'écran) ;
 *   - l'embed de repli, si le rendu échoue.
 */

export const data = new SlashCommandBuilder()
  .setName("classement")
  .setDescription("Le classement SoloQ de ce serveur.")
  .setContexts(InteractionContextType.Guild)
  .addStringOption((o) =>
    o
      .setName("ladder")
      .setDescription("Quel ladder (si le serveur en suit plusieurs).")
      .setAutocomplete(true),
  )
  .addIntegerOption((o) =>
    o
      .setName("joueurs")
      .setDescription("Combien de lignes afficher (1 à 12, par défaut 10).")
      .setMinValue(1)
      .setMaxValue(LADDER_CARD.maxRows),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (!interaction.guildId) return void interaction.respond([]);
  const saisie = interaction.options.getFocused().toLowerCase();
  const choix = listLinksForGuild(interaction.guildId).map((l) => ({
    name: l.isDefault ? `${l.ladder.name} — par défaut` : l.ladder.name,
    value: l.ladder.slug,
  }));
  await interaction.respond(
    choix.filter((c) => c.name.toLowerCase().includes(saisie)).slice(0, 25),
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) return;
  const env = loadEnv();

  /* 1 — Quel ladder ? */

  const demande = interaction.options.getString("ladder");
  const liens = listLinksForGuild(interaction.guildId);

  if (liens.length === 0) {
    await interaction.reply({
      content:
        "Aucun ladder n'est relié à ce serveur. Un administrateur peut le faire " +
        "avec `/ladder lier`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lien = demande
    ? liens.find((l) => l.ladder.slug === demande)
    : defaultLinkForGuild(interaction.guildId);

  if (!lien) {
    await interaction.reply({
      content: demande
        ? `**${demande}** n'est pas relié à ce serveur. \`/ladder etat\` liste ceux qui le sont.`
        : "Ce serveur suit plusieurs ladders et aucun n'est le défaut : choisis-en un " +
          "avec l'option `ladder`, ou fixe le défaut avec `/ladder defaut`.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Le rendu prend le plus souvent moins d'une seconde, mais Discord invalide
  // le jeton d'interaction au bout de 3 s : on diffère systématiquement plutôt
  // que de parier sur une machine peu chargée.
  await interaction.deferReply();

  /* 2 — Relevé de CE ladder, systématiquement.

     Le site ne relève plus à chaque visite, et afficher un classement est
     précisément le moment où quelqu'un veut des chiffres à jour. Le serveur
     applique son propre âge minimum d'une minute, donc relever à chaque
     commande ne martèle rien — et seuls les comptes de ce ladder sont
     interrogés. */
  await relever({ kind: "ladder", slug: lien.ladder.slug });

  /* 3 — La carte. */

  const joueurs = interaction.options.getInteger("joueurs") ?? 10;
  const chemin =
    `/api/internal/cards/ladder?slug=${encodeURIComponent(lien.ladder.slug)}&n=${joueurs}`;
  const reponse = await recupererCarte(chemin);

  const bouton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Ouvrir le classement")
      .setStyle(ButtonStyle.Link)
      .setURL(`${env.publicUrl}/l/${lien.ladder.slug}`),
  );

  /* 4 — Repli : le site est injoignable ou le rendu a échoué. */

  if (!reponse) {
    await interaction.editReply({
      content:
        `Le classement de **${lien.ladder.name}** (image indisponible).`,
      embeds: [
        new EmbedBuilder()
          .setTitle(lien.ladder.name)
          .setURL(`${env.publicUrl}/l/${lien.ladder.slug}`)
          .setDescription("_Le rendu est momentanément indisponible. Le site, lui, répond._")
          .setColor(0xe9ff1f),
      ],
      components: [bouton],
    });
    return;
  }

  if (reponse.png === null) {
    // Le serveur a répondu, mais le rendu a échoué : il nous a quand même
    // donné l'embed construit sur le même modèle. C'est tout l'intérêt de
    // n'avoir qu'un modèle pour trois consommateurs.
    await interaction.editReply({
      content: reponse.summary,
      embeds: [new EmbedBuilder(reponse.fallback)],
      components: [bouton],
      allowedMentions: { parse: [] },
    });
    return;
  }

  /* 5 — Cas nominal. */

  // L'horodatage dans le nom de fichier : sans lui, le CDN de Discord peut
  // resservir l'image précédente quand un message est modifié.
  const cachet = new Date(reponse.updatedAt)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:T]/g, "");
  const fichier = new AttachmentBuilder(reponse.png, {
    name: `classement-${lien.ladder.slug}-${cachet}.png`,
    // Le texte alternatif reste, lui : invisible pour qui voit l'image, et
    // c'est la seule chose qu'un lecteur d'écran puisse annoncer.
    description: reponse.alt.slice(0, 1024),
  });

  await interaction.editReply({
    // Pas de résumé au-dessus de l'image : il répétait mot pour mot ce que la
    // carte affiche déjà, en moins lisible. Il n'apparaît que dans le mode
    // dégradé, où il est la seule information disponible.
    content: "",
    files: [fichier],
    components: [bouton],
    allowedMentions: { parse: [] },
  });
}
