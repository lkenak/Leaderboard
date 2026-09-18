import { AttachmentBuilder, type Client } from "discord.js";
import {
  TENTATIVES_MAX,
  delayEvent,
  enregistrerMessage,
  libererReservation,
  markEventFailed,
  markEventProcessed,
  pendingGameEvents,
  purgerAnciensEvenements,
  reserverEnvoi,
} from "@/lib/db/game-events";
import { disableReportChannel, listLinksForLadder } from "@/lib/db/discord-guilds";
import { laddersContainingPuuid } from "@/lib/db/ladders";
import { listGames } from "@/lib/db/riot-players";
import { recupererCarte } from "../web";

/**
 * Le consommateur de la file des parties terminées.
 *
 * La synchronisation Riot découvre les parties et les met en file ; ce
 * balayage les annonce. Le découplage est ce qui rend l'annonce durable : le
 * bot peut redémarrer ou Discord tomber, les lignes attendent.
 *
 * Trois problèmes que ce fichier existe pour résoudre :
 *
 *  - **le doublon.** Cinq membres d'un même ladder dans la même partie
 *    produisent cinq événements. `reserverEnvoi` n'en laisse passer qu'un par
 *    salon, les autres éditent le message déjà posté ;
 *  - **le delta de LP absent.** Il n'est connu qu'une fois qu'un relevé
 *    encadre la partie. On diffère une fois plutôt que d'afficher « — LP »
 *    alors qu'on saura la valeur dans deux minutes ;
 *  - **le salon interdit.** Un `50013` ne doit pas être réessayé : on coupe
 *    les envois pour ce ladder et on note pourquoi, visible dans
 *    `/ladder etat`. L'ancien bot bouclait là-dessus toutes les 30 secondes.
 */

const PERIODE_MS = 30_000;

/** Un événement au plus jeune que ça peut encore gagner son delta de LP. */
const ATTENTE_DELTA_MS = 10 * 60_000;
const REPORT_DELTA_MS = 3 * 60_000;

/* ── Envoi ────────────────────────────────────────────────────────────────── */

/** Les codes qui disent « n'insiste pas » plutôt que « réessaie ». */
const CODES_DEFINITIFS = new Set([50013, 50001, 10003]);

async function annoncerDansSalon(
  client: Client,
  params: {
    channelId: string;
    guildId: string;
    ladderId: string;
    ladderSlug: string;
    matchId: string;
  },
): Promise<"envoyé" | "déjà-posté" | "caduc" | "salon-coupé" | "échec"> {
  const { channelId, guildId, ladderId, ladderSlug, matchId } = params;

  const reponse = await recupererCarte(
    `/api/internal/cards/game?slug=${encodeURIComponent(ladderSlug)}&matchId=${encodeURIComponent(matchId)}`,
  );
  // 404 → la partie a été purgée par la rétention avant qu'on l'annonce.
  // `recupererCarte` rend `null` ; on ne saura pas la distinguer d'un site
  // injoignable, mais dans les deux cas il n'y a rien à poster maintenant.
  if (!reponse || reponse.png === null) return "échec";

  // Réservation AVANT l'envoi : c'est elle qui empêche cinq coéquipiers de
  // produire cinq cartes.
  const reservation = reserverEnvoi(channelId, matchId, guildId, ladderId);

  try {
    const salon = await client.channels.fetch(channelId);
    if (!salon?.isTextBased() || !salon.isSendable()) {
      if (reservation.nouveau) libererReservation(channelId, matchId);
      return "échec";
    }

    const fichier = new AttachmentBuilder(reponse.png, {
      name: `game-${matchId}.png`,
      description: reponse.alt.slice(0, 1024),
    });
    const payload = { content: "", files: [fichier], allowedMentions: { parse: [] as never[] } };

    if (!reservation.nouveau) {
      // Déjà posté : la carte vient d'être redessinée avec le joueur qui
      // manquait, on remplace l'image du message existant.
      if (!reservation.messageId) return "déjà-posté";
      // `messages.edit` et non `fetch` puis `edit` : lire un message exige
      // « Lire l'historique », que le bot ne demande pas.
      await salon.messages.edit(reservation.messageId, { ...payload, attachments: [] });
      return "déjà-posté";
    }

    const message = await salon.send(payload);
    enregistrerMessage(channelId, matchId, message.id);
    return "envoyé";
  } catch (err) {
    if (reservation.nouveau) libererReservation(channelId, matchId);

    const code = (err as { code?: number })?.code;
    if (code && CODES_DEFINITIFS.has(code)) {
      disableReportChannel(
        guildId,
        ladderId,
        `Discord a refusé l'envoi (code ${code}). Comptes rendus coupés — ` +
          "vérifie mes permissions puis relance /ladder salon.",
      );
      console.warn(`[rapports] salon ${channelId} coupé après un ${code}.`);
      return "salon-coupé";
    }

    console.warn(`[rapports] envoi de ${matchId} impossible :`, err);
    return "échec";
  }
}

/* ── Balayage ─────────────────────────────────────────────────────────────── */

async function balayer(client: Client): Promise<void> {
  if (!client.isReady()) return;

  for (const evenement of pendingGameEvents()) {
    // Repoussé par `delayEvent` : son heure n'est pas venue.
    if (evenement.createdAt > Date.now()) continue;

    if (evenement.attempts >= TENTATIVES_MAX) {
      markEventProcessed(evenement.id, `abandonné après ${TENTATIVES_MAX} tentatives`);
      continue;
    }

    const partie = listGames(evenement.puuid).find((g) => g.id === evenement.matchId);
    if (!partie) {
      // Purgée par la rétention avant d'avoir été annoncée : caduc, pas une
      // erreur. La file ne garde pas de clé étrangère vers `games` pour
      // exactement ce cas.
      markEventProcessed(evenement.id, "partie purgée avant annonce");
      continue;
    }

    /* Le delta de LP vaut la peine d'attendre un cycle : `fillLpDeltas` ne
       l'attribue qu'une fois la partie encadrée par deux relevés. Une seule
       fois — au-delà de dix minutes, il ne viendra plus, et poster « — LP »
       vaut mieux que ne rien poster. */
    const age = Date.now() - evenement.endedAt;
    if (partie.lpDelta === null && age < ATTENTE_DELTA_MS) {
      delayEvent(evenement.id, REPORT_DELTA_MS);
      continue;
    }

    const ladders = laddersContainingPuuid(evenement.puuid);
    if (ladders.length === 0) {
      markEventProcessed(evenement.id, "aucun ladder ne suit ce compte");
      continue;
    }

    let destinations = 0;
    let echecs = 0;

    for (const ladder of ladders) {
      for (const lien of listLinksForLadder(ladder.id)) {
        if (!lien.reportChannelId) continue;
        destinations++;

        const res = await annoncerDansSalon(client, {
          channelId: lien.reportChannelId,
          guildId: lien.guildId,
          ladderId: ladder.id,
          ladderSlug: ladder.slug,
          matchId: evenement.matchId,
        });
        if (res === "échec") echecs++;
      }
    }

    if (destinations === 0) {
      markEventProcessed(evenement.id, "aucun salon de comptes rendus configuré");
    } else if (echecs === 0) {
      markEventProcessed(evenement.id);
    } else {
      markEventFailed(evenement.id, `${echecs} envoi(s) en échec`);
    }
  }
}

let dernierMenage = 0;

export function demarrerRapports(client: Client): NodeJS.Timeout {
  const timer = setInterval(() => {
    void balayer(client)
      .then(() => {
        // Une fois par jour : la file et les traces d'envoi n'ont pas à
        // grossir indéfiniment.
        if (Date.now() - dernierMenage < 24 * 3600_000) return;
        dernierMenage = Date.now();
        const purges = purgerAnciensEvenements();
        if (purges > 0) console.log(`[rapports] ${purges} ligne(s) anciennes purgées.`);
      })
      .catch((err) => console.error("[rapports] balayage :", err));
  }, PERIODE_MS);
  timer.unref();
  return timer;
}
