import type { Metadata } from "next";
import { after, connection } from "next/server";
import { buildAllSnapshots } from "@/lib/mock";
import { buildSnapshots } from "@/lib/riot/snapshot";
import { syncIfStale } from "@/lib/riot/refresh";
import { keyStatus } from "@/lib/riot/key";
import { read } from "@/lib/store";
import { agoLabel, clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { StatusBanner } from "@/components/site/StatusBanner";
import { Ladder } from "@/components/ranking/Ladder";
import type { RankingSnapshot } from "@/lib/types";

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
  const store = await read();
  const key = await keyStatus();
  const live = key.source !== "none" && store.roster.length > 0;

  let snapshots: Record<string, RankingSnapshot>;
  let banner: React.ReactNode = null;

  if (live) {
    const built = await buildSnapshots(now);
    snapshots = built.snapshots;

    /* Relevé en arrière-plan : `after` s'exécute une fois la réponse envoyée,
       donc le visiteur n'attend jamais l'API Riot. Le verrou de `runSync`
       empêche plusieurs visiteurs de déclencher autant de synchronisations. */
    after(syncIfStale);

    /* La clé refusée passe avant tout le reste : les rangs affichés sont ceux
       du dernier relevé réussi, et rien ne bougera avant qu'une clé neuve soit
       collée. Le dire tout de suite évite de chercher la panne ailleurs. */
    if (key.rejectedAt !== null) {
      banner = (
        <StatusBanner
          tone="warn"
          title="Clé Riot expirée."
          action={{ href: "/admin", label: "Coller une clé" }}
        >
          {built.meta.lastSync !== null
            ? `Le classement est figé au dernier relevé (${agoLabel(built.meta.lastSync, now)}).`
            : "Aucun relevé n'a encore abouti."}{" "}
          Une clé de développement meurt 24 h après sa génération : en reprendre
          une sur le portail Riot, puis la coller depuis le plateau.
        </StatusBanner>
      );
    } else if (built.meta.lastSync === null) {
      banner = (
        <StatusBanner
          tone="info"
          title="Premier relevé en cours."
          action={{ href: "/admin", label: "Plateau" }}
        >
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
          action={{ href: "/admin", label: "Corriger" }}
        >
          {built.meta.excluded
            .slice(0, 3)
            .map((e) => `${e.label} — ${e.reason}`)
            .join(" · ")}
          {built.meta.excluded.length > 3 && " …"}
        </StatusBanner>
      );
    }
  } else {
    snapshots = buildAllSnapshots(now);
    banner = (
      <StatusBanner
        tone="info"
        title="Données de démonstration."
        action={{ href: "/admin", label: "Ajouter des comptes" }}
      >
        {key.source !== "none"
          ? "Aucun compte n'est encore suivi : le tableau montre un plateau fictif."
          : "Aucune clé Riot n'est configurée : le tableau montre un plateau fictif."}
      </StatusBanner>
    );
  }

  const liveCount = Object.values(snapshots).reduce(
    (a, s) => a + s.entries.filter((e) => e.live).length,
    0,
  );

  return (
    <>
      <Header liveCount={liveCount} />
      <main className="flex-1 pb-24">
        <Ladder
          snapshots={snapshots}
          serverNow={now}
          banner={banner}
          demo={!live}
        />
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
