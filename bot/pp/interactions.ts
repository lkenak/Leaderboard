import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import {
  cancelSession,
  getParticipant,
  getSession,
  join,
  leave,
  listParticipants,
  promoteWaitlist,
  setUnavailable,
  upsertProfile,
  type PpProfile,
} from "@/lib/db/pp";
import { DIVISIONS, ROLES, TIERS, type Division, type Role, type Tier } from "@/lib/types";
import { roleLabel, tierLabel } from "@/lib/lol";
import { apresEcriture } from "./message";
import { resoudreJoueur } from "./joueurs";
import { tirerEquipes } from "./equipes";

/**
 * Les clics sur un lobby de PP.
 *
 * Routage repris de l'ancien bot : `pp:<action>:<sessionId>[:<champ>]`, un
 * seul point d'entrée, pas de registre de composants à tenir.
 *
 * **Le parcours d'inscription, lui, est retourné.** L'ancien bot demandait à
 * tout le monde son rang, sa division et ses deux rôles dans quatre menus
 * déroulants, parce qu'il n'avait aucune autre source. Ici, quelqu'un dont le
 * compte Riot est lié est inscrit en un clic, avec son vrai rang et son poste
 * observé : lui demander de déclarer ce qu'on mesure déjà serait absurde.
 *
 * Le sorcier subsiste, mais seulement pour ceux qui n'ont pas lié de compte —
 * sans lui, ils compteraient pour zéro dans l'équilibrage, ce qui est pire
 * qu'une déclaration approximative.
 */

/* ── Brouillons du sorcier ────────────────────────────────────────────────── */

type Champ = "tier" | "division" | "mainRole" | "secondaryRole";
type Brouillon = Partial<Record<Champ, string>>;

/**
 * En mémoire, et assumé : un brouillon perdu au redémarrage se reconstruit
 * depuis `pp_profiles` au clic suivant. Le persister demanderait une table
 * pour un état qui vit trente secondes.
 */
const brouillons = new Map<string, Brouillon>();

const cleBrouillon = (sessionId: number, userId: string) => `${sessionId}:${userId}`;

const LIBELLES: Record<Champ, string> = {
  tier: "Palier",
  division: "Division",
  mainRole: "Poste principal",
  secondaryRole: "Poste secondaire",
};

function options(champ: Champ): Array<{ label: string; value: string }> {
  switch (champ) {
    case "tier":
      return TIERS.map((t) => ({ label: tierLabel(t), value: t }));
    case "division":
      // « NA » pour les paliers sans division (Master et au-dessus).
      return [
        ...DIVISIONS.map((d) => ({ label: d, value: d })),
        { label: "Sans division (Master+)", value: "NA" },
      ];
    default:
      return ROLES.map((r) => ({ label: roleLabel(r), value: r }));
  }
}

function sorcier(sessionId: number, userId: string) {
  const brouillon = brouillons.get(cleBrouillon(sessionId, userId)) ?? {};
  const champs = Object.keys(LIBELLES) as Champ[];

  const menus = champs.map((champ) =>
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`pp:profile-field:${sessionId}:${champ}`)
        .setPlaceholder(
          brouillon[champ] ? `${LIBELLES[champ]} : ${brouillon[champ]}` : LIBELLES[champ],
        )
        .addOptions(
          options(champ).map((o) => ({ ...o, default: brouillon[champ] === o.value })),
        ),
    ),
  );

  const complet = champs.every((c) => brouillon[c]);

  return {
    content:
      "Ton compte Riot n'est pas lié, alors dis-moi où tu en es — ça sert à équilibrer " +
      "les équipes.\n_Astuce : lie ton compte sur le site et je n'aurai plus jamais à " +
      "te le demander._",
    components: [
      ...menus,
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`pp:profile-confirm:${sessionId}`)
          .setLabel("Valider et participer")
          .setStyle(ButtonStyle.Success)
          .setDisabled(!complet),
      ),
    ],
  };
}

/* ── Boutons ──────────────────────────────────────────────────────────────── */

export async function gererBouton(interaction: ButtonInteraction): Promise<void> {
  const [, action, idBrut] = interaction.customId.split(":");
  const sessionId = Number(idBrut);
  const session = getSession(sessionId);
  const userId = interaction.user.id;

  const ephemere = (content: string) =>
    interaction.reply({ content, flags: MessageFlags.Ephemeral });

  if (!session) return void (await ephemere("Cette PP n'existe plus."));
  if (session.status === "CANCELLED" && action !== "cancel") {
    return void (await ephemere("Cette PP a été annulée."));
  }

  switch (action) {
    case "join": {
      const deja = getParticipant(sessionId, userId);
      if (deja?.status === "PARTICIPANT") return void (await ephemere("Tu es déjà inscrit."));
      if (deja?.status === "WAITLIST") {
        return void (await ephemere("Tu es déjà dans la file d'attente."));
      }

      // Compte lié : un clic suffit, on connaît déjà son rang.
      const joueur = resoudreJoueur(userId);
      if (joueur.source === "inconnu") {
        brouillons.set(cleBrouillon(sessionId, userId), {});
        await interaction.reply({ ...sorcier(sessionId, userId), flags: MessageFlags.Ephemeral });
        return;
      }

      const statut = join(sessionId, userId, session.maxPlayers);
      // Accusé immédiat et éphémère, avant le dessin : le cliqueur a son
      // retour en moins d'une seconde même quand le lobby est regroupé.
      await ephemere(
        statut === "PARTICIPANT"
          ? `Inscrit — ${joueur.rangCourt ?? "non classé"}.`
          : `PP pleine : tu es en file d'attente (${joueur.rangCourt ?? "non classé"}).`,
      );
      apresEcriture(interaction.client, sessionId);
      return;
    }

    case "profile-confirm": {
      const brouillon = brouillons.get(cleBrouillon(sessionId, userId));
      const champs = Object.keys(LIBELLES) as Champ[];
      if (!brouillon || !champs.every((c) => brouillon[c])) {
        return void (await ephemere("Choisis les quatre informations avant de valider."));
      }

      const profil: PpProfile = {
        discordUserId: userId,
        tier: brouillon.tier as Tier,
        division: brouillon.division as Division | "NA",
        mainRole: brouillon.mainRole as Role,
        secondaryRole: brouillon.secondaryRole as Role,
      };
      upsertProfile(profil);
      brouillons.delete(cleBrouillon(sessionId, userId));

      const statut = join(sessionId, userId, session.maxPlayers);
      await interaction.update({
        content:
          statut === "PARTICIPANT"
            ? "Profil enregistré, tu es inscrit."
            : "Profil enregistré. La PP est pleine : tu es en file d'attente.",
        components: [],
      });
      apresEcriture(interaction.client, sessionId);
      return;
    }

    case "unavailable": {
      setUnavailable(sessionId, userId);
      const promus = promoteWaitlist(sessionId, session.maxPlayers);
      await ephemere("Noté comme indisponible.");
      apresEcriture(interaction.client, sessionId);
      await prevenirPromus(interaction, promus);
      return;
    }

    case "leave": {
      if (!getParticipant(sessionId, userId)) {
        return void (await ephemere("Tu n'étais pas inscrit."));
      }
      leave(sessionId, userId);
      const promus = promoteWaitlist(sessionId, session.maxPlayers);
      await ephemere("Tu es retiré de cette PP.");
      apresEcriture(interaction.client, sessionId);
      await prevenirPromus(interaction, promus);
      return;
    }

    case "cancel": {
      if (userId !== session.organizerDiscordId) {
        return void (await ephemere("Seul l'organisateur peut annuler cette PP."));
      }
      cancelSession(sessionId);
      await ephemere("PP annulée.");
      apresEcriture(interaction.client, sessionId);
      return;
    }

    case "shuffle": {
      if (userId !== session.organizerDiscordId) {
        return void (await ephemere("Seul l'organisateur peut tirer les équipes."));
      }

      const inscrits = listParticipants(sessionId).filter((p) => p.status === "PARTICIPANT");
      if (inscrits.length < 2) {
        return void (await ephemere("Il faut au moins deux participants."));
      }

      const { equipes, ecartLp } = tirerEquipes(
        inscrits.map((p) => resoudreJoueur(p.discordUserId)),
      );

      // Les équipes restent en texte, pas en image : ce message doit
      // **mentionner** les joueurs, et une image ne peut pas le faire.
      const colonne = (joueurs: typeof equipes[number]) =>
        joueurs
          .map((j) => `<@${j.discordUserId}> ${j.rangCourt ? `· ${j.rangCourt}` : ""}`)
          .join("\n");

      await interaction.reply({
        content:
          `**Équipes**  ·  écart estimé : ${ecartLp} LP\n\n` +
          `**Équipe 1**\n${colonne(equipes[0])}\n\n` +
          `**Équipe 2**\n${colonne(equipes[1])}\n\n` +
          "_Relancer le tirage donne un autre résultat à force égale._",
      });
      return;
    }
  }
}

/**
 * Une place s'est libérée : on prévient publiquement, avec une vraie mention —
 * quelqu'un qui passe de la file d'attente aux inscrits doit l'apprendre.
 */
async function prevenirPromus(
  interaction: ButtonInteraction,
  promus: string[],
): Promise<void> {
  if (promus.length === 0) return;
  try {
    await interaction.followUp({
      content: `Une place s'est libérée — ${promus.map((id) => `<@${id}>`).join(" ")} tu es inscrit !`,
      allowedMentions: { users: promus },
    });
  } catch (err) {
    console.warn("[pp] impossible d'annoncer une promotion :", err);
  }
}

/* ── Menus déroulants du sorcier ──────────────────────────────────────────── */

export async function gererMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, action, idBrut, champ] = interaction.customId.split(":");
  if (action !== "profile-field") return;

  const sessionId = Number(idBrut);
  const cle = cleBrouillon(sessionId, interaction.user.id);
  const brouillon = brouillons.get(cle) ?? {};
  brouillon[champ as Champ] = interaction.values[0];
  brouillons.set(cle, brouillon);

  await interaction.update(sorcier(sessionId, interaction.user.id));
}
