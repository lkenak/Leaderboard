import { cn } from "@/lib/cn";
import { rankLabel } from "@/lib/lol";
import { kdaLabel, thousands } from "@/lib/format";
import type { RankingEntry } from "@/lib/types";
import { PositionBadge } from "@/components/ui/PositionBadge";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { ChampionIcon } from "@/components/ui/ChampionIcon";
import { Delta } from "@/components/ui/Delta";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";

/**
 * Podium — visible à partir de `md`. La hiérarchie entre les cartes n'est pas
 * donnée par trois couleurs de médaille mais par deux moyens cumulés :
 *
 * - la **largeur du filet acide** en pied de carte — 100 %, 62 %, 38 % ;
 * - la **place occupée** — à partir de `lg`, la 1re carte prend deux colonnes
 *   sur quatre. Trois cartes de taille égale mettent les trois joueurs au même
 *   rang visuel, ce qui est précisément ce qu'un podium doit démentir.
 *
 * Une seule teinte, deux dimensions de hiérarchie, lisible en niveaux de gris.
 *
 * Il affichait `null` en dessous de trois joueurs : un plateau de deux comptes
 * n'avait donc pas de podium du tout, sans que rien ne l'explique. Il montre
 * maintenant ce qu'il a — la grille s'adapte au nombre réel de cartes.
 */
export function Podium({ entries }: { entries: RankingEntry[] }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;
  const RAIL = ["100%", "62%", "38%"];

  /* Une seule carte n'a pas besoin de la moitié de la page : la grille ne
     s'étire qu'à partir de deux, et l'asymétrie 2/1/1 ne vaut qu'à trois. */
  const cols =
    top.length === 3
      ? "md:grid-cols-3 lg:grid-cols-4"
      : top.length === 2
        ? "md:grid-cols-2"
        : "md:grid-cols-1 md:max-w-sm";

  return (
    <div className={cn("hidden gap-4 md:grid", cols)}>
      {top.map((entry, i) => (
        <article
          key={entry.player.puuid}
          className={cn(
            "grain group relative overflow-hidden rounded-lg border bg-panel transition-[border-color,transform] duration-300 hover:-translate-y-[2px]",
            i === 0
              ? "border-acid/35 hover:border-acid/60"
              : "border-hair hover:border-hair-2",
            // La 1re place prend deux colonnes sur les quatre disponibles à
            // partir de `lg` : c'est la hiérarchie par la taille annoncée plus
            // haut. En dessous, la grille est à trois colonnes égales.
            top.length === 3 && i === 0 && "lg:col-span-2",
          )}
        >
          <span className="grain-layer" />
          {/* Filigrane de palier. C'était le PNG `/lol/emblems/*.png` : une
              image 16:9 (1280×720, parfois 2560×1440) posée dans une boîte
              carrée sans `object-fit`, donc écrasée en largeur — et dont
              l'emblème utile n'occupe que ~22 % du canevas, le reste étant du
              vide. Résultat : un emblème à la fois serré et minuscule.

              Le crest SVG porte le même visuel avec un viewBox serré, et un
              SVG dans une image préserve son ratio par défaut
              (`preserveAspectRatio`), donc il ne peut pas se déformer quelle
              que soit la boîte. 4 Ko contre 225 Ko, et net à toute taille. */}
          <Crest
            tier={entry.rank.tier}
            size={i === 0 ? 260 : 220}
            className="pointer-events-none absolute -top-8 -right-10 opacity-[0.19]"
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
                  {entry.player.team ? ` · ${entry.player.team.name}` : ""}
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
