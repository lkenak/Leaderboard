"use client";

import { cn } from "@/lib/cn";
import type { SortDir, SortKey } from "@/lib/ranking";
import { SortCaret } from "@/components/ui/SortCaret";

export type RecordMode = "record" | "net" | "games";

const RECORD_LABEL: Record<RecordMode, string> = {
  record: "V / D",
  net: "Net",
  games: "Parties",
};

const RECORD_NEXT: Record<RecordMode, RecordMode> = {
  record: "net",
  net: "games",
  games: "record",
};

const RECORD_SORT: Record<RecordMode, SortKey> = {
  record: "winrate",
  net: "net",
  games: "games",
};

const RECORD_TITLE: Record<RecordMode, string> = {
  record: "Passer au différentiel (V − D)",
  net: "Passer au nombre de parties",
  games: "Revenir au détail victoires / défaites",
};

/**
 * Ligne d'en-tête du classement. Elle partage exactement la grille des lignes
 * (`ladder-row`), donc les libellés restent alignés sur les cellules à toutes
 * les largeurs, sans duplication des valeurs de colonnes.
 */
export function LadderHead({
  sortKey,
  sortDir,
  onSort,
  recordMode,
  onRecordMode,
}: {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  recordMode: RecordMode;
  onRecordMode: (mode: RecordMode) => void;
}) {
  const head = (key: SortKey, label: string, title?: string) => (
    <button
      type="button"
      onClick={() => onSort(key)}
      title={title}
      className={cn(
        "label inline-flex items-center transition-colors duration-150 hover:text-ink-2",
        sortKey === key && "text-ink",
      )}
    >
      {label}
      <SortCaret active={sortKey === key} dir={sortDir} />
    </button>
  );

  return (
    /* Ce n'est pas une ligne de tableau — le classement est déclaré comme une
       liste (voir Ladder.tsx) — mais un jeu de commandes de tri qui sert aussi
       de repère visuel de colonnes. Donc un groupe nommé : les boutons restent
       annoncés, la barre ne se fait plus passer pour une `row`. */
    <div
      role="group"
      aria-label="Trier le classement"
      className="ladder-row sticky top-16 z-20 hidden border-b border-hair-2 bg-panel/95 px-4 py-3 md:grid supports-[backdrop-filter]:bg-panel/85 supports-[backdrop-filter]:backdrop-blur-sm"
    >
      <span className="flex justify-center">{head("position", "#")}</span>
      <span className="flex justify-start">{head("name", "Joueur")}</span>
      <span className="col-role justify-center">{head("role", "Rôle")}</span>
      <span className="flex justify-center">{head("elo", "Palier")}</span>

      {/* Le bilan a deux commandes : le mode d'affichage et le tri. */}
      <span className="col-record items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onRecordMode(RECORD_NEXT[recordMode])}
          title={RECORD_TITLE[recordMode]}
          className="label inline-flex items-center gap-1 rounded-xs border border-hair px-1.5 py-1 transition-colors duration-150 hover:border-acid/40 hover:text-acid"
        >
          {RECORD_LABEL[recordMode]}
          <svg width="9" height="7" viewBox="0 0 9 7" aria-hidden className="opacity-50">
            <path
              d="M3 0.5 0.5 3 3 5.5M0.5 3H8M6 6.5 8.5 4 6 1.5"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onSort(RECORD_SORT[recordMode])}
          aria-label="Trier par bilan"
          className="inline-flex"
        >
          <SortCaret
            active={sortKey === RECORD_SORT[recordMode]}
            dir={sortDir}
          />
        </button>
      </span>

      <span className="flex justify-center">
        {head("session", "24 h", "LP nets et bilan des 24 dernières heures")}
      </span>
      <span className="col-form justify-center">
        <span className="label" title="Forme sur les 7 dernières parties">
          Forme
        </span>
      </span>
      <span className="col-lp justify-center">
        {head("lp", "±LP", "LP moyens gagnés par victoire et perdus par défaite")}
      </span>
      <span className="col-kda justify-center">{head("kda", "KDA")}</span>
      <span className="col-champs justify-center">
        <span className="label">Champions</span>
      </span>
      <span className="col-curve justify-center">
        <span className="label" title="LP sur les 26 dernières parties">
          Courbe
        </span>
      </span>
      <span className="flex justify-center">
        <span className="label">Profil</span>
      </span>
    </div>
  );
}
