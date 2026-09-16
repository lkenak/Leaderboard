import Link from "next/link";
import { cn } from "@/lib/cn";
import { agoLabel } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Crest } from "@/components/ui/Crest";
import { LiveDot } from "@/components/ui/LiveDot";
import type { RankingEntry } from "@/lib/types";

/**
 * Aperçu d'un ladder pour la page « mes ladders ».
 *
 * Les chiffres viennent de `buildLadderSnapshot`, le même calcul que la page
 * du ladder : un aperçu ne peut donc pas afficher un classement qui
 * contredirait la page complète.
 */
export interface LadderPreview {
  /** Les premières places, déjà triées — au plus trois sont affichées. */
  top: RankingEntry[];
  inGame: number;
  ranked: number;
  accounts: number;
  updatedAt: number | null;
}

/** Les trois premiers, une ligne chacun : assez pour voir un classement sans
 *  ouvrir la page. */
export function LadderTopList({
  preview,
  className,
}: {
  preview: LadderPreview;
  className?: string;
}) {
  if (preview.top.length === 0) {
    return (
      <p className={cn("text-[0.8125rem] text-ink-3", className)}>
        {preview.accounts === 0
          ? "Aucun compte ajouté pour l'instant."
          : "Rangs pas encore relevés."}
      </p>
    );
  }

  return (
    <ol className={cn("flex flex-col gap-2.5", className)}>
      {preview.top.slice(0, 3).map((entry, i) => (
        <li key={entry.player.puuid} className="flex items-center gap-2.5">
          <span className="num w-3 shrink-0 text-[0.6875rem] text-ink-4 tabular-nums">
            {i + 1}
          </span>
          <Avatar
            profileIconId={entry.player.profileIconId}
            name={entry.player.gameName}
            size={26}
            live={entry.live !== null}
          />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">
            {entry.player.gameName}
          </span>
          <Crest tier={entry.rank.tier} size={18} />
          <span className="num shrink-0 text-[0.75rem] font-semibold text-ink tabular-nums">
            {entry.rank.leaguePoints} LP
          </span>
        </li>
      ))}
    </ol>
  );
}

export function LadderCard({
  href,
  name,
  memberCount,
  preview,
  now,
  settingsHref,
}: {
  href: string;
  name: string;
  memberCount: number;
  preview: LadderPreview;
  now: number;
  /** Fourni seulement au propriétaire du ladder. */
  settingsHref?: string;
}) {
  return (
    <li className="flex flex-col rounded-md border border-hair bg-panel p-4 transition-colors duration-150 hover:border-hair-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={href}
            className="block truncate text-name font-semibold text-ink transition-colors duration-150 hover:text-acid"
          >
            {name}
          </Link>
          <p className="num mt-1 text-[0.625rem] tracking-[0.06em] text-ink-4">
            {memberCount} compte{memberCount > 1 ? "s" : ""}
            {preview.inGame > 0 && ` · ${preview.inGame} en jeu`}
          </p>
        </div>
        {preview.inGame > 0 && <LiveDot className="mt-1.5" />}
      </div>

      <LadderTopList preview={preview} className="mt-4" />

      <div className="mt-4 flex items-center gap-3 border-t border-hair pt-3">
        <Link href={href} className="num text-[0.6875rem] tracking-[0.08em] text-acid">
          VOIR
        </Link>
        {settingsHref && (
          <Link
            href={settingsHref}
            className="num text-[0.6875rem] tracking-[0.08em] text-ink-3 transition-colors duration-150 hover:text-ink"
          >
            RÉGLAGES
          </Link>
        )}
        {preview.updatedAt !== null && (
          <span className="num ml-auto text-[0.625rem] text-ink-4">
            {agoLabel(preview.updatedAt, now)}
          </span>
        )}
      </div>
    </li>
  );
}
