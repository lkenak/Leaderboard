import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { headerContext } from "@/lib/header";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";
import { hasKey, syncIfStale } from "@/lib/riot/refresh";
import { getLadderBySlug } from "@/lib/db/ladders";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { StatusBanner } from "@/components/site/StatusBanner";
import { Ladder } from "@/components/ranking/Ladder";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ladder = getLadderBySlug(slug);
  return {
    title: ladder ? ladder.name : "Ladder introuvable",
    description:
      "Classement SoloQ en direct : LP, bilan, forme, séries et historique de parties.",
  };
}

/** Le classement est recalculé à chaque requête, jamais figé au build. */
export const dynamic = "force-dynamic";

export default async function LadderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Déclare explicitement que ce rendu dépend de la requête : sans cela, Next
  // serait en droit de mettre en cache un classement daté.
  await connection();
  const { slug } = await params;
  const now = reportedNow();

  const ladder = getLadderBySlug(slug);
  if (!ladder) notFound();

  const { user: headerUser, userId, ladders } = await headerContext();
  const isOwner = userId === ladder.ownerUserId;

  const built = buildLadderSnapshot(ladder.id, now);
  const snapshot = built.snapshot;
  let banner: React.ReactNode = null;

  if (built.meta.accounts === 0) {
    banner = (
      <StatusBanner
        tone="info"
        title="Aucun compte ajouté encore."
        action={isOwner ? { href: `/l/${slug}/settings`, label: "Ajouter des comptes" } : undefined}
      >
        {isOwner
          ? "Ajoute ton compte et ceux de tes amis depuis les réglages du ladder."
          : "Le propriétaire de ce ladder n'a pas encore ajouté de compte."}
      </StatusBanner>
    );
  } else if (!hasKey()) {
    banner = (
      <StatusBanner tone="warn" title="Aucune clé Riot configurée sur ce serveur.">
        Les comptes ajoutés ne peuvent pas être relevés pour l&apos;instant.
      </StatusBanner>
    );
  } else {
    /* Relevé en arrière-plan : `after` s'exécute une fois la réponse envoyée,
       donc le visiteur n'attend jamais l'API Riot. Le verrou de `runSync`
       empêche plusieurs visiteurs de déclencher autant de synchronisations. */
    after(syncIfStale);

    if (built.meta.lastSync === null) {
      banner = (
        <StatusBanner tone="info" title="Premier relevé en cours.">
          Les rangs apparaissent dès qu&apos;il est terminé. Les colonnes{" "}
          <em>24 h</em> et <em>courbe</em> se rempliront ensuite, à mesure que
          les relevés s&apos;accumulent.
        </StatusBanner>
      );
    } else if (built.meta.excluded.length > 0) {
      banner = (
        <StatusBanner
          tone="warn"
          title={`${built.meta.excluded.length} compte${built.meta.excluded.length > 1 ? "s" : ""} hors classement.`}
          action={isOwner ? { href: `/l/${slug}/settings`, label: "Corriger" } : undefined}
        >
          {built.meta.excluded
            .slice(0, 3)
            .map((e) => `${e.label} — ${e.reason}`)
            .join(" · ")}
          {built.meta.excluded.length > 3 && " …"}
        </StatusBanner>
      );
    }
  }

  const liveCount = snapshot.entries.filter((e) => e.live).length;

  return (
    <>
      <Header
        liveCount={liveCount}
        currentSlug={slug}
        ladders={ladders}
        user={headerUser}
      />
      <main className="flex-1 pb-24">
        <Ladder
          snapshot={snapshot}
          serverNow={now}
          banner={banner}
          ladderName={ladder.name}
          ladderSlug={slug}
        />
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
