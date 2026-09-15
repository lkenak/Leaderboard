import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { laddersForUser, listClaimedAccounts } from "@/lib/db/users";
import { clockTime, thousands } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ClaimAccountForm } from "@/components/ladders/ClaimAccountForm";
import { unclaimAccountAction } from "./actions";

export const metadata: Metadata = { title: "Mes ladders" };
export const dynamic = "force-dynamic";

export default async function LaddersPage() {
  await connection();
  const now = reportedNow();
  const session = await auth();
  if (!session?.user) redirect("/login?from=/ladders");

  const user = { name: session.user.name ?? "Discord", avatar: session.user.image ?? null };
  const { owned, appearingIn } = laddersForUser(session.user.id);
  const claimed = listClaimedAccounts(session.user.id);

  return (
    <>
      <Header user={user} />
      <main className="flex-1 pb-24">
        <div className="shell pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Mes ladders</p>
              <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
                Bonjour {user.name}
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

          {/* — Ladders possédés — */}
          <section className="mt-10">
            <h2 className="text-sub font-semibold text-ink">
              Possédés <span className="num text-ink-4">({thousands(owned.length)})</span>
            </h2>
            {owned.length === 0 ? (
              <p className="mt-4 rounded-md border border-hair bg-panel px-4 py-8 text-center text-[0.875rem] text-ink-3">
                Tu n&apos;as encore créé aucun ladder.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {owned.map((l) => (
                  <li key={l.id} className="rounded-md border border-hair bg-panel p-4">
                    <p className="truncate text-name font-semibold text-ink">{l.name}</p>
                    <p className="num mt-1 text-[0.75rem] text-ink-4">
                      {l.memberCount} compte{l.memberCount > 1 ? "s" : ""}
                    </p>
                    <div className="mt-3 flex gap-3">
                      <Link href={`/l/${l.slug}`} className="num text-[0.6875rem] tracking-[0.08em] text-acid">
                        VOIR
                      </Link>
                      <Link
                        href={`/l/${l.slug}/settings`}
                        className="num text-[0.6875rem] tracking-[0.08em] text-ink-3 hover:text-ink"
                      >
                        RÉGLAGES
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* — Découverte croisée — */}
          <section className="mt-10">
            <h2 className="text-sub font-semibold text-ink">
              Où j&apos;apparais <span className="num text-ink-4">({thousands(appearingIn.length)})</span>
            </h2>
            <p className="mt-1.5 text-[0.8125rem] text-ink-3">
              Les ladders créés par d&apos;autres où un de tes comptes déclarés
              ci-dessous est suivi.
            </p>
            {appearingIn.length === 0 ? (
              <p className="mt-4 rounded-md border border-hair bg-panel px-4 py-8 text-center text-[0.875rem] text-ink-3">
                Aucun pour l&apos;instant.
              </p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {appearingIn.map((l) => (
                  <li key={l.id} className="rounded-md border border-hair bg-panel p-4">
                    <p className="truncate text-name font-semibold text-ink">{l.name}</p>
                    <p className="num mt-1 text-[0.75rem] text-ink-4">
                      {l.memberCount} compte{l.memberCount > 1 ? "s" : ""}
                    </p>
                    <Link href={`/l/${l.slug}`} className="mt-3 num inline-block text-[0.6875rem] tracking-[0.08em] text-acid">
                      VOIR
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* — Mes comptes déclarés — */}
          <section className="mt-10 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">Mes comptes Riot</h2>
            <p className="mt-1.5 mb-5 text-[0.8125rem] text-ink-3">
              Déclare ici tes propres comptes — sans vérification — pour voir
              apparaître ci-dessus tous les ladders où ils sont suivis, même
              créés par quelqu&apos;un d&apos;autre.
            </p>
            <ClaimAccountForm />

            {claimed.length > 0 && (
              <ul className="mt-5 divide-y divide-hair border-t border-hair">
                {claimed.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] font-medium text-ink">
                        {c.gameName}
                        <span className="num text-ink-4">#{c.tagLine}</span>{" "}
                        <span className="num text-[0.6875rem] text-ink-4">{c.region}</span>
                      </p>
                      {c.resolveError && (
                        <p className="text-[0.75rem] text-blaze">{c.resolveError}</p>
                      )}
                    </div>
                    <form action={unclaimAccountAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="num shrink-0 text-[0.6875rem] tracking-[0.08em] text-ink-4 hover:text-blaze"
                      >
                        RETIRER
                      </button>
                    </form>
                  </li>
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
