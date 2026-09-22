import { cn } from "@/lib/cn";
import { kdaLabel, thousands } from "@/lib/format";
import { ROLES, type MatchDetail, type MatchParticipantDetail } from "@/lib/types";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { ItemIcon } from "@/components/ui/ItemIcon";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { RuneIcon } from "@/components/ui/RuneIcon";
import { SummonerSpellIcon } from "@/components/ui/SummonerSpellIcon";

/** Scoreboard des 10 joueurs d'une partie, façon op.gg : deux équipes de 5,
 *  triées par poste, build/runes/sorts et une barre de dégâts comparative. */
export function Scoreboard({ detail }: { detail: MatchDetail }) {
  const byRole = (a: MatchParticipantDetail, b: MatchParticipantDetail) =>
    ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
  const blue = detail.participants.filter((p) => p.teamId === 100).sort(byRole);
  const red = detail.participants.filter((p) => p.teamId === 200).sort(byRole);
  const maxDamage = Math.max(1, ...detail.participants.map((p) => p.damageDealt));

  return (
    <div className="flex flex-col gap-4">
      <Team label="Équipe bleue" players={blue} maxDamage={maxDamage} />
      <Team label="Équipe rouge" players={red} maxDamage={maxDamage} />
    </div>
  );
}

function Team({
  label,
  players,
  maxDamage,
}: {
  label: string;
  players: MatchParticipantDetail[];
  maxDamage: number;
}) {
  const win = players[0]?.win ?? false;

  return (
    <div className="overflow-hidden rounded-sm border border-hair">
      <div
        className={cn(
          "flex items-center justify-between border-l-2 bg-panel-2 px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-3",
          win ? "border-l-acid/70" : "border-l-blaze/70",
        )}
      >
        <span>{label}</span>
        <span className={win ? "text-acid/80" : "text-blaze"}>
          {win ? "Victoire" : "Défaite"}
        </span>
      </div>
      <ul className="flex flex-col">
        {players.map((p) => (
          <PlayerRow key={p.participantId} player={p} maxDamage={maxDamage} />
        ))}
      </ul>
    </div>
  );
}

function PlayerRow({
  player,
  maxDamage,
}: {
  player: MatchParticipantDetail;
  maxDamage: number;
}) {
  const keystone = player.runes.selections[0];

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-hair bg-panel-2/50 px-3 py-2.5 first:border-t-0">
      <div className="relative shrink-0">
        <ChampionIcon championId={player.championId} championName={player.championName} size={36} />
        <span className="num absolute -right-1 -bottom-1 rounded-xs bg-panel-4 px-1 text-[0.5625rem] font-semibold text-ink-2 ring-1 ring-hair">
          {player.champLevel}
        </span>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <SummonerSpellIcon id={player.summoner1Id} size={17} />
        <SummonerSpellIcon id={player.summoner2Id} size={17} />
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        {keystone !== undefined && <RuneIcon id={keystone} size={17} round />}
        <RuneIcon id={player.runes.subStyle} size={17} />
      </div>

      <div className="min-w-[120px] flex-1">
        <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-medium text-ink">
          {player.championName}
          <RoleIcon role={player.role} size={11} title={false} />
        </p>
        <p className="truncate text-[0.6875rem] text-ink-4">
          {player.gameName}
          {player.tagLine && <span className="text-ink-4/70">#{player.tagLine}</span>}
        </p>
      </div>

      <div className="w-[76px] shrink-0 text-right">
        <p className="num text-[0.8125rem] font-semibold text-ink tabular-nums">
          {player.kills}
          <span className="text-ink-4">/</span>
          <span className="text-blaze">{player.deaths}</span>
          <span className="text-ink-4">/</span>
          {player.assists}
        </p>
        <p className="num mt-0.5 text-[0.625rem] text-ink-4 tabular-nums">
          {kdaLabel(
            player.deaths === 0
              ? player.kills + player.assists
              : (player.kills + player.assists) / player.deaths,
          )}{" "}
          KDA
        </p>
      </div>

      <div className="w-16 shrink-0 text-right">
        <p className="num text-[0.75rem] text-ink-2 tabular-nums">{player.cs} CS</p>
        <p className="num mt-0.5 text-[0.625rem] text-ink-4 tabular-nums">
          vision {player.visionScore}
        </p>
      </div>

      <div className="w-[168px] shrink-0">
        <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full rounded-full bg-ink-3/70"
            style={{ width: `${Math.max(2, (player.damageDealt / maxDamage) * 100)}%` }}
          />
        </div>
        <p className="num text-right text-[0.625rem] text-ink-4 tabular-nums">
          {thousands(player.damageDealt)} dégâts
        </p>
      </div>

      <div className="grid w-[172px] shrink-0 grid-cols-7 gap-0.5">
        {player.items.map((item, i) => (
          <ItemIcon key={i} id={item} size={22} />
        ))}
      </div>

      <p className="num w-14 shrink-0 text-right text-[0.75rem] font-medium text-t-gold tabular-nums">
        {thousands(player.goldEarned)}
      </p>
    </li>
  );
}
