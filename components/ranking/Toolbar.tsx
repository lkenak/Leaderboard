"use client";

import { ROLES, type Role } from "@/lib/types";
import { roleLabel } from "@/lib/lol";
import { PROVIDERS, type StatsProvider } from "@/lib/providers";
import { cn } from "@/lib/cn";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { Flag, countryName } from "@/components/ui/Flag";
import { Popover, PopoverItem } from "@/components/ui/Popover";
import { LiveDot } from "@/components/ui/LiveDot";
import type { SortDir, SortKey } from "@/lib/ranking";

/** Le tri par en-tête n'existe pas dans la vue en fiches : il lui faut sa
 *  propre commande, sinon le classement n'est triable que sur grand écran. */
const MOBILE_SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "position", label: "Place" },
  { key: "elo", label: "LP" },
  { key: "session", label: "Variation 24 h" },
  { key: "winrate", label: "Winrate" },
  { key: "games", label: "Parties" },
  { key: "kda", label: "KDA" },
  { key: "name", label: "Nom" },
];

export type Bracket = "all" | "high-elo" | "low-elo";

const BRACKETS: Array<{ key: Bracket; label: string; accent: string }> = [
  { key: "all", label: "Tous", accent: "var(--color-ink)" },
  { key: "high-elo", label: "High elo", accent: "var(--color-acid)" },
  { key: "low-elo", label: "Low elo", accent: "var(--color-sky)" },
];

export interface ToolbarState {
  bracket: Bracket;
  query: string;
  roles: Role[];
  country: string | null;
  inGameOnly: boolean;
  favouritesOnly: boolean;
}

export function Toolbar({
  state,
  onChange,
  countries,
  total,
  shown,
  favouriteCount,
  inGameCount,
  provider,
  onProviderChange,
  sortKey,
  sortDir,
  onSort,
}: {
  state: ToolbarState;
  onChange: (next: Partial<ToolbarState>) => void;
  countries: Array<{ code: string; count: number }>;
  total: number;
  shown: number;
  favouriteCount: number;
  inGameCount: number;
  provider: StatsProvider;
  onProviderChange: (key: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const toggleRole = (role: Role) =>
    onChange({
      roles: state.roles.includes(role)
        ? state.roles.filter((r) => r !== role)
        : [...state.roles, role],
    });

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      {/* ── Groupe de gauche : la sélection et la recherche ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="tablist"
          aria-label="Sélection"
          className="inline-flex items-stretch gap-1"
        >
          {BRACKETS.map((b) => {
            const active = state.bracket === b.key;
            return (
              <button
                key={b.key}
                role="tab"
                aria-selected={active}
                onClick={() => onChange({ bracket: b.key })}
                className="skewbox num px-4 py-2 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase transition-colors duration-150"
                style={{
                  background: active ? b.accent : "rgba(255,255,255,0.05)",
                  color: active ? "var(--color-acid-ink)" : "var(--color-ink-3)",
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-[260px]">
          <input
            type="search"
            value={state.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Rechercher un joueur, une équipe…"
            aria-label="Rechercher un joueur"
            // Pas de `focus:outline-none` : le champ garde l'anneau de focus du
            // site, le changement de bordure ne fait que le renforcer.
            className="h-9 w-full rounded-sm border border-hair bg-panel-3/60 pr-3 pl-8 text-[0.8125rem] text-ink transition-colors duration-150 placeholder:text-ink-4 hover:border-hair-2 focus:border-acid/50"
          />
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
          >
            <circle
              cx="5.6"
              cy="5.6"
              r="4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M9.2 9.2 13 13"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <FilterToggle
          active={state.inGameOnly}
          onClick={() => onChange({ inGameOnly: !state.inGameOnly })}
          title="N'afficher que les joueurs actuellement en partie"
          disabled={inGameCount === 0}
        >
          <LiveDot tone={state.inGameOnly ? "acid" : "ink"} />
          En partie
          <span className="num opacity-60">{inGameCount}</span>
        </FilterToggle>

        {favouriteCount > 0 && (
          <FilterToggle
            active={state.favouritesOnly}
            onClick={() => onChange({ favouritesOnly: !state.favouritesOnly })}
            title="N'afficher que mes favoris"
          >
            <StarGlyph filled={state.favouritesOnly} />
            Favoris
            <span className="num opacity-60">{favouriteCount}</span>
          </FilterToggle>
        )}
      </div>

      {/* ── Groupe de droite : le poste, le pays, la source ── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ roles: [] })}
            className={cn(
              "num h-9 rounded-sm px-3 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase transition-colors duration-150",
              state.roles.length === 0
                ? "bg-acid text-acid-ink"
                : "bg-panel-3/60 text-ink-3 hover:text-ink",
            )}
          >
            Tous
          </button>
          {ROLES.map((role) => {
            const active = state.roles.includes(role);
            return (
              <button
                key={role}
                onClick={() => toggleRole(role)}
                aria-pressed={active}
                title={roleLabel(role)}
                className={cn(
                  "grid size-9 place-items-center rounded-sm transition-colors duration-150",
                  active
                    ? "bg-acid/15 ring-1 ring-acid/60 ring-inset"
                    : "bg-panel-3/60 hover:bg-panel-4",
                )}
              >
                <RoleIcon
                  role={role}
                  size={18}
                  title={false}
                  className={active ? "opacity-100" : "opacity-60"}
                />
              </button>
            );
          })}
        </div>

        {countries.length > 1 && (
          <Popover
            active={state.country !== null}
            title="Filtrer par nationalité"
            label={
              state.country ? (
                <span className="flex items-center gap-1.5">
                  <Flag code={state.country} width={14} />
                  {state.country}
                </span>
              ) : (
                "Pays"
              )
            }
          >
            {(close) => (
              <>
                <PopoverItem
                  selected={state.country === null}
                  onSelect={() => {
                    onChange({ country: null });
                    close();
                  }}
                >
                  Toutes les nationalités
                  <span className="num ml-auto text-[0.6875rem] text-ink-4 tabular-nums">
                    {total}
                  </span>
                </PopoverItem>
                <div className="my-1 h-px bg-hair" />
                {countries.map(({ code, count }) => (
                  <PopoverItem
                    key={code}
                    selected={state.country === code}
                    onSelect={() => {
                      onChange({ country: code });
                      close();
                    }}
                  >
                    <Flag code={code} width={16} />
                    <span className="truncate">{countryName(code)}</span>
                    <span className="num ml-auto text-[0.6875rem] text-ink-4 tabular-nums">
                      {count}
                    </span>
                  </PopoverItem>
                ))}
              </>
            )}
          </Popover>
        )}

        <span className="md:hidden">
          <Popover
            title="Ordre du classement"
            active={sortKey !== "position"}
            label={
              <span className="flex items-center gap-1.5">
                <span className="text-ink-4">Trier&nbsp;:</span>
                {MOBILE_SORTS.find((s) => s.key === sortKey)?.label ?? "Place"}
                <span className="num text-[0.625rem] text-ink-4">
                  {sortDir === "asc" ? "↑" : "↓"}
                </span>
              </span>
            }
          >
            {(close) =>
              MOBILE_SORTS.map((s) => (
                <PopoverItem
                  key={s.key}
                  selected={s.key === sortKey}
                  onSelect={() => {
                    onSort(s.key);
                    close();
                  }}
                >
                  {s.label}
                  {s.key === sortKey && (
                    <span className="num ml-auto text-[0.6875rem] text-ink-4">
                      {sortDir === "asc" ? "croissant" : "décroissant"}
                    </span>
                  )}
                </PopoverItem>
              ))
            }
          </Popover>
        </span>

        <Popover
          title="Site de statistiques ouvert par la colonne Profil"
          label={
            <span className="flex items-center gap-1.5">
              <span className="text-ink-4">Profil&nbsp;:</span>
              {provider.label}
            </span>
          }
        >
          {(close) =>
            PROVIDERS.map((p) => (
              <PopoverItem
                key={p.key}
                selected={p.key === provider.key}
                onSelect={() => {
                  onProviderChange(p.key);
                  close();
                }}
              >
                {p.label}
              </PopoverItem>
            ))
          }
        </Popover>

        <p className="num ml-1 hidden text-micro tracking-[0.1em] text-ink-4 sm:block">
          {shown === total ? `${total} JOUEURS` : `${shown}/${total}`}
        </p>
      </div>
    </div>
  );
}

function FilterToggle({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-[0.75rem] font-medium transition-colors duration-150",
        disabled && "cursor-not-allowed opacity-40",
        active
          ? "border-acid/60 bg-acid/12 text-acid"
          : "border-hair bg-panel-3/60 text-ink-2 hover:border-hair-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function StarGlyph({
  filled,
  size = 13,
}: {
  filled: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 1.5 : 2}
      className={filled ? "" : "opacity-45"}
    >
      <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85L12 3.5z" />
    </svg>
  );
}
