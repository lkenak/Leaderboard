import type { Metadata } from "next";
import { connection } from "next/server";
import { buildAllSnapshots } from "@/lib/mock";
import { reportedNow } from "@/lib/now";
import { clockTime } from "@/lib/format";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ladder } from "@/components/ranking/Ladder";

export const metadata: Metadata = {
  title: "Classement",
  description:
    "Classement SoloQ en direct : LP, bilan, forme, séries et historique de parties.",
};

/** Le classement est recalculé à chaque requête, jamais figé au build. */
export const dynamic = "force-dynamic";

export default async function RankingPage() {
  // Déclare explicitement que ce rendu dépend de la requête : sans cela, Next
  // serait en droit de mettre en cache un classement daté.
  await connection();

  const now = reportedNow();
  const snapshots = buildAllSnapshots(now);
  const liveCount = Object.values(snapshots).reduce(
    (a, s) => a + s.entries.filter((e) => e.live).length,
    0,
  );

  return (
    <>
      <Header liveCount={liveCount} />
      <main className="flex-1 pb-24">
        <Ladder snapshots={snapshots} serverNow={now} />
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
