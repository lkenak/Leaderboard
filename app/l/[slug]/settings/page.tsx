import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { headerContext } from "@/lib/header";
import { getLadderBySlug, listMembers } from "@/lib/db/ladders";
import { getPlayer, listGames, listSamples } from "@/lib/db/riot-players";
import { hasKey } from "@/lib/riot/refresh";
import { agoLabel, clockTime, thousands } from "@/lib/format";
import { rankShort } from "@/lib/lol";
import { reportedNow } from "@/lib/now";
import { cn } from "@/lib/cn";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Avatar } from "@/components/ui/Avatar";
import { AddAccountForm } from "@/components/settings/AddAccountForm";
import { SyncButton } from "@/components/settings/SyncButton";
import {
  addAccountAction,
  createLinkCodeAction,
  removeAccountAction,
  retryAccountAction,
  syncNowAction,
} from "./actions";
import { DUREE_CODE_MS } from "@/lib/db/link-codes";

export const metadata: Metadata = {
  title: "Réglages du ladder",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LadderSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  const now = reportedNow();

  const ladder = getLadderBySlug(slug);
  if (!ladder) notFound();

  const { user: headerUser, userId, ladders } = await headerContext();
  if (!userId) redirect(`/login?from=/l/${slug}/settings`);

  if (userId !== ladder.ownerUserId) {
    return (
      <>
        <Header currentSlug={slug} ladders={ladders} user={headerUser} />
        <main className="flex-1 pb-24">
          <div className="shell max-w-md pt-24">
            <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-ink">
              Réglages
            </h1>
            <p className="mt-3 text-[0.875rem] text-ink-3">
              Seul le propriétaire de « {ladder.name} » peut modifier ses comptes.
            </p>
            <Link
              href={`/l/${slug}`}
              className="mt-6 inline-block num text-[0.75rem] tracking-[0.1em] text-acid"
            >
              VOIR LE CLASSEMENT →
            </Link>
          </div>
        </main>
        <Footer updatedLabel={clockTime(now)} />
      </>
    );
  }

  const members = [...listMembers(ladder.id)].sort((a, b) =>
    a.gameName.localeCompare(b.gameName, "fr"),
  );
  const keyPresent = hasKey();
  const failing = members.filter((m) => m.resolveError).length;
  const lastSyncs = members
    .map((m) => (m.puuid ? getPlayer(m.puuid) : null))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const lastSync = lastSyncs.length > 0 ? Math.max(...lastSyncs.map((p) => p.updatedAt)) : null;

  const boundAdd = addAccountAction.bind(null, slug);
  const boundSync = syncNowAction.bind(null, slug);
  const boundLinkCode = createLinkCodeAction.bind(null, slug);
  const boundRemove = removeAccountAction.bind(null, slug);
  const boundRetry = retryAccountAction.bind(null, slug);

  return (
    <>
      <Header currentSlug={slug} ladders={ladders} user={headerUser} />
      <main className="flex-1 pb-24">
        <div className="shell pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Réglages</p>
              <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
                {ladder.name}
              </h1>
            </div>
            <SyncButton action={boundSync} />
          </div>

          {/* — État du branchement : la première chose à savoir en arrivant — */}
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-hair bg-hair sm:grid-cols-4">
            <Tile
              label="Clé Riot"
              value={keyPresent ? "configurée" : "absente"}
              tone={keyPresent ? "ok" : "bad"}
            />
            <Tile label="Comptes" value={thousands(members.length)} />
            <Tile
              label="En erreur"
              value={thousands(failing)}
              tone={failing > 0 ? "bad" : undefined}
            />
            <Tile
              label="Dernier relevé"
              value={lastSync ? agoLabel(lastSync, now) : "jamais"}
              tone={lastSync ? undefined : "bad"}
            />
          </div>

          {!keyPresent && (
            <div className="mt-4 rounded-md border border-blaze/40 bg-blaze/8 px-4 py-3.5 text-[0.8125rem] leading-relaxed text-ink-2">
              <strong className="font-semibold text-blaze">Aucune clé Riot configurée sur ce serveur.</strong>{" "}
              Les comptes peuvent être ajoutés, mais aucun rang ne sera relevé jusqu&apos;à ce
              qu&apos;une clé Riot soit configurée côté serveur.
            </div>
          )}

          {/* — Ajout — */}
          <section className="mt-10 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">Ajouter un compte</h2>
            <p className="mt-1.5 mb-5 text-[0.8125rem] text-ink-3">
              Le rang, l&apos;icône, le poste et l&apos;historique sont relevés
              immédiatement à l&apos;ajout. Si le Riot ID est introuvable, tu le
              sauras tout de suite.
            </p>
            <AddAccountForm action={boundAdd} />
          </section>

          {/* — Brancher sur un serveur Discord — */}
          <section className="mt-10 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">
              Brancher sur un serveur Discord
            </h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">
              Sur ton propre serveur, un{" "}
              <span className="num text-ink-2">/ladder lier {slug}</span> suffit.
            </p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
              Sur le serveur de quelqu&apos;un d&apos;autre, il faut le
              consentement des deux côtés : toi qui possèdes ce ladder, et un
              administrateur de ce serveur. Engendre un code, passe-le-lui, il
              le saisira dans{" "}
              <span className="num text-ink-2">/ladder lier</span>. Valable{" "}
              {Math.round(DUREE_CODE_MS / 60_000)} minutes, une seule fois.
            </p>
            <div className="mt-5">
              <SyncButton
                action={boundLinkCode}
                label="Engendrer un code"
                pendingLabel="Génération…"
              />
            </div>
          </section>

          {/* — Liste — */}
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sub font-semibold text-ink">Comptes suivis</h2>
              <Link
                href={`/l/${slug}`}
                className="num text-micro tracking-[0.1em] text-ink-3 transition-colors duration-150 hover:text-acid"
              >
                VOIR LE CLASSEMENT →
              </Link>
            </div>

            {members.length === 0 ? (
              <p className="mt-5 rounded-md border border-hair bg-panel px-4 py-10 text-center text-[0.875rem] text-ink-3">
                Aucun compte pour l&apos;instant. Ajoute ton compte et ceux de tes amis.
              </p>
            ) : (
              <ul className="mt-5 overflow-hidden rounded-md border border-hair bg-panel">
                {members.map((member, i) => {
                  const account = member.puuid ? getPlayer(member.puuid) : null;
                  const samples = member.puuid ? listSamples(member.puuid) : [];
                  const latest = samples.at(-1);
                  const games = member.puuid ? listGames(member.puuid).length : 0;

                  return (
                    <li
                      key={member.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5",
                        i > 0 && "border-t border-hair",
                        member.resolveError && "bg-blaze/5",
                      )}
                    >
                      <Avatar
                        profileIconId={account?.profileIconId ?? undefined}
                        name={member.gameName}
                        country={member.country}
                        size={34}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-name font-semibold text-ink">
                          {member.gameName}
                          <span className="num ml-1 font-normal text-ink-4">#{member.tagLine}</span>
                        </p>
                        <p className="num mt-1 flex flex-wrap items-center gap-x-2.5 text-[0.625rem] tracking-[0.06em] text-ink-4">
                          <span>{member.region}</span>
                          {latest && (
                            <span className="text-ink-3">
                              {rankShort(latest)} · {latest.leaguePoints} LP
                            </span>
                          )}
                          <span>
                            {samples.length} relevé{samples.length > 1 ? "s" : ""}
                          </span>
                          <span>
                            {games} partie{games > 1 ? "s" : ""}
                          </span>
                        </p>
                        {member.resolveError && (
                          <p className="mt-1.5 text-[0.75rem] text-blaze">{member.resolveError}</p>
                        )}
                      </div>

                      {member.resolveError && (
                        <form action={boundRetry}>
                          <input type="hidden" name="id" value={member.id} />
                          <button
                            type="submit"
                            title="Oublier le puuid et réessayer la résolution — à utiliser après un renommage"
                            className="num h-8 rounded-sm border border-hair px-2.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase text-ink-3 transition-colors duration-150 hover:border-acid/50 hover:text-acid"
                          >
                            Réessayer
                          </button>
                        </form>
                      )}

                      <form action={boundRemove}>
                        <input type="hidden" name="id" value={member.id} />
                        <button
                          type="submit"
                          title={`Retirer ${member.gameName}#${member.tagLine} de ce ladder`}
                          className="num h-8 rounded-sm border border-hair px-2.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase text-ink-4 transition-colors duration-150 hover:border-blaze/50 hover:text-blaze"
                        >
                          Retirer
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="bg-panel px-4 py-3.5">
      <p className="label text-[0.5625rem]">{label}</p>
      <p
        className={cn(
          "num mt-2 text-[0.9375rem] font-semibold tabular-nums",
          tone === "ok" ? "text-acid" : tone === "bad" ? "text-blaze" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
