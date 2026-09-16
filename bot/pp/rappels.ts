import type { Client } from "discord.js";
import { listParticipants, markReminderSent, sessionsToRemind } from "@/lib/db/pp";

/**
 * Le rappel avant une PP.
 *
 * **Un balayage périodique, pas un `setTimeout` par session.** L'ancien bot
 * armait un minuteur à la création, ce qui imposait trois choses : un garde
 * contre le débordement de `setTimeout` au-delà de 24,8 jours, une fonction de
 * réarmement au démarrage, et l'acceptation qu'un rappel soit perdu si le
 * processus tombait entre-temps. Un `SELECT` toutes les 30 s sur un index
 * partiel supprime les trois d'un coup, et coûte quelques microsecondes.
 *
 * La liste des destinataires est lue **au moment d'envoyer**, jamais à la
 * création : quelqu'un qui se désiste entre-temps ne doit pas être ping.
 */

const AVANCE_MS = 15 * 60_000;
const PERIODE_MS = 30_000;

async function balayer(client: Client): Promise<void> {
  if (!client.isReady()) return;

  for (const session of sessionsToRemind(Date.now(), AVANCE_MS)) {
    const inscrits = listParticipants(session.id).filter((p) => p.status === "PARTICIPANT");

    // Personne à prévenir : on marque quand même, sinon on rebalaie cette
    // session toutes les 30 s jusqu'à l'heure de départ.
    if (inscrits.length === 0) {
      markReminderSent(session.id);
      continue;
    }

    try {
      const salon = await client.channels.fetch(session.channelId);
      if (!salon?.isTextBased() || !("send" in salon)) {
        markReminderSent(session.id);
        continue;
      }

      const mentions = inscrits.map((p) => `<@${p.discordUserId}>`);
      await salon.send({
        content:
          `La PP de ${session.heureLabel} commence dans un quart d'heure !\n` +
          mentions.join(" "),
        allowedMentions: { users: inscrits.map((p) => p.discordUserId) },
      });
      markReminderSent(session.id);
    } catch (err) {
      // Marqué envoyé malgré l'échec : sans ça, un salon devenu interdit
      // (50013) ferait boucler ce rappel toutes les 30 s jusqu'à l'heure de
      // départ. C'est exactement la boucle qui remplissait le journal de
      // l'ancien bot.
      console.warn(`[pp] rappel de la session ${session.id} impossible :`, err);
      markReminderSent(session.id);
    }
  }
}

export function demarrerRappels(client: Client): NodeJS.Timeout {
  const timer = setInterval(() => {
    void balayer(client).catch((err) => console.error("[pp] balayage des rappels :", err));
  }, PERIODE_MS);
  // Ne doit pas empêcher le processus de se terminer sur un SIGTERM.
  timer.unref();
  return timer;
}
