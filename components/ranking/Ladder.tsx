"use client";

import { useMemo, useState } from "react";
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
import { PageHeader } from "./PageHeader";
import { Podium } from "./Podium";
import { Toolbar, type ToolbarState } from "./Toolbar";
import { LadderHead, type RecordMode } from "./LadderHead";
import { LadderRow } from "./LadderRow";
import { RowDetail } from "./RowDetail";

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
  banner,
  demo = false,
}: {
  snapshots: Record<string, RankingSnapshot>;
  serverNow: number;
  /** Bandeau d'état rendu côté serveur (clé absente, plateau vide, erreurs). */
  banner?: React.ReactNode;
  /** `true` quand les chiffres viennent du jeu de démonstration. */
  demo?: boolean;
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
      {banner}

      <PageHeader snapshot={snapshot} now={now} serverNow={serverNow} />

      {/* Le ruban défilant qui ouvrait la page est parti : il bouclait sans fin
          (cadran MOTION = 1), était `aria-hidden`, et répétait des mouvements
          du jour que la colonne « 24 h » et le bandeau de faits donnent déjà
          triés et lisibles. Le chapeau de section qui suivait est parti aussi :
          son titre « Classement » redisait l'intitulé du H1, et son « dernier
          relevé » était le troisième affichage de la même minute. */}
      <section className="shell mt-14" aria-label="Classement">
        <Reveal>
          <h2 className="sr-only">Trois premières places</h2>
          <Podium entries={snapshot.entries} />
        </Reveal>

        <Reveal delay={60} y={22}>
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

            {/* Le filet supérieur portait un balayage acide en boucle infinie,
                censé « signaler une donnée qui se rafraîchit » — mais il
                tournait aussi quand rien ne se rafraîchissait, y compris en
                mode démonstration où rien ne se rafraîchira jamais. Le libellé
                « Relevé · il y a 3 min » de l'en-tête porte l'information, en
                plus précis (DESIGN.md § 6). */}
            {/* Le conteneur se déclarait `role="table"`, mais aucune cellule ne
                portait `role="cell"` et le panneau de détail — deux onglets, un
                tableau d'historique — ne peut pas tenir dans une cellule : la
                table ARIA était annoncée sans jamais en être une. Ce qui est
                réellement rendu ici est une liste de lignes dépliables, donc
                c'est ce qu'on déclare — et le `role="list"` n'enveloppe que les
                lignes, puisqu'une liste ne peut contenir que des `listitem`
                (ni l'en-tête de tri, ni un état vide). Chaque ligne s'annonce
                par un résumé complet plutôt que par douze cellules orphelines. */}
            <div className="mt-5 rounded-md border border-hair bg-panel">
              <LadderHead
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                recordMode={recordMode}
                onRecordMode={setRecordMode}
              />

              {snapshot.entries.length === 0 ? (
                /* Sélection vide : pas de filtre à réinitialiser, le problème
                   est en amont — aucun compte classé ici pour l'instant. */
                <p className="px-4 py-16 text-center text-[0.875rem] text-ink-3">
                  Aucun joueur classé dans cette sélection pour l&apos;instant.
                </p>
              ) : visible.length === 0 ? (
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
                <div
                  role="list"
                  aria-label={`Classement SoloQ, ${visible.length} joueur${visible.length > 1 ? "s" : ""}`}
                >
                  {visible.map((entry, i) => (
                  <div role="listitem" key={entry.player.puuid}>
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
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-[0.75rem] text-ink-4">
              Cliquez une ligne pour ouvrir l&apos;historique des parties. Les
              places et les variations sont recalculées à chaque relevé
              {demo
                ? " ; les chiffres affichés ici sont fictifs, aucun compte n'est encore suivi."
                : ", à partir des rangs relevés sur l'API Riot."}
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}
