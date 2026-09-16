import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { loadFonts } from "./fonts";
import { preloadCommonAssets } from "./assets";

/**
 * Le seul endroit du projet qui transforme du JSX en PNG.
 *
 * Tout passe par cette fonction — pas par commodité, mais pour que le jour où
 * le rendu doit bouger (un `worker_thread`, ou le processus du bot), ce soit
 * un fichier à changer et non une architecture. C'est aussi ce qui rend
 * possible le sémaphore ci-dessous, qui n'a de sens que global.
 *
 * Moteur : `ImageResponse` de `next/og`, déjà présent dans Next 16 — satori
 * pour la mise en page, puis `sharp` (prebuilds `linux-arm64`) pour la
 * rastérisation. Aucun module natif à compiler sur le VPS ARM, aucune
 * dépendance ajoutée.
 */

/** Bumper à chaque changement de dessin, sinon les caches servent l'ancien. */
export const CARD_VERSION = 1;

export interface RenderOptions {
  width: number;
  height: number;
}

/**
 * Sémaphore global à une place.
 *
 * satori est synchrone : il occupe la boucle d'événements pendant tout le
 * rendu (~150-200 ms sur le VPS). Sur un seul cœur, deux rendus concurrents
 * ne font que se voler le processeur et doubler la latence des deux, tout en
 * retardant les requêtes du site. Les sérialiser ne coûte rien et borne
 * l'effet sur le reste du serveur.
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Attente maximale **dans la file**.
 *
 * À dire clairement : ce délai ne peut pas interrompre un rendu en cours —
 * satori étant synchrone, rien ne s'exécute pendant qu'il travaille, pas même
 * un `setTimeout`. Il protège donc de l'embouteillage (dix cartes demandées
 * d'un coup), pas d'un rendu pathologique. Un rendu qui déraperait vraiment
 * se verrait dans la durée totale, pas ici.
 */
const QUEUE_TIMEOUT_MS = 5_000;

export async function renderCard(
  element: ReactElement,
  { width, height }: RenderOptions,
): Promise<Buffer> {
  const fonts = await loadFonts();

  const wait = queue.catch(() => {});
  const work = wait.then(async () => {
    const response = new ImageResponse(element, { width, height, fonts });
    return Buffer.from(await response.arrayBuffer());
  });
  // La file avance même si ce rendu échoue, sinon une erreur bloquerait tout.
  queue = work.catch(() => {});

  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Rendu de carte abandonné : file d'attente saturée.")),
      QUEUE_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([work, guard]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Préchauffage, appelé au démarrage du serveur (`instrumentation.ts`).
 *
 * Le tout premier rendu paie l'instanciation des wasm de satori et l'analyse
 * des six polices : 400-700 ms. Le payer une fois au démarrage, hors requête,
 * plutôt que de l'infliger à la première commande `/classement` de la journée.
 */
export async function warmUpCards(): Promise<void> {
  preloadCommonAssets();
  await renderCard(
    {
      type: "div",
      key: null,
      props: {
        style: { display: "flex", width: "100%", height: "100%", background: "#05060a" },
      },
    } as ReactElement,
    { width: 200, height: 100 },
  );
}
