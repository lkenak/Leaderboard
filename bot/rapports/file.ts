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
import {
  disableReportChannel,
  listDigestLinks,
  listLinksForLadder,
  markDigestSent,
  type GuildLinkWithLadder,
} from "@/lib/db/discord-guilds";
import { laddersContainingPuuid } from "@/lib/db/ladders";
import { ladderGameWindow, listGames } from "@/lib/db/riot-players";
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

/**
 * Silence au bout duquel une soirée est réputée terminée.
 *
 * Plus long que l'intervalle entre deux parties classées enchaînées — fin de
 * partie, file, sélection des champions, chargement — sinon un résumé
 * partirait au milieu de la session et le suivant serait tronqué. Plus court
 * qu'une pause dîner, sinon on attendrait le lendemain matin.
 */
const CALME_MS = 25 * 60_000;

/**
 * Au-delà, on résume même si le ladder joue encore.
 *
 * Un groupe qui enchaîne sans jamais laisser 25 minutes de blanc ne doit pas
 * repousser son résumé indéfiniment : la carte grossit d'une ligne par joueur,
 * pas par partie, mais le message finirait par arriver le surlendemain.
 */
const FLUSH_MAX_MS = 8 * 3600_000;

/**
 * Au-delà, une fenêtre qu'on n'arrive pas à rendre est abandonnée.
 *
 * Sans cette porte de sortie, une fenêtre dont les parties ont été purgées par
 * la rétention avant d'être résumées bloquerait la borne pour toujours, et le
 * balayage réessaierait toutes les 30 secondes indéfiniment — exactement la
 * boucle que `disableReportChannel` existe pour éviter ailleurs.
 */
const ABANDON_MS = 12 * 3600_000;

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
    let resumes = 0;

    for (const ladder of ladders) {
      for (const lien of listLinksForLadder(ladder.id)) {
        if (!lien.reportChannelId) continue;
        /* Ce salon veut un résumé, pas une carte par partie. Il est compté à
           part : sans ça l'événement serait marqué « aucun salon configuré »,
           ce qui est faux et rendrait le diagnostic trompeur. Le résumé, lui,
           ne passe pas par la file — il se déclenche sur un silence, et aucune
           ligne n'arrive pour signaler qu'une soirée vient de finir. */
        if (lien.reportMode === "resume-soiree") {
          resumes++;
          continue;
        }
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
      markEventProcessed(
        evenement.id,
        resumes > 0
          ? "couvert par un résumé de soirée"
          : "aucun salon de comptes rendus configuré",
      );
    } else if (echecs === 0) {
      markEventProcessed(evenement.id);
    } else {
      markEventFailed(evenement.id, `${echecs} envoi(s) en échec`);
    }
  }
}

/* ── Résumés de soirée ────────────────────────────────────────────────────── */

/** `soiree-le-gange-20260919-2347.png` — daté, pour que le CDN de Discord ne
 *  ressorte pas l'image de la veille. */
function nomFichier(slug: string, ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `soiree-${slug}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours(),
  )}${p(d.getMinutes())}.png`;
}

async function envoyerResume(
  client: Client,
  lien: GuildLinkWithLadder,
  depuis: number,
  jusqua: number,
): Promise<boolean> {
  if (!lien.reportChannelId) return false;

  const reponse = await recupererCarte(
    `/api/internal/cards/soiree?slug=${encodeURIComponent(lien.ladder.slug)}` +
      `&depuis=${depuis}&jusqua=${jusqua}`,
  );
  if (!reponse || reponse.png === null) return false;

  try {
    const salon = await client.channels.fetch(lien.reportChannelId);
    if (!salon?.isTextBased() || !salon.isSendable()) return false;

    const fichier = new AttachmentBuilder(reponse.png, {
      name: nomFichier(lien.ladder.slug, jusqua),
      description: reponse.alt.slice(0, 1024),
    });
    /* Un résumé porte du texte, contrairement au compte rendu d'une partie :
       c'est cette ligne qu'on retrouve en cherchant dans l'historique, et elle
       reste lisible quand quelqu'un a désactivé les images. */
    await salon.send({
      content: reponse.summary ?? "",
      files: [fichier],
      allowedMentions: { parse: [] as never[] },
    });
    return true;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code && CODES_DEFINITIFS.has(code)) {
      disableReportChannel(
        lien.guildId,
        lien.ladderId,
        `Discord a refusé l'envoi (code ${code}). Comptes rendus coupés — ` +
          "vérifie mes permissions puis relance /ladder salon.",
      );
      console.warn(`[rapports] salon ${lien.reportChannelId} coupé après un ${code}.`);
      return false;
    }
    console.warn(`[rapports] résumé de ${lien.ladder.slug} impossible :`, err);
    return false;
  }
}

/**
 * Décide, pour chaque salon en résumé, si la soirée est finie.
 *
 * Aucun événement ne déclenche un résumé : c'est le **silence** qui le
 * déclenche. D'où un balayage qui interroge la base plutôt qu'une file — une
 * requête locale par liaison concernée, et rien d'autre tant que personne ne
 * joue.
 */
async function balayerResumes(client: Client): Promise<void> {
  for (const lien of listDigestLinks()) {
    // Mode posé à la main en base, sans passer par `setReportMode` : on pose
    // la borne à maintenant et on démarre au prochain tour, plutôt que de
    // résumer un historique dont personne n'a demandé le rappel.
    if (lien.lastDigestAt === null) {
      markDigestSent(lien.id, Date.now());
      continue;
    }

    const { parties, premiere, derniere } = ladderGameWindow(lien.ladderId, lien.lastDigestAt);
    if (parties === 0 || premiere === null || derniere === null) continue;

    const maintenant = Date.now();
    const calme = maintenant - derniere >= CALME_MS;
    const trainePuisLongtemps = maintenant - premiere >= FLUSH_MAX_MS;
    if (!calme && !trainePuisLongtemps) continue;

    if (await envoyerResume(client, lien, lien.lastDigestAt, derniere)) {
      markDigestSent(lien.id, derniere);
      console.log(
        `[rapports] résumé de ${lien.ladder.slug} envoyé (${parties} ligne(s) de partie).`,
      );
      continue;
    }

    /* L'envoi a échoué. On réessaiera au prochain balayage — sauf si la
       fenêtre est si vieille que ses parties ont probablement été purgées :
       la borne avance alors pour de bon, sinon elle bloque tous les résumés
       suivants du même salon. */
    if (maintenant - derniere >= ABANDON_MS) {
      markDigestSent(lien.id, derniere);
      console.warn(
        `[rapports] résumé de ${lien.ladder.slug} abandonné après ${Math.round(
          (maintenant - derniere) / 3600_000,
        )} h d'échecs ; la fenêtre est passée.`,
      );
    }
  }
}

let dernierMenage = 0;

export function demarrerRapports(client: Client): NodeJS.Timeout {
  const timer = setInterval(() => {
    void balayer(client)
      .then(() => balayerResumes(client))
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
