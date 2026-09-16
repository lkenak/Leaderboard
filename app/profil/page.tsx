import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headerContext } from "@/lib/header";
import { listClaimedAccounts } from "@/lib/db/users";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Avatar } from "@/components/ui/Avatar";
import { ClaimAccountForm } from "@/components/ladders/ClaimAccountForm";
import { setMainAccountAction, unclaimAccountAction } from "./actions";

export const metadata: Metadata = {
  title: "Mes comptes Riot",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  await connection();
  const now = reportedNow();
  const { user, userId, ladders } = await headerContext();
  if (!userId || !user) redirect("/login?from=/profil");

  const claimed = listClaimedAccounts(userId);

  return (
    <>
      <Header ladders={ladders} user={user} />
      <main className="flex-1 pb-24">
        <div className="shell max-w-2xl pt-12">
          <p className="label">Mon compte</p>
          <h1 className="mt-3 flex items-center gap-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
            {user.avatar && (
              // eslint-disable-next-line @next/next/no-img-element -- source distante, taille fixe
              <img
                src={user.avatar}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full ring-1 ring-hair"
              />
            )}
            {user.name}
          </h1>
          <p className="mt-3 text-[0.8125rem] text-ink-3">
            Connecté avec Discord.{" "}
            <Link
              href="/ladders"
              className="text-acid underline decoration-acid/40 underline-offset-2"
            >
              Voir mes ladders
            </Link>
            .
          </p>

          <section className="mt-10 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">Mes comptes Riot</h2>
            <p className="mt-1.5 mb-5 text-[0.8125rem] leading-relaxed text-ink-3">
              Déclare ici tes propres comptes — sans vérification — pour voir
              apparaître dans « où j&apos;apparais » tous les ladders où ils
              sont suivis, même créés par quelqu&apos;un d&apos;autre. Le compte
              marqué <span className="num text-acid">principal</span> est celui
              qui te représente : c&apos;est à lui que le bot Discord te
              reliera, pas à un smurf.
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
                      <p className="flex flex-wrap items-center gap-x-2 text-[0.875rem] font-medium text-ink">
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
