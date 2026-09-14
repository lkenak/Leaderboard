"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { agoLabel } from "@/lib/format";
import {
  countryCounts,
  defaultDir,
  matchesFilters,
  reposition,
  sortEntries,
  type SortDir,
  type SortKey,
} from "@/lib/ranking";
import { findProvider } from "@/lib/providers";
import { useClock } from "@/lib/clock";
import { useStored } from "@/lib/use-stored";
import type { RankingSnapshot } from "@/lib/types";
import { Reveal } from "@/components/ui/Reveal";
import { Ticker } from "@/components/site/Ticker";
import { PageHeader } from "./PageHeader";
import { Podium } from "./Podium";
import { Toolbar, type ToolbarState } from "./Toolbar";
import { LadderHead, type RecordMode } from "./LadderHead";
import { LadderRow } from "./LadderRow";
import { RowDetail } from "./RowDetail";
import { CutoffWidget, Countdown } from "./Widgets";

const BRACKET_COLOR: Record<string, string> = {
  "high-elo": "var(--color-acid)",
  "low-elo": "var(--color-sky)",
};

/**
 * Orchestrateur du classement : tout l'état de la page vit ici, les composants
 * en dessous restent pilotés par leurs propriétés. Les deux sélections sont
 * calculées côté serveur et transmises ensemble, donc basculer de l'une à
 * l'autre ne déclenche aucune requête.
 */
export function Ladder({
  snapshots,
  serverNow,
}: {
  snapshots: Record<string, RankingSnapshot>;
  serverNow: number;
}) {
  /* — Horloge de page, au pas de la minute : elle ne sert qu'aux libellés
       « il y a … ». Les chronomètres de partie s'abonnent séparément à la
       seconde, pour ne pas re-rendre trente lignes chaque seconde. — */
  const now = useClock(60_000, serverNow);

  const [filters, setFilters] = useState<ToolbarState>({
    bracket: "high-elo",
    query: "",
    roles: [],
    country: null,
    inGameOnly: false,
    favouritesOnly: false,
  });
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [recordMode, setRecordMode] = useStored<RecordMode>(
    "ladder:record-mode",
    "record",
  );
  const [providerKey, setProviderKey] = useStored<string>(
    "ladder:provider",
    "opgg",
  );
  const [favourites, setFavourites] = useStored<string[]>("ladder:favourites", []);
  const provider = findProvider(providerKey);

  /* — La vue « Tous » fusionne les deux tableaux et renumérote. — */
  const snapshot = useMemo<RankingSnapshot>(() => {
    if (filters.bracket !== "all") return snapshots[filters.bracket];
    const base = snapshots["high-elo"];
    return {
      ...base,
      bracketId: "all",
      entries: reposition([
        ...snapshots["high-elo"].entries,
        ...snapshots["low-elo"].entries,
      ]),
    };
  }, [filters.bracket, snapshots]);

  const visible = useMemo(() => {
    const filtered = snapshot.entries.filter((e) =>
      matchesFilters(e, { ...filters, favourites }),
    );
    return sortEntries(filtered, sortKey, sortDir);
  }, [snapshot, filters, favourites, sortKey, sortDir]);

  const countries = useMemo(
    () => countryCounts(snapshot.entries),
    [snapshot],
  );
  const inGameCount = snapshot.entries.filter((e) => e.live).length;
  const favouriteCount = snapshot.entries.filter((e) =>
    favourites.includes(e.player.puuid),
  ).length;

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDir(key));
    }
  };

  const toggleFavourite = (puuid: string) =>
    setFavourites(
      favourites.includes(puuid)
        ? favourites.filter((p) => p !== puuid)
        : [...favourites, puuid],
    );

  return (
    <>
      <Ticker entries={snapshot.entries} />

      <PageHeader snapshot={snapshot} now={now} />

      <section className="shell mt-14">
        {/* — Chapeau de section : titre, relevé, coupe apex, compte à rebours — */}
        <Reveal>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end gap-4">
              <h2 className="text-[2.5rem] leading-[0.95] font-bold tracking-[-0.03em] text-ink md:text-[3.5rem]">
                Classement
              </h2>
              <p className="mb-2 hidden text-[0.8125rem] text-ink-3 md:block">
                <span className="font-medium text-acid">Dernier relevé&nbsp;:</span>{" "}
                {agoLabel(snapshot.updatedAt, now)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="hidden lg:block">
                <CutoffWidget
                  challenger={snapshot.cutoff.challenger}
                  grandmaster={snapshot.cutoff.grandmaster}
                />
              </span>
              <Countdown endsAt={snapshot.splitEndsAt} serverNow={serverNow} />
            </div>
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-3 md:hidden">
            <span className="font-medium text-acid">Dernier relevé&nbsp;:</span>{" "}
            {agoLabel(snapshot.updatedAt, now)}
          </p>
        </Reveal>

        <Reveal delay={60} y={22}>
          <div className="mt-8">
            <Podium entries={snapshot.entries} />
          </div>
        </Reveal>

        <Reveal delay={100} y={26}>
          <div className="mt-12 scroll-mt-24" id="tableau">
            <Toolbar
              state={filters}
              onChange={(next) => {
                setFilters((f) => ({ ...f, ...next }));
                setExpanded(null);
              }}
              countries={countries}
              total={snapshot.entries.length}
              shown={visible.length}
              favouriteCount={favouriteCount}
              inGameCount={inGameCount}
              provider={provider}
              onProviderChange={setProviderKey}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />

            <div
              role="table"
              aria-label="Classement SoloQ"
              className="mt-5 rounded-md border border-hair bg-panel"
            >
              {/* Filet supérieur balayé : signale une donnée qui se rafraîchit,
                  sans occuper la place d'un indicateur de chargement. */}
              <div className="relative h-px overflow-hidden rounded-t-md bg-hair">
                <span className="animate-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-acid/70 to-transparent" />
              </div>

              <LadderHead
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                recordMode={recordMode}
                onRecordMode={setRecordMode}
              />

              {visible.length === 0 ? (
                <div className="flex flex-col items-center gap-4 px-4 py-16">
                  <p className="text-[0.875rem] text-ink-3">
                    Aucun joueur ne correspond à ce filtre.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((f) => ({
                        ...f,
                        query: "",
                        roles: [],
                        country: null,
                        inGameOnly: false,
                        favouritesOnly: false,
                      }))
                    }
                    className="num rounded-sm border border-hair px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                visible.map((entry, i) => (
                  <div key={entry.player.puuid}>
                    <LadderRow
                      entry={entry}
                      showBracketRail={filters.bracket === "all"}
                      bracketColor={BRACKET_COLOR[entry.bracket]}
                      recordMode={recordMode}
                      provider={provider}
                      favourite={favourites.includes(entry.player.puuid)}
                      onToggleFavourite={() => toggleFavourite(entry.player.puuid)}
                      expanded={expanded === entry.player.puuid}
                      onToggle={() =>
                        setExpanded((cur) =>
                          cur === entry.player.puuid ? null : entry.player.puuid,
                        )
                      }
                      last={i === visible.length - 1}
                      now={now}
                    />
                    {expanded === entry.player.puuid && (
                      <RowDetail entry={entry} now={now} />
                    )}
                  </div>
                ))
              )}
            </div>

            <p className={cn("mt-4 text-[0.75rem] text-ink-4")}>
              Cliquez une ligne pour ouvrir l&apos;historique des parties. Les
              places et les variations sont recalculées à chaque relevé ; les
              données affichées ici sont fictives en attendant le branchement sur
              l&apos;API Riot.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
