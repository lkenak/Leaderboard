"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { duration, kdaLabel, relativeTime, shortDate, signed, thousands } from "@/lib/format";
import { rankFromAbsoluteLp, rankLabel, roleLabel } from "@/lib/lol";
import { lpAverages } from "@/lib/ranking";
import type { RankingEntry } from "@/lib/types";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { Sparkline } from "@/components/ui/Sparkline";
import { Delta } from "@/components/ui/Delta";

type Tab = "history" | "stats";

/**
 * Panneau dépliable d'une ligne. Deux onglets seulement : l'historique des
 * parties et les agrégats. Un panneau qui en propose six ne sert qu'à cacher
 * qu'on n'a rien à montrer.
 */
export function RowDetail({
  entry,
  now,
}: {
  entry: RankingEntry;
  now: number;
}) {
  const [tab, setTab] = useState<Tab>("history");

  return (
    <div
      className="border-b border-hair bg-panel-2/60 px-3 pb-3"
      style={{ animation: "rise 0.22s var(--ease-out-quint) both" }}
    >
      <div className="rounded-md border border-hair bg-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Détail du joueur"
            className="flex items-center gap-1 rounded-sm bg-panel-3/70 p-1"
          >
            <TabButton active={tab === "history"} onClick={() => setTab("history")}>
              Historique
            </TabButton>
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
              Statistiques
            </TabButton>
          </div>
          <p className="num text-micro tracking-[0.1em] text-ink-4">
            {entry.player.gameName}#{entry.player.tagLine} ·{" "}
            {entry.player.region} · NIVEAU {entry.player.summonerLevel}
          </p>
        </div>

        {tab === "history" ? (
          <HistoryTab entry={entry} now={now} />
        ) : (
          <StatsTab entry={entry} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      className={cn(
        "rounded-xs px-3 py-1.5 text-[0.75rem] font-medium transition-colors duration-150",
        active ? "bg-acid text-acid-ink" : "text-ink-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/* ── Historique ───────────────────────────────────────────────────────────── */

function HistoryTab({ entry, now }: { entry: RankingEntry; now: number }) {
  if (entry.recentGames.length === 0)
    return (
      <p className="rounded-sm border border-hair bg-panel-2 px-4 py-6 text-center text-[0.8125rem] text-ink-3">
        Aucune partie enregistrée pour l&apos;instant.
      </p>
    );

  return (
    <ul className="flex flex-col gap-1.5">
      {entry.recentGames.map((game) => (
        <li
          key={game.id}
          className={cn(
            "flex items-center gap-3 rounded-sm border-l-2 bg-panel-2/70 py-2 pr-3 pl-2.5",
            game.win ? "border-l-acid/70" : "border-l-blaze/70",
          )}
        >
          <ChampionIcon
            championId={game.championId}
            championName={game.championName}
            size={32}
            className="rounded-sm"
          />

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-ink">
              {game.championName}
              <RoleIcon role={game.role} size={12} title={false} />
            </p>
            <p className="num mt-1 text-[0.625rem] tracking-[0.06em] text-ink-4">
              {shortDate(game.endedAt)} · {relativeTime(game.endedAt, now)} ·{" "}
              {duration(game.durationSec)}
            </p>
          </div>

          <div className="hidden text-right sm:block">
            <p className="num text-[0.8125rem] font-semibold text-ink tabular-nums">
              {game.kills}
              <span className="text-ink-4">/</span>
              <span className="text-blaze">{game.deaths}</span>
              <span className="text-ink-4">/</span>
              {game.assists}
            </p>
            <p className="num mt-1 text-[0.625rem] text-ink-4 tabular-nums">
              {kdaLabel(
                game.deaths === 0
                  ? game.kills + game.assists
                  : (game.kills + game.assists) / game.deaths,
              )}{" "}
              KDA
            </p>
          </div>

          <div className="hidden w-20 text-right lg:block">
            <p className="num text-[0.75rem] text-ink-2 tabular-nums">
              {game.cs} CS
            </p>
            <p className="num mt-1 text-[0.625rem] text-ink-4 tabular-nums">
              vision {game.visionScore}
            </p>
          </div>

          <div className="w-[74px] shrink-0 text-right">
            {game.lpDelta === null ? (
              <span
                className="num text-num text-ink-4"
                title="Gain de LP inconnu : la partie est antérieure au premier relevé"
              >
                — LP
              </span>
            ) : (
              <Delta value={game.lpDelta} />
            )}
            <p
              className={cn(
                "num mt-1 text-[0.5625rem] font-semibold tracking-[0.14em]",
                game.win ? "text-acid/70" : "text-blaze",
              )}
            >
              {game.win ? "VICTOIRE" : "DÉFAITE"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Statistiques ─────────────────────────────────────────────────────────── */

function StatsTab({ entry }: { entry: RankingEntry }) {
  const avg = lpAverages(entry);
  const peak = rankFromAbsoluteLp(entry.peakAbsoluteLp);
  const cs = entry.recentGames.reduce(
    (a, g) => a + g.cs / (g.durationSec / 60),
    0,
  );
  const vision = entry.recentGames.reduce((a, g) => a + g.visionScore, 0);
  const n = Math.max(1, entry.recentGames.length);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-hair bg-hair sm:grid-cols-4">
          <Tile label="KDA moyen" value={kdaLabel(entry.kda)} />
          <Tile label="CS / min" value={(cs / n).toFixed(1)} />
          <Tile label="Vision moy." value={(vision / n).toFixed(0)} />
          <Tile label="Parties classées" value={thousands(entry.games)} />
          <Tile label="Gain moyen" value={`${signed(avg.win)} LP`} tone="up" />
          <Tile label="Perte moyenne" value={`${avg.loss} LP`} tone="down" />
          <Tile label="Pic de la saison" value={rankLabel(peak)} />
          <Tile label="Poste principal" value={roleLabel(entry.player.mainRole)} />
        </div>

        <div className="mt-4 rounded-sm border border-hair bg-panel-2 p-4">
          <div className="flex items-baseline justify-between">
            <span className="label">Évolution des LP</span>
            <span className="num text-[0.6875rem] text-ink-4 tabular-nums">
              {entry.lpHistory.length} derniers relevés
            </span>
          </div>
          <div className="mt-3">
            <Sparkline
              values={entry.lpHistory}
              width={640}
              height={92}
              strokeWidth={2}
              className="h-[92px] w-full"
            />
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-hair bg-panel-2 p-4">
        <span className="label">Champions de la fenêtre</span>
        <ul className="mt-3 flex flex-col gap-2.5">
          {entry.champions.map((c) => {
            const wr = Math.round((c.wins / c.games) * 100);
            return (
              <li key={c.championId} className="flex items-center gap-3">
                <ChampionIcon
                  championId={c.championId}
                  championName={c.championName}
                  size={30}
                  className="rounded-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-ink">
                    {c.championName}
                  </p>
                  <p className="num mt-0.5 text-[0.625rem] text-ink-4 tabular-nums">
                    {c.games} parties · KDA {kdaLabel(c.kda)}
                  </p>
                </div>
                <span
                  className={cn(
                    "num text-[0.8125rem] font-semibold tabular-nums",
                    wr >= 50 ? "text-acid" : "text-blaze",
                  )}
                >
                  {wr}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="bg-panel-2 px-3 py-3">
      <p className="label text-[0.5625rem]">{label}</p>
      <p
        className={cn(
          "num mt-2 text-[0.9375rem] font-semibold tabular-nums",
          tone === "up" ? "text-acid" : tone === "down" ? "text-blaze" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
