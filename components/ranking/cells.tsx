"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { crestSrc, rankLabel } from "@/lib/lol";
import { kdaLabel, winratePct } from "@/lib/format";
import { isApex } from "@/lib/lol";
import type { RankSnapshot, RankingEntry } from "@/lib/types";
import type { RecordMode } from "./LadderHead";
import type { StatsProvider } from "@/lib/providers";
import { Delta } from "@/components/ui/Delta";
import { LiveTimer } from "@/components/ui/LiveTimer";

/* ── Palier : emblème + division en pastille + LP ─────────────────────────── */

export function EloCell({ rank }: { rank: RankSnapshot }) {
  return (
    <span
      className="inline-flex items-center gap-2"
      title={`${rankLabel(rank)} · ${rank.leaguePoints} LP`}
    >
      <span className="relative shrink-0">
        <Image
          src={crestSrc(rank.tier)}
          alt=""
          width={26}
          height={26}
          aria-hidden
          unoptimized
          className="size-[26px] object-contain"
        />
        {!isApex(rank.tier) && rank.division && (
          <span className="num absolute -right-1 -bottom-0.5 rounded-[2px] bg-void/90 px-[3px] text-[0.5rem] leading-[1.35] font-semibold text-ink-2 ring-1 ring-hair-2">
            {rank.division}
          </span>
        )}
      </span>
      <span className="num text-num font-semibold text-ink tabular-nums">
        {rank.leaguePoints}
        <span className="ml-0.5 text-[0.6875rem] font-normal text-ink-4">LP</span>
      </span>
    </span>
  );
}

/* ── Bilan : winrate, valeur selon le mode, barre deux tons ───────────────── */

export function RecordCell({
  entry,
  mode,
}: {
  entry: RankingEntry;
  mode: RecordMode;
}) {
  const { wins, losses } = entry.rank;
  const total = wins + losses;
  const ratio = total === 0 ? 0 : (wins / total) * 100;
  const wr = winratePct(wins, losses);
  const net = wins - losses;

  return (
    <span className="flex w-full flex-col gap-1.5">
      <span className="flex items-baseline justify-center gap-2 leading-none">
        <span
          className={cn(
            "num text-num font-semibold tabular-nums",
            wr >= 50 ? "text-ink" : "text-ink-2",
          )}
        >
          {wr}%
        </span>

        {mode === "record" && (
          <span className="num text-[0.6875rem] font-medium tabular-nums">
            <span className="text-acid/85">{wins}V</span>
            <span className="text-ink-4"> · </span>
            <span className="text-blaze">{losses}D</span>
          </span>
        )}
        {mode === "net" && (
          <span
            title={`${wins} victoires − ${losses} défaites`}
            className={cn(
              "num text-[0.75rem] font-semibold tabular-nums",
              net > 0 ? "text-acid" : net < 0 ? "text-blaze" : "text-ink-4",
            )}
          >
            {net > 0 ? `+${net}` : net}
          </span>
        )}
        {mode === "games" && (
          <span
            title={`${total} parties classées`}
            className="num text-[0.6875rem] font-medium text-ink-2 tabular-nums"
          >
            {total}
          </span>
        )}
      </span>

      {/* Barre de winrate : deux segments, un filet de séparation d'1 px.
          La largeur est calculée sur le ratio brut, pas sur le pourcentage
          arrondi, sinon la barre et le chiffre divergent d'un pixel. */}
      <span className="flex h-[5px] w-full gap-[2px] overflow-hidden">
        <span
          className="h-full rounded-[1px] bg-acid/85"
          style={{ width: `${ratio}%` }}
        />
        <span
          className="h-full rounded-[1px] bg-blaze/55"
          style={{ width: `${100 - ratio}%` }}
        />
      </span>
    </span>
  );
}

/* ── 24 h : LP nets + bilan de la journée ─────────────────────────────────── */

export function SessionCell({ entry }: { entry: RankingEntry }) {
  if (entry.session.games === 0)
    return (
      <span className="num text-[0.6875rem] text-ink-4" title="Aucune partie depuis 24 h">
        —
      </span>
    );
  return (
    <span
      className="flex flex-col items-center gap-1"
      title={
        entry.session.partial
          ? "Total incomplet : la variation de certaines parties de la fenêtre n'a pas pu être mesurée"
          : undefined
      }
    >
      <Delta value={entry.session.lp} unit={null} />
      <span className="num text-[0.625rem] text-ink-4 tabular-nums">
        {entry.session.wins}V·{entry.session.losses}D
      </span>
    </span>
  );
}

/* ── ±LP : gain moyen par victoire, perte moyenne par défaite ─────────────── */

export function LpAverageCell({
  averages,
}: {
  averages: { win: number; loss: number };
}) {
  return (
    <span
      className="num inline-flex items-center gap-1.5 text-[0.75rem] font-medium tabular-nums"
      title="LP moyens gagnés par victoire / perdus par défaite"
    >
      <span className="inline-flex items-center gap-[2px] text-acid/85">
        <svg width="5" height="4" viewBox="0 0 5 4" aria-hidden>
          <path d="M2.5 0 5 4H0z" fill="currentColor" />
        </svg>
        {averages.win || "—"}
      </span>
      <span className="inline-flex items-center gap-[2px] text-blaze">
        <svg width="5" height="4" viewBox="0 0 5 4" aria-hidden>
          <path d="M2.5 4 0 0h5z" fill="currentColor" />
        </svg>
        {Math.abs(averages.loss) || "—"}
      </span>
    </span>
  );
}

/* ── KDA ──────────────────────────────────────────────────────────────────── */

export function KdaCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "num text-num font-medium tabular-nums",
        value >= 4 ? "text-ink" : value >= 2.5 ? "text-ink-2" : "text-ink-3",
      )}
      title="KDA sur les 26 dernières parties"
    >
      {kdaLabel(value)}
    </span>
  );
}

/* ── Profil : chip vers le site de statistiques choisi ───────────────────── */

export function ProviderChip({
  entry,
  provider,
  serverNow,
}: {
  entry: RankingEntry;
  provider: StatsProvider;
  serverNow: number;
}) {
  const href = provider.url(
    entry.player.gameName,
    entry.player.tagLine,
    entry.player.region,
  );
  const inGame = entry.live !== null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      title={
        inGame
          ? `En partie sur ${entry.live?.championName} · ouvrir sur ${provider.label}`
          : `Ouvrir sur ${provider.label}`
      }
      className={cn(
        "skewbox-sm num inline-flex h-7 items-center justify-center gap-1.5 px-3 text-[0.625rem] font-semibold tracking-[0.08em] transition-colors duration-150",
        inGame
          ? "bg-acid text-acid-ink hover:brightness-110"
          : "bg-panel-3 text-ink-3 hover:bg-panel-4 hover:text-ink",
      )}
    >
      {inGame && (
        <span className="size-[5px] animate-pulse-dot rounded-full bg-acid-ink" />
      )}
      {inGame && entry.live ? (
        <LiveTimer startedAt={entry.live.startedAt} serverNow={serverNow} />
      ) : (
        provider.short
      )}
    </a>
  );
}
