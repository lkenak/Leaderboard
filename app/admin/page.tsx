import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { adminPasswordSet, isAdmin } from "@/lib/admin";
import { read } from "@/lib/store";
import { hasKey, refreshIntervalMs } from "@/lib/riot/refresh";
import { agoLabel, thousands } from "@/lib/format";
import { rankShort } from "@/lib/lol";
import { reportedNow } from "@/lib/now";
import { cn } from "@/lib/cn";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Avatar } from "@/components/ui/Avatar";
import { AddAccountForm } from "@/components/admin/AddAccountForm";
import { SignInForm } from "@/components/admin/SignInForm";
import { SyncButton } from "@/components/admin/SyncButton";
import {
  moveBracketAction,
  removeAccountAction,
  retryAccountAction,
  signOutAction,
} from "./actions";
import { clockTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Plateau suivi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await connection();
  const now = reportedNow();

  if (!(await isAdmin())) {
    return (
      <>
        <Header liveCount={0} />
        <main className="flex-1 pb-24">
          <div className="shell max-w-md pt-24">
            <h1 className="text-[1.75rem] font-bold tracking-[-0.02em] text-ink">
              Administration
            </h1>
            {adminPasswordSet() ? (
              <>
                <p className="mt-3 text-[0.875rem] text-ink-3">
                  Cette page permet d&apos;ajouter et de retirer des comptes du
                  classement.
                </p>
                <div className="mt-8">
                  <SignInForm />
                </div>
              </>
            ) : (
              <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-3">
                Aucun mot de passe n&apos;est configuré, donc la page est fermée
                en production. Définir <code className="num text-ink-2">ADMIN_PASSWORD</code>{" "}
                dans les variables d&apos;environnement pour l&apos;ouvrir.
              </p>
            )}
          </div>
        </main>
        <Footer updatedLabel={clockTime(now)} />
      </>
    );
  }

  const store = await read();
  const roster = [...store.roster].sort(
    (a, b) =>
      a.bracket.localeCompare(b.bracket) ||
      a.gameName.localeCompare(b.gameName, "fr"),
  );
  const keyPresent = hasKey();
  const failing = roster.filter((a) => a.error).length;

  return (
    <>
      <Header liveCount={0} />
      <main className="flex-1 pb-24">
        <div className="shell pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Administration</p>
              <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
                Plateau suivi
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <SyncButton />
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="num h-9 rounded-sm px-3 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-4 transition-colors duration-150 hover:text-ink-2"
                >
                  Quitter
                </button>
              </form>
            </div>
          </div>

          {/* — État du branchement : la première chose à savoir en arrivant — */}
          <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-hair bg-hair sm:grid-cols-4">
            <Tile
              label="Clé Riot"
              value={keyPresent ? "configurée" : "absente"}
              tone={keyPresent ? "ok" : "bad"}
            />
            <Tile label="Comptes" value={thousands(roster.length)} />
            <Tile
              label="En erreur"
              value={thousands(failing)}
              tone={failing > 0 ? "bad" : undefined}
            />
            <Tile
              label="Dernier relevé"
              value={store.lastSync ? agoLabel(store.lastSync, now) : "jamais"}
              tone={store.lastSync ? undefined : "bad"}
            />
          </div>

          {!keyPresent && (
            <div className="mt-4 rounded-md border border-blaze/40 bg-blaze/8 px-4 py-3.5 text-[0.8125rem] leading-relaxed text-ink-2">
              <strong className="font-semibold text-blaze">
                Aucune clé Riot.
              </strong>{" "}
              Le classement affiche des données de démonstration. Pour brancher
              les vrais comptes : prendre une clé <em>personnelle</em> sur{" "}
              <a
                href="https://developer.riotgames.com"
                target="_blank"
                rel="noreferrer noopener"
                className="text-acid underline decoration-acid/40 underline-offset-2"
              >
                developer.riotgames.com
              </a>{" "}
              (« Register Product » → Personal : elle n&apos;expire pas), copier{" "}
              <code className="num">.env.example</code> vers{" "}
              <code className="num">.env.local</code>, y coller la clé, puis
              relancer le serveur.
            </div>
          )}

          {/* — Ajout — */}
          <section className="mt-10 rounded-md border border-hair bg-panel p-5">
            <h2 className="text-sub font-semibold text-ink">Ajouter un compte</h2>
            <p className="mt-1.5 mb-5 text-[0.8125rem] text-ink-3">
              Le rang, l&apos;icône, le poste et l&apos;historique sont résolus
              automatiquement au relevé suivant — au plus tard dans{" "}
              {Math.round(refreshIntervalMs() / 60_000)} minutes, ou tout de
              suite avec « Relever maintenant ».
            </p>
            <AddAccountForm />
          </section>

          {/* — Liste — */}
          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sub font-semibold text-ink">
                Comptes suivis
              </h2>
              <Link
                href="/ranking"
                className="num text-micro tracking-[0.1em] text-ink-3 transition-colors duration-150 hover:text-acid"
              >
                VOIR LE CLASSEMENT →
              </Link>
            </div>

            {roster.length === 0 ? (
              <p className="mt-5 rounded-md border border-hair bg-panel px-4 py-10 text-center text-[0.875rem] text-ink-3">
                Aucun compte pour l&apos;instant. Le classement affiche des
                données de démonstration jusqu&apos;au premier ajout.
              </p>
            ) : (
              <ul className="mt-5 overflow-hidden rounded-md border border-hair bg-panel">
                {roster.map((account, i) => {
                  const samples = account.puuid
                    ? (store.samples[account.puuid] ?? [])
                    : [];
                  const latest = samples.at(-1);
                  const games = account.puuid
                    ? (store.games[account.puuid] ?? []).length
                    : 0;

                  return (
                    <li
                      key={account.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5",
                        i > 0 && "border-t border-hair",
                        account.error && "bg-blaze/5",
                      )}
                    >
                      <Avatar
                        profileIconId={account.profileIconId}
                        name={account.gameName}
                        country={account.country}
                        size={34}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-name font-semibold text-ink">
                          {account.gameName}
                          <span className="num ml-1 font-normal text-ink-4">
                            #{account.tagLine}
                          </span>
                        </p>
                        <p className="num mt-1 flex flex-wrap items-center gap-x-2.5 text-[0.625rem] tracking-[0.06em] text-ink-4">
                          <span>{account.region}</span>
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
                          {account.teamName && <span>{account.teamName}</span>}
                        </p>
                        {account.error && (
                          <p className="mt-1.5 text-[0.75rem] text-blaze">
                            {account.error}
                          </p>
                        )}
                      </div>

                      {/* Bascule de sélection : un seul bouton, pas un menu. */}
                      <form action={moveBracketAction}>
                        <input type="hidden" name="id" value={account.id} />
                        <input
                          type="hidden"
                          name="bracket"
                          value={
                            account.bracket === "high-elo" ? "low-elo" : "high-elo"
                          }
                        />
                        <button
                          type="submit"
                          title="Basculer vers l'autre sélection"
                          className="num h-8 rounded-sm border border-hair px-2.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase transition-colors duration-150 hover:border-hair-3"
                          style={{
                            color:
                              account.bracket === "high-elo"
                                ? "var(--color-acid)"
                                : "var(--color-sky)",
                          }}
                        >
                          {account.bracket === "high-elo" ? "High elo" : "Low elo"}
                        </button>
                      </form>

                      {account.error && (
                        <form action={retryAccountAction}>
                          <input type="hidden" name="id" value={account.id} />
                          <button
                            type="submit"
                            title="Oublier le puuid et réessayer la résolution — à utiliser après un renommage"
                            className="num h-8 rounded-sm border border-hair px-2.5 text-[0.625rem] font-semibold tracking-[0.08em] uppercase text-ink-3 transition-colors duration-150 hover:border-acid/50 hover:text-acid"
                          >
                            Réessayer
                          </button>
                        </form>
                      )}

                      <form action={removeAccountAction}>
                        <input type="hidden" name="id" value={account.id} />
                        <button
                          type="submit"
                          title={`Retirer ${account.gameName}#${account.tagLine} et son historique`}
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

          {store.lastSyncError && (
            <p className="mt-6 rounded-md border border-blaze/40 bg-blaze/8 px-4 py-3 text-[0.8125rem] text-blaze">
              Dernier relevé : {store.lastSyncError}
            </p>
          )}
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
