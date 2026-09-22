import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { headerContext } from "@/lib/header";
import { getLadderBySlug } from "@/lib/db/ladders";
import { getMatchDetail } from "@/lib/db/match-details";
import { clockTime, duration, shortDate } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Scoreboard } from "@/components/match/Scoreboard";
import { GoldChart } from "@/components/match/GoldChart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  return {
    title: `Partie ${matchId}`,
    description: "Détail complet d'une partie : scoreboard, build, runes, courbe d'or.",
  };
}

/** Lu depuis SQLite à chaque requête, jamais figé au build. */
export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ slug: string; matchId: string }>;
}) {
  await connection();
  const { slug, matchId } = await params;

  const ladder = getLadderBySlug(slug);
  if (!ladder) notFound();

  // Seules les 5 parties les plus récentes d'un compte suivi ont un détail en
  // cache (lib/riot/sync.ts) : une partie plus ancienne, ou jamais rattachée
  // à aucun compte suivi, n'a simplement rien à montrer ici.
  const detail = getMatchDetail(matchId);
  if (!detail) notFound();

  const { user: headerUser, ladders } = await headerContext();

  return (
    <>
      <Header liveCount={0} currentSlug={slug} ladders={ladders} user={headerUser} />
      <main className="flex-1 pb-24">
        <div className="shell flex flex-col gap-4 pt-6">
          <Link
            href={`/l/${slug}`}
            className="text-[0.75rem] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            ← Retour à {ladder.name}
          </Link>

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair pb-4">
            <h1 className="text-[1.0625rem] font-semibold text-ink">Détail de la partie</h1>
            <p className="num text-[0.75rem] tracking-[0.06em] text-ink-4">
              {shortDate(detail.endedAt)} · {duration(detail.durationSec)} · patch{" "}
              {detail.gameVersion.split(".").slice(0, 2).join(".")}
            </p>
          </div>

          <Scoreboard detail={detail} />

          <div className="rounded-sm border border-hair bg-panel-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="label">Écart aux golds</span>
              <span className="num text-[0.6875rem] text-ink-4 tabular-nums">
                {detail.goldTimeline.length} min
              </span>
            </div>
            <div className="mt-3">
              <GoldChart timeline={detail.goldTimeline} className="h-[160px] w-full" />
            </div>
          </div>
        </div>
      </main>
      <Footer updatedLabel={clockTime(reportedNow())} />
    </>
  );
}
