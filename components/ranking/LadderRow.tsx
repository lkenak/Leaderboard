"use client";

import { cn } from "@/lib/cn";
import { rankLabel } from "@/lib/lol";
import { relativeTime, signed, winratePct } from "@/lib/format";
import { lpAverages } from "@/lib/ranking";
import type { RankingEntry } from "@/lib/types";
import type { StatsProvider } from "@/lib/providers";
import { PositionBadge, PositionDelta } from "@/components/ui/PositionBadge";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { FormStrip } from "@/components/ui/FormStrip";
import { Sparkline } from "@/components/ui/Sparkline";
import { Avatar } from "@/components/ui/Avatar";
import { StreamLink } from "@/components/ui/StreamLink";
import { Delta } from "@/components/ui/Delta";
import { StarGlyph } from "./Toolbar";
import {
  EloCell,
  KdaCell,
  LpAverageCell,
  ProviderChip,
  RecordCell,
  SessionCell,
} from "./cells";
import type { RecordMode } from "./LadderHead";

export function LadderRow({
  entry,
  showBracketRail,
  bracketColor,
  recordMode,
  provider,
  favourite,
  onToggleFavourite,
  expanded,
  onToggle,
  last,
  now,
}: {
  entry: RankingEntry;
  showBracketRail: boolean;
  bracketColor: string;
  recordMode: RecordMode;
  provider: StatsProvider;
  favourite: boolean;
  onToggleFavourite: () => void;
  expanded: boolean;
  onToggle: () => void;
  /** Dernière ligne : on retire son filet pour ne pas doubler celui du cadre. */
  last?: boolean;
  now: number;
}) {
  const { player, rank } = entry;
  const averages = lpAverages(entry);

  /* Résumé vocal de la ligne. Un lecteur d'écran qui balaye un classement veut
     la ligne d'un coup — « 3e, Nom, Diamant II, 1240 LP, +18 LP sur 24 h » —
     et non douze cellules à recoller. Le détail complet reste dans le panneau
     dépliable, que `aria-expanded` annonce. */
  const summary = [
    `${entry.position}e`,
    `${player.gameName} #${player.tagLine}`,
    rankLabel(rank),
    `${rank.leaguePoints} LP`,
    entry.session.games > 0 && entry.session.lp !== null
      ? `${signed(entry.session.lp)} LP sur 24 heures`
      : "aucune partie depuis 24 heures",
    `${entry.winrate}% de victoires sur ${entry.games} parties`,
    entry.live ? `en partie sur ${entry.live.championName}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  /* Les deux rendus ci-dessous sont le même contenu à deux largeurs : celui
     qui n'est pas affiché est en `display: none`, donc un seul est focusable à
     la fois. Ils portent le même contrat d'accessibilité — `role="button"`,
     `aria-expanded`, `aria-label` — parce que la vue en fiches ouvrait le même
     panneau sans jamais annoncer qu'elle était dépliable. */
  const rowA11y = {
    role: "button" as const,
    tabIndex: 0,
    "aria-expanded": expanded,
    "aria-label": summary,
    onClick: onToggle,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
  };

  const identity = (liveBadge: boolean) => (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite();
        }}
        aria-pressed={favourite}
        title={
          favourite
            ? `Retirer ${player.gameName} des favoris`
            : `Ajouter ${player.gameName} aux favoris`
        }
        className={cn(
          // 28 px au doigt, 20 px à la souris : la cible tactile ne doit pas
          // descendre sous 24 px, mais elle n'a pas à écarter les colonnes.
          "grid size-7 shrink-0 place-items-center rounded-xs transition-transform duration-150 hover:scale-115 md:size-5",
          favourite ? "text-acid" : "text-ink-3 hover:text-ink-2",
        )}
      >
        <StarGlyph filled={favourite} />
      </button>

      <Avatar
        profileIconId={player.profileIconId}
        name={player.gameName}
        country={player.country}
        size={34}
        live={entry.live !== null}
      />

      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-name font-semibold text-ink">
            {player.gameName}
          </span>
          {liveBadge && entry.live && (
            <span
              className="num shrink-0 rounded-[2px] bg-acid/18 px-1.5 py-px text-[0.5625rem] font-semibold tracking-[0.08em] text-acid"
              title={`En partie sur ${entry.live.championName}`}
            >
              EN JEU
            </span>
          )}
          {player.streamer && (
            <StreamLink streamer={player.streamer} className="-my-1" />
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <span className="num truncate text-[0.6875rem] text-ink-4">
            #{player.tagLine}
          </span>
          {player.team && (
            <span
              className="num shrink-0 rounded-[2px] bg-panel-3 px-1 py-px text-[0.5625rem] font-medium tracking-[0.06em] text-ink-3"
              title={player.team.name}
            >
              {player.team.tag}
            </span>
          )}
          {entry.lastGameAt !== null && (
            <span
              className="num shrink-0 text-[0.625rem] text-ink-4"
              title="Dernière partie classée"
            >
              {relativeTime(entry.lastGameAt, now)}
            </span>
          )}
        </span>
      </span>
    </>
  );

  return (
    <>
      {/* ── Desktop : la grille à douze colonnes ── */}
      <div
        {...rowA11y}
        className={cn(
          "ladder-row hidden cursor-pointer border-b border-hair px-4 py-2.5 transition-colors duration-150 md:grid",
          last && !expanded && "border-b-0",
          expanded ? "bg-panel-2" : "hover:bg-panel-2/60",
        )}
        style={
          showBracketRail
            ? { boxShadow: `inset 3px 0 0 ${bracketColor}` }
            : undefined
        }
      >
        <span className="flex items-center justify-center gap-1">
          <PositionBadge position={entry.position} />
          <PositionDelta delta={entry.positionDelta} />
        </span>

        <span className="flex min-w-0 items-center gap-2.5">{identity(false)}</span>

        <span className="col-role justify-center">
          <RoleIcon role={player.mainRole} size={18} />
        </span>

        <span className="flex justify-center">
          <EloCell rank={rank} />
        </span>

        <span className="col-record justify-center px-1">
          <RecordCell entry={entry} mode={recordMode} />
        </span>

        <span className="flex justify-center">
          <SessionCell entry={entry} />
        </span>

        <span className="col-form justify-center">
          <FormStrip form={entry.form} />
        </span>

        <span className="col-lp justify-center">
          <LpAverageCell averages={averages} />
        </span>

        <span className="col-kda justify-center">
          <KdaCell value={entry.kda} />
        </span>

        <span className="col-champs items-center justify-center gap-1">
          {entry.champions.map((c) => (
            <ChampionIcon
              key={c.championId}
              championId={c.championId}
              championName={`${c.championName} · ${c.games} parties · ${winratePct(c.wins, c.games - c.wins)}%`}
              size={24}
            />
          ))}
        </span>

        <span className="col-curve justify-center">
          <Sparkline values={entry.lpHistory} width={84} height={26} />
        </span>

        <span className="flex justify-center">
          <ProviderChip entry={entry} provider={provider} serverNow={now} />
        </span>
      </div>

      {/* ── Mobile : la même ligne devient une fiche ── */}
      <div
        {...rowA11y}
        className={cn(
          "flex cursor-pointer flex-col gap-3 border-b border-hair px-3.5 py-3.5 transition-colors duration-150 md:hidden",
          last && !expanded && "border-b-0",
          expanded ? "bg-panel-2" : "active:bg-panel-2/60",
        )}
        style={
          showBracketRail
            ? { boxShadow: `inset 3px 0 0 ${bracketColor}` }
            : undefined
        }
      >
        <div className="flex items-center gap-2.5">
          <span className="flex shrink-0 flex-col items-center gap-1">
            <PositionBadge position={entry.position} />
            <PositionDelta delta={entry.positionDelta} />
          </span>
          {identity(true)}
          <span className="ml-auto shrink-0">
            <ProviderChip entry={entry} provider={provider} serverNow={now} />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pl-1">
          <span className="flex items-center gap-2">
            <RoleIcon role={player.mainRole} size={15} />
            <span className="text-[0.75rem] text-ink-2">{rankLabel(rank)}</span>
            <span className="num text-[0.75rem] font-semibold text-ink tabular-nums">
              {rank.leaguePoints} LP
            </span>
          </span>
          <span className="flex items-center gap-3">
            <FormStrip form={entry.form} />
            {entry.session.games > 0 ? (
              <Delta value={entry.session.lp} />
            ) : (
              <span className="num text-[0.6875rem] text-ink-4">—</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 pl-1">
          <span className="num w-10 shrink-0 text-[0.75rem] font-medium text-ink-2 tabular-nums">
            {entry.winrate}%
          </span>
          <span className="flex h-[5px] flex-1 gap-[2px]">
            <span
              className="h-full rounded-[1px] bg-acid/85"
              style={{
                width: `${(rank.wins / Math.max(1, rank.wins + rank.losses)) * 100}%`,
              }}
            />
            <span className="h-full flex-1 rounded-[1px] bg-blaze/55" />
          </span>
          <span className="num shrink-0 text-[0.625rem] text-ink-4 tabular-nums">
            {rank.wins}V·{rank.losses}D
          </span>
        </div>
      </div>
    </>
  );
}
