import type { Metadata } from "next";
import Link from "next/link";
import { after, connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { laddersForUser, listClaimedAccounts, type LadderRef } from "@/lib/db/users";
import { buildLadderSnapshot } from "@/lib/riot/snapshot";
import { syncIfStale } from "@/lib/riot/refresh";
import { agoLabel, clockTime, thousands } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { cn } from "@/lib/cn";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Podium } from "@/components/ranking/Podium";
import { Avatar } from "@/components/ui/Avatar";
import { ClaimAccountForm } from "@/components/ladders/ClaimAccountForm";
import { LadderCard, LadderTopList, type LadderPreview } from "@/components/ladders/LadderCard";
import { setMainAccountAction, unclaimAccountAction } from "./actions";

export const metadata: Metadata = { title: "Mes ladders" };
export const dynamic = "force-dynamic";

/**
 * Ladder mis en avant : celui qui suit le plus de comptes, à défaut le plus
 * récent (`laddersForUser` les rend déjà du plus récent au plus ancien, et le
 * tri est stable). Un ladder de test à deux comptes ne passe donc pas devant
 * le vrai ladder du groupe. On ne met en avant un ladder d'un autre que si
 * l'utilisateur n'en possède aucun.
 */
function pickFeatured(owned: LadderRef[], appearingIn: LadderRef[]): LadderRef | null {
  const pool = owned.length > 0 ? owned : appearingIn;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.memberCount - a.memberCount)[0];
}

export default async function LaddersPage() {
  await connection();
  const now = reportedNow();
  const session = await auth();
  if (!session?.user) redirect("/login?from=/ladders");

  const userId = session.user.id;
  const user = { name: session.user.name ?? "Discord", avatar: session.user.image ?? null };
  const { owned, appearingIn } = laddersForUser(userId);
  const claimed = listClaimedAccounts(userId);

  /* Arriver sur son tableau de bord garde les relevés au chaud, comme une
     visite de classement le fait déjà. `syncIfStale` vérifie lui-même la clé
     et l'âge du dernier relevé, donc l'appel est sans effet le reste du
     temps. */
  after(syncIfStale);

  const featured = pickFeatured(owned, appearingIn);
  const featuredBuilt = featured ? buildLadderSnapshot(featured.id, now) : null;

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

  const featuredPreview: LadderPreview | null = featuredBuilt
    ? {
        top: featuredBuilt.snapshot.entries,
        inGame: featuredBuilt.snapshot.entries.filter((e) => e.live).length,
        ranked: featuredBuilt.meta.ranked,
        accounts: featuredBuilt.meta.accounts,
        updatedAt: featuredBuilt.meta.lastSync,
      }
    : null;

  // Le ladder mis en avant n'est pas répété dans les grilles en dessous.
  const otherOwned = owned.filter((l) => l.id !== featured?.id);
  const otherAppearing = appearingIn.filter((l) => l.id !== featured?.id);
  const featuredIsOwned = featured ? featured.ownerUserId === userId : false;
  const canPodium = (featuredPreview?.top.length ?? 0) >= 3;

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

          {/* — Ladder mis en avant : du classement dès l'arrivée — */}
          {featured && featuredPreview && (
            <section className="mt-12">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="label">
                    {featuredIsOwned ? "Ton ladder principal" : "Ladder où tu apparais"}
                  </p>
                  <h2 className="mt-2.5 truncate text-[1.75rem] leading-none font-bold tracking-[-0.03em] text-ink md:text-[2.25rem]">
                    <Link
                      href={`/l/${featured.slug}`}
                      className="transition-colors duration-150 hover:text-acid"
                    >
                      {featured.name}
                    </Link>
                  </h2>
                  <p className="num mt-3 flex flex-wrap items-center gap-x-2.5 text-[0.6875rem] tracking-[0.06em] text-ink-4">
                    <span>
                      {featured.memberCount} compte{featured.memberCount > 1 ? "s" : ""}
                    </span>
                    <span>
                      {featuredPreview.ranked} classé{featuredPreview.ranked > 1 ? "s" : ""}
                    </span>
                    {featuredPreview.inGame > 0 && (
                      <span className="text-acid">{featuredPreview.inGame} en jeu</span>
                    )}
                    {featuredPreview.updatedAt !== null && (
                      <span>relevé {agoLabel(featuredPreview.updatedAt, now)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/l/${featured.slug}`}
                    className="num flex h-9 items-center rounded-sm border border-hair bg-panel-3/60 px-4 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid"
                  >
                    Voir le classement
                  </Link>
                  {featuredIsOwned && (
                    <Link
                      href={`/l/${featured.slug}/settings`}
                      className="num text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-4 transition-colors duration-150 hover:text-ink-2"
                    >
                      Réglages
                    </Link>
                  )}
                </div>
              </div>

              {canPodium && (
                <div className="mt-8">
                  <Podium entries={featuredPreview.top} />
                </div>
              )}
              {/* Le podium est réservé aux grands écrans : en dessous, et pour
                  un ladder de moins de trois classés, la liste compacte prend
                  le relais. */}
              <div
                className={cn(
                  "mt-6 rounded-md border border-hair bg-panel p-4",
                  canPodium && "md:hidden",
                )}
              >
                <LadderTopList preview={featuredPreview} />
              </div>
            </section>
          )}

          {/* — Les autres ladders possédés — */}
          {owned.length === 0 ? (
            <section className="mt-12">
              <h2 className="text-sub font-semibold text-ink">Mes ladders</h2>
              <p className="mt-4 rounded-md border border-hair bg-panel px-4 py-8 text-center text-[0.875rem] text-ink-3">
                Tu n&apos;as encore créé aucun ladder.
              </p>
            </section>
          ) : (
            otherOwned.length > 0 && (
              <section className="mt-12">
                <h2 className="text-sub font-semibold text-ink">
                  Mes autres ladders{" "}
                  <span className="num text-ink-4">({thousands(otherOwned.length)})</span>
                </h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherOwned.map((l) => (
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
              </section>
            )
          )}

          {/* — Découverte croisée — */}
          {otherAppearing.length > 0 && (
            <section className="mt-12">
              <h2 className="text-sub font-semibold text-ink">
                Où j&apos;apparais{" "}
                <span className="num text-ink-4">({thousands(otherAppearing.length)})</span>
              </h2>
              <p className="mt-1.5 text-[0.8125rem] text-ink-3">
                Les ladders créés par d&apos;autres où un de tes comptes déclarés
                ci-dessous est suivi.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherAppearing.map((l) => (
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
            </section>
          )}

          {/* — Mes comptes déclarés — */}
          <section className="mt-12 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">Mes comptes Riot</h2>
            <p className="mt-1.5 mb-5 text-[0.8125rem] leading-relaxed text-ink-3">
              Déclare ici tes propres comptes — sans vérification — pour voir
              apparaître ci-dessus tous les ladders où ils sont suivis, même
              créés par quelqu&apos;un d&apos;autre. Le compte marqué{" "}
              <span className="num text-acid">principal</span> est celui qui te
              représente : c&apos;est à lui que le bot Discord te reliera.
            </p>
            <ClaimAccountForm />

            {claimed.length > 0 && (
              <ul className="mt-5 divide-y divide-hair border-t border-hair">
                {claimed.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <Avatar
                      profileIconId={c.profileIconId ?? undefined}
                      name={c.gameName}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 truncate text-[0.875rem] font-medium text-ink">
                        <span className="truncate">
                          {c.gameName}
                          <span className="num text-ink-4">#{c.tagLine}</span>
                        </span>
                        <span className="num text-[0.6875rem] text-ink-4">{c.region}</span>
                        {c.isMain && (
                          <span className="num rounded-[2px] bg-acid/15 px-1.5 py-px text-[0.5625rem] font-semibold tracking-[0.08em] uppercase text-acid">
                            Principal
                          </span>
                        )}
                      </p>
                      {c.resolveError && (
                        <p className="mt-0.5 text-[0.75rem] text-blaze">{c.resolveError}</p>
                      )}
                    </div>

                    {!c.isMain && (
                      <form action={setMainAccountAction} className="contents">
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          title={`Faire de ${c.gameName}#${c.tagLine} ton compte principal`}
                          className="num shrink-0 text-[0.6875rem] tracking-[0.08em] text-ink-3 transition-colors duration-150 hover:text-acid"
                        >
                          DÉFINIR PRINCIPAL
                        </button>
                      </form>
                    )}

                    <form action={unclaimAccountAction} className="contents">
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="num shrink-0 text-[0.6875rem] tracking-[0.08em] text-ink-4 transition-colors duration-150 hover:text-blaze"
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
