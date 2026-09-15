"use client";

import { useActionState } from "react";
import { cn } from "@/lib/cn";
import {
  forgetRiotKeyAction,
  saveRiotKeyAction,
  type ActionResult,
} from "@/app/admin/actions";

/**
 * Saisie de la clé Riot à l'écran.
 *
 * Elle existe pour une raison de confort qui finit par peser lourd : une clé
 * de *développement* expire toutes les 24 h, et la renouveler en éditant
 * `.env.local` demande d'ouvrir un éditeur puis de relancer le serveur, chaque
 * matin. Ici, c'est un collage et une seconde d'attente.
 *
 * Les libellés temporels arrivent déjà calculés du serveur : les recalculer au
 * rendu client ferait diverger l'hydratation de quelques minutes.
 */
export function RiotKeyForm({
  source,
  masked,
  ageLabel,
  rejectedLabel,
  likelyExpired,
}: {
  source: "admin" | "env" | "none";
  masked: string | null;
  /** « il y a 3 h » — seulement pour une clé saisie ici. */
  ageLabel: string | null;
  /** « il y a 12 min » — si Riot l'a refusée. */
  rejectedLabel: string | null;
  /** Saisie il y a plus de 24 h et pas encore refusée : probablement morte. */
  likelyExpired: boolean;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(
    saveRiotKeyAction,
    null,
  );

  const tone = rejectedLabel
    ? "bad"
    : source === "none"
      ? "bad"
      : likelyExpired
        ? "warn"
        : "ok";

  return (
    <section
      className={cn(
        "rounded-md border bg-panel p-5",
        tone === "ok" ? "border-hair" : "border-blaze/40",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sub font-semibold text-ink">Clé Riot</h2>
        <p
          className={cn(
            "num text-[0.6875rem] tracking-[0.06em]",
            tone === "ok"
              ? "text-acid"
              : tone === "warn"
                ? "text-blaze"
                : "text-blaze",
          )}
        >
          {masked ?? "aucune clé"}
          {source === "env" && " · environnement"}
          {source === "admin" && ageLabel && ` · saisie ${ageLabel}`}
        </p>
      </div>

      {/* — Ce qu'il faut savoir, dans l'ordre d'urgence — */}
      {rejectedLabel ? (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-blaze">
          Riot a refusé cette clé ({rejectedLabel}). Les relevés automatiques
          sont à l&apos;arrêt jusqu&apos;à ce qu&apos;une clé valide soit
          collée — inutile de marteler l&apos;API avec une clé morte.
        </p>
      ) : source === "none" ? (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-2">
          Le classement affiche des données de démonstration. Coller une clé
          ci-dessous pour brancher les vrais comptes.
        </p>
      ) : likelyExpired ? (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-blaze">
          Cette clé a été saisie {ageLabel}. Une clé de développement ne vit que
          24 h : elle est probablement expirée.
        </p>
      ) : (
        <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-3">
          {source === "env"
            ? "Clé lue dans l'environnement. En coller une ici la remplace, sans redémarrer le serveur ni toucher à .env.local."
            : "Clé vérifiée auprès de Riot au moment de la saisie. Une clé de développement expire 24 h après sa génération sur le portail."}
        </p>
      )}

      <form action={action} className="mt-4 flex flex-wrap items-start gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="riot-key" className="label">
            Coller une clé
          </label>
          <input
            id="riot-key"
            name="key"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            placeholder="RGAPI-…"
            className="num mt-2 h-11 w-full rounded-sm border border-hair bg-panel-3/60 px-3 text-[0.875rem] text-ink transition-colors duration-150 hover:border-hair-2 focus:border-acid/50"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="num mt-[1.6875rem] h-11 rounded-sm bg-acid px-5 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Vérification…" : "Enregistrer"}
        </button>
      </form>

      {result?.message && (
        <p
          role="status"
          className={cn(
            "mt-3 text-[0.8125rem]",
            result.ok ? "text-acid" : "text-blaze",
          )}
        >
          {result.message}
        </p>
      )}

      <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-4">
        Pour ne plus repasser ici chaque jour : « Register Product » → Personal
        sur le portail Riot. Une clé personnelle n&apos;expire pas, et se pose
        une fois pour toutes dans <code className="num">RIOT_API_KEY</code>.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href="https://developer.riotgames.com"
          target="_blank"
          rel="noreferrer noopener"
          className="num text-[0.6875rem] tracking-[0.08em] text-ink-3 underline decoration-hair-3 underline-offset-2 transition-colors duration-150 hover:text-acid"
        >
          PORTAIL RIOT ↗
        </a>
        {source === "admin" && (
          <form action={forgetRiotKeyAction}>
            <button
              type="submit"
              title="Oublier la clé saisie et repasser à RIOT_API_KEY"
              className="num text-[0.6875rem] tracking-[0.08em] text-ink-4 transition-colors duration-150 hover:text-blaze"
            >
              OUBLIER CETTE CLÉ
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
