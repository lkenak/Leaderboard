import Image from "next/image";
import { cn } from "@/lib/cn";
import { emblemSrc, rankLabel } from "@/lib/lol";
import { kdaLabel, thousands } from "@/lib/format";
import type { RankingEntry } from "@/lib/types";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { Delta } from "@/components/ui/Delta";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Podium — visible à partir de `md`. La hiérarchie entre les trois cartes n'est
 * pas donnée par trois couleurs de médaille mais par la **largeur du filet
 * acide** en pied de carte : 100 %, 62 %, 38 %. Une seule teinte, trois
 * intensités de présence, lisible même en niveaux de gris.
 */
export function Podium({ entries }: { entries: RankingEntry[] }) {
  const top = entries.slice(0, 3);
  if (top.length < 3) return null;
  const RAIL = ["100%", "62%", "38%"];

  return (
    <div className="hidden gap-4 md:grid md:grid-cols-3">
      {top.map((entry, i) => (
        <article
          key={entry.player.puuid}
          className={cn(
            "grain group relative overflow-hidden rounded-lg border bg-panel transition-[border-color,transform] duration-300 hover:-translate-y-[2px]",
            i === 0
              ? "border-acid/35 hover:border-acid/60"
              : "border-hair hover:border-hair-2",
          )}
        >
          <span className="grain-layer" />
          <Image
            src={emblemSrc(entry.rank.tier)}
            alt=""
            width={300}
            height={300}
            aria-hidden
            className="pointer-events-none absolute -top-9 -right-11 size-[230px] opacity-[0.19] select-none"
          />

          <div className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <PositionBadge position={entry.position} />
              <RoleIcon role={entry.player.mainRole} size={18} />
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Avatar
                profileIconId={entry.player.profileIconId}
                name={entry.player.gameName}
                country={entry.player.country}
                size={44}
              />
              <div className="min-w-0">
                <p className="truncate text-[1.0625rem] leading-tight font-semibold text-ink">
                  {entry.player.gameName}
                </p>
                <p className="num mt-0.5 truncate text-[0.6875rem] text-ink-4">
                  #{entry.player.tagLine}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="num text-[2.75rem] leading-none font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {thousands(entry.rank.leaguePoints)}
              </span>
              <span className="num text-[1rem] font-medium text-ink-3">LP</span>
              <span className="ml-auto self-center">
                <Delta value={entry.session.lp} />
              </span>
            </div>
            <p className="mt-1.5 text-[0.75rem] text-ink-3">
              {rankLabel(entry.rank)}
            </p>

            <div className="mt-6 flex items-end justify-between gap-4">
              <div className="flex gap-6">
                <Stat
                  value={`${entry.rank.wins}V ${entry.rank.losses}D`}
                  label={`${entry.games} parties`}
                />
                <Stat value={`${entry.winrate}%`} label="Winrate" />
                <Stat value={kdaLabel(entry.kda)} label="KDA" />
              </div>
              <div className="flex items-center gap-1.5">
                {entry.champions.map((c) => (
                  <ChampionIcon
                    key={c.championId}
                    championId={c.championId}
                    championName={`${c.championName} · ${c.games} parties`}
                    size={26}
                    className="rounded-sm"
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 h-[3px] bg-acid" style={{ width: RAIL[i] }} />
          </div>
        </article>
      ))}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="num text-[0.75rem] font-semibold text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-[0.625rem] text-ink-4">{label}</p>
    </div>
  );
}
