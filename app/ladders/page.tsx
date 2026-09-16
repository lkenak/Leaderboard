import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headerContext } from "@/lib/header";
import { laddersForUser } from "@/lib/db/users";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";
import { clockTime, thousands } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LadderCard, type LadderPreview } from "@/components/ladders/LadderCard";

export const metadata: Metadata = { title: "Mes ladders" };
export const dynamic = "force-dynamic";

/**
 * Hub : la liste de ses ladders, et rien d'autre. Le classement vit sur
 * `/l/[slug]` (c'est là qu'on atterrit en se connectant) et la gestion des
 * comptes Riot sur `/profil` — cette page ne fait que router vers eux, avec
 * assez d'aperçu pour choisir sans ouvrir.
 */
export default async function LaddersPage() {
  await connection();
  const now = reportedNow();
  const { user, userId, ladders } = await headerContext();
  if (!userId) redirect("/login?from=/ladders");

  const { owned, appearingIn } = laddersForUser(userId);

  const previewOf = (ladderId: string): LadderPreview => {
    const { snapshot, meta } = buildLadderSnapshot(ladderId, now);
    return {
      top: snapshot.entries,
      inGame: snapshot.entries.filter((e) => e.live).length,
      ranked: meta.ranked,
      accounts: meta.accounts,
      updatedAt: meta.lastSync,
    };
  };

  return (
    <>
      <Header ladders={ladders} user={user} />
      <main className="flex-1 pb-24">
        <div className="shell pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Mes ladders</p>
              <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
                {owned.length + appearingIn.length === 0
                  ? "Aucun ladder"
                  : `${thousands(owned.length + appearingIn.length)} ladder${owned.length + appearingIn.length > 1 ? "s" : ""}`}
              </h1>
            </div>
            <Link
              href="/ladders/new"
              className="num flex h-10 items-center gap-1.5 rounded-sm bg-acid px-4 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110"
            >
              <span aria-hidden>+</span>
              Créer un ladder
            </Link>
          </div>

          {/* — Les miens — */}
          <section className="mt-10">
            <h2 className="text-sub font-semibold text-ink">
              Que j&apos;ai créés{" "}
              <span className="num text-ink-4">({thousands(owned.length)})</span>
            </h2>
            {owned.length === 0 ? (
              <p className="mt-4 rounded-md border border-hair bg-panel px-4 py-8 text-center text-[0.875rem] text-ink-3">
                Tu n&apos;as encore créé aucun ladder.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {owned.map((l) => (
                  <LadderCard
                    key={l.id}
                    href={`/l/${l.slug}`}
                    settingsHref={`/l/${l.slug}/settings`}
                    name={l.name}
                    memberCount={l.memberCount}
                    preview={previewOf(l.id)}
                    now={now}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* — Découverte croisée — */}
          <section className="mt-10">
            <h2 className="text-sub font-semibold text-ink">
              Où j&apos;apparais{" "}
              <span className="num text-ink-4">({thousands(appearingIn.length)})</span>
            </h2>
            <p className="mt-1.5 text-[0.8125rem] text-ink-3">
              Les ladders créés par d&apos;autres où un des comptes Riot que tu
              as déclarés est suivi.{" "}
              <Link
                href="/profil"
                className="text-acid underline decoration-acid/40 underline-offset-2"
              >
                Gérer mes comptes
              </Link>
              .
            </p>
            {appearingIn.length === 0 ? (
              <p className="mt-4 rounded-md border border-hair bg-panel px-4 py-8 text-center text-[0.875rem] text-ink-3">
                Aucun pour l&apos;instant.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {appearingIn.map((l) => (
                  <LadderCard
                    key={l.id}
                    href={`/l/${l.slug}`}
                    name={l.name}
                    memberCount={l.memberCount}
                    preview={previewOf(l.id)}
                    now={now}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
