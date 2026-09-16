import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type BaseMessageOptions,
} from "discord.js";
import type { LobbyCardModel, LobbyPlayerModel } from "@/lib/cards/models";
import {
  getSession,
  listParticipants,
  refreshSessionStatus,
  setSessionMessage,
  type PpSession,
} from "@/lib/db/pp";
import { rendreCarte } from "../web";
import { resoudreJoueur } from "./joueurs";
import { libelleInstant } from "./temps";

/**
 * Le message d'un lobby : sa construction, son envoi, et surtout sa cadence.
 *
 * Principe hérité de l'ancien bot, et qui est la raison de sa robustesse :
 * **on ne modifie jamais le message à partir de ce qu'il contenait**, on le
 * redessine intégralement à partir de la base. Un clic écrit, puis on
 * redessine. Redémarrages, clics simultanés, message supprimé : tout se
 * rattrape parce que la vérité n'est jamais dans le message.
 */

const MODES: Record<PpSession["mode"], string> = {
  NORMAL: "Normal",
  FEARLESS: "Fearless Draft",
  ARAM_MAYHEM: "ARAM Mayhem",
};

const FORMATS: Record<PpSession["format"], string> = {
  BO1: "Bo1",
  BO3: "Bo3",
  BO5: "Bo5",
};

/* ── Modèle ───────────────────────────────────────────────────────────────── */

/**
 * Le nom d'affichage d'un membre.
 *
 * `client.users.fetch` sert son cache quand il l'a — ce qui est le cas dès le
 * second rendu d'un lobby. Un échec (compte supprimé, Discord en panne) donne
 * un nom générique plutôt que de faire échouer la carte entière.
 */
async function nomAffiche(client: Client, id: string): Promise<string> {
  try {
    const u = await client.users.fetch(id);
    return u.displayName || u.username;
  } catch {
    return "joueur inconnu";
  }
}

async function versModele(client: Client, session: PpSession): Promise<LobbyCardModel> {
  const participants = listParticipants(session.id);

  const enJeu = participants.filter((p) => p.status === "PARTICIPANT");
  const attente = participants.filter((p) => p.status === "WAITLIST");
  const absents = participants.filter((p) => p.status === "UNAVAILABLE");

  const versJoueur = async (discordUserId: string): Promise<LobbyPlayerModel> => {
    const j = resoudreJoueur(discordUserId);
    return {
      name: await nomAffiche(client, discordUserId),
      tier: j.tier,
      division: j.division,
      leaguePoints: j.leaguePoints,
      rankShort: j.rangCourt,
      mesure: j.source === "mesuré",
      role: j.mainRole,
    };
  };

  return {
    mode: MODES[session.mode],
    format: FORMATS[session.format],
    instant: session.startsAt
      ? libelleInstant(session.startsAt)
      : `${session.heureLabel} — ${session.dateLabel}`,
    organizer: await nomAffiche(client, session.organizerDiscordId),
    maxPlayers: session.maxPlayers,
    participants: await Promise.all(enJeu.map((p) => versJoueur(p.discordUserId))),
    waitlist: await Promise.all(attente.map((p) => versJoueur(p.discordUserId))),
    unavailable: absents.length,
    cancelled: session.status === "CANCELLED",
    updatedAt: Date.now(),
  };
}

/* ── Boutons ──────────────────────────────────────────────────────────────── */

function boutons(session: PpSession): ActionRowBuilder<ButtonBuilder>[] {
  const mort = session.status === "CANCELLED";
  const id = session.id;

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pp:join:${id}`)
        .setLabel("Participer")
        .setStyle(ButtonStyle.Success)
        .setDisabled(mort),
      new ButtonBuilder()
        .setCustomId(`pp:unavailable:${id}`)
        .setLabel("Indisponible")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(mort),
      new ButtonBuilder()
        .setCustomId(`pp:leave:${id}`)
        .setLabel("Se désister")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(mort),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pp:shuffle:${id}`)
        .setLabel("Tirer les équipes")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(mort),
      new ButtonBuilder()
        .setCustomId(`pp:cancel:${id}`)
        .setLabel("Annuler la PP")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(mort),
    ),
  ];
}

/* ── Rendu ────────────────────────────────────────────────────────────────── */

/** Le repli quand le rendu échoue : le lobby doit rester utilisable. */
function embedDeRepli(model: LobbyCardModel): EmbedBuilder {
  const liste =
    model.participants.map((p, i) => `\`${i + 1}\` ${p.name} — ${p.rankShort ?? "non lié"}`)
      .join("\n") || "_Personne pour l'instant_";

  return new EmbedBuilder()
    .setTitle(`${model.mode} · ${model.format}`)
    .setDescription(`${model.instant}\n\n**Participants (${model.participants.length}/${model.maxPlayers})**\n${liste}`)
    .setColor(model.cancelled ? 0xff2d55 : 0xe9ff1f);
}

/**
 * Le contenu du message, valable pour un envoi comme pour une édition.
 *
 * `attachments: []` n'est PAS ici : c'est une option d'édition seulement, qui
 * dit à Discord d'oublier les pièces jointes précédentes. On l'ajoute au point
 * d'édition, où elle est indispensable — sans elle, `files` ajoute au lieu de
 * remplacer et l'ancienne image reste collée au message.
 */
async function construireMessage(
  client: Client,
  session: PpSession,
): Promise<BaseMessageOptions> {
  const model = await versModele(client, session);
  const reponse = await rendreCarte("/api/internal/cards/lobby", model);

  const composants = boutons(session);

  if (!reponse || reponse.png === null) {
    return {
      content: "",
      embeds: [embedDeRepli(model)],
      components: composants,
      files: [],
      allowedMentions: { parse: [] },
    };
  }

  const fichier = new AttachmentBuilder(reponse.png, {
    // La version dans le nom empêche le CDN de Discord de resservir l'image
    // précédente à chaque édition.
    name: `pp-${session.id}-${model.updatedAt}.png`,
    description: reponse.alt.slice(0, 1024),
  });

  return {
    content: "",
    embeds: [],
    files: [fichier],
    components: composants,
    allowedMentions: { parse: [] },
  };
}

/* ── Écriture du message, avec auto-réparation ────────────────────────────── */

/**
 * Redessine le message du lobby.
 *
 * Reprend l'auto-réparation de l'ancien bot : si le message a disparu ou est
 * devenu inaccessible (10008 message inconnu, 10003 salon inconnu, 50001 accès
 * manquant), on en poste un neuf et on réécrit le pointeur en base. C'est le
 * seul morceau de l'ancien code repris quasiment tel quel, parce qu'il traite
 * un cas réel que rien d'autre ne rattrape.
 */
export async function redessiner(client: Client, sessionId: number): Promise<void> {
  const session = getSession(sessionId);
  if (!session) return;

  const payload = await construireMessage(client, session);

  try {
    const salon = await client.channels.fetch(session.channelId);
    // `isSendable()` plutôt que `isTextBased()` : un salon de groupe privé est
    // « textuel » sans qu'on puisse y écrire, et TypeScript le sait.
    if (!salon?.isTextBased() || !salon.isSendable()) return;

    if (session.messageId) {
      try {
        const message = await salon.messages.fetch(session.messageId);
        // `attachments: []` est obligatoire ici : `files` ajoute une pièce
        // jointe, il ne remplace pas celle déjà présente.
        await message.edit({ ...payload, attachments: [] });
        return;
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code !== 10008 && code !== 10003 && code !== 50001) throw err;
      }
    }

    const neuf = await salon.send(payload);
    setSessionMessage(sessionId, neuf.channelId, neuf.id);
    console.warn(`[pp] message de la PP ${sessionId} recréé (${neuf.id}).`);
  } catch (err) {
    console.error(`[pp] impossible de redessiner la PP ${sessionId} :`, err);
  }
}

/* ── Cadence ──────────────────────────────────────────────────────────────── */

/**
 * Coalescence des clics.
 *
 * Ce n'est pas le processeur qui lâche en premier quand dix personnes
 * s'inscrivent d'un coup, c'est **Discord** : environ cinq modifications de
 * message par cinq secondes et par salon, au-delà c'est un 429. Sans
 * regroupement, une PP qui se remplit en trente secondes se fait jeter.
 *
 * Trois règles :
 *  - le premier clic redessine tout de suite ;
 *  - les suivants sont regroupés sur 700 ms ;
 *  - jamais deux dessins à moins de 1,5 s d'intervalle pour un même lobby.
 *
 * L'état, lui, est déjà écrit en base au moment du clic : différer le dessin
 * ne diffère jamais l'inscription.
 */
const DEBOUNCE_MS = 700;
const PLANCHER_MS = 1_500;

interface Cadence {
  timer: NodeJS.Timeout | null;
  dernier: number;
}

const cadences = new Map<number, Cadence>();

export function planifierRedessin(client: Client, sessionId: number): void {
  const maintenant = Date.now();
  const cadence = cadences.get(sessionId) ?? { timer: null, dernier: 0 };

  // Un redessin est déjà programmé : il lira l'état à jour, rien à ajouter.
  if (cadence.timer) return;

  const depuis = maintenant - cadence.dernier;
  const attente = depuis >= PLANCHER_MS ? DEBOUNCE_MS : Math.max(PLANCHER_MS - depuis, DEBOUNCE_MS);

  cadence.timer = setTimeout(() => {
    const c = cadences.get(sessionId);
    if (c) {
      c.timer = null;
      c.dernier = Date.now();
    }
    void redessiner(client, sessionId);
  }, attente);

  cadences.set(sessionId, cadence);
}

/** Recalcule OPEN/FULL puis programme le redessin — le geste de fin de clic. */
export function apresEcriture(client: Client, sessionId: number): void {
  refreshSessionStatus(sessionId);
  planifierRedessin(client, sessionId);
}

export { construireMessage };
