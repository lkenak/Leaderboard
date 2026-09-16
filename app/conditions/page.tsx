import type { Metadata } from "next";
import { connection } from "next/server";
import { headerContext } from "@/lib/header";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = { title: "Conditions d'utilisation" };
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  await connection();
  const now = reportedNow();
  const { user, ladders } = await headerContext();

  return (
    <>
      <Header ladders={ladders} user={user} />
      <main className="flex-1 pb-24">
        <div className="shell max-w-2xl pt-16 md:pt-20">
          <p className="label">Conditions</p>
          <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
            Conditions d&apos;utilisation
          </h1>
          <p className="mt-4 text-[0.8125rem] italic text-ink-4">
            Summary for reviewers: a free, non-commercial, read-only companion
            site and Discord bot for tracking League of Legends Solo Queue rank
            among a self-chosen group of accounts, and for organising custom
            games between them. No gameplay automation, no write access to Riot
            services, provided as-is with no guarantee of uptime or accuracy.
            Not affiliated with Riot Games or Discord.
          </p>

          <div className="mt-10 flex flex-col gap-8 text-[0.875rem] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-sub font-semibold text-ink">Le service</h2>
              <p className="mt-3">
                SOLOQ/LADDER est un site créé par un joueur, pour suivre le
                classement SoloQ League of Legends d&apos;un groupe choisi de
                comptes. Il lit des données publiques via l&apos;API Riot Games
                et les affiche sous forme de classement, sans jamais écrire ni
                agir sur un compte Riot, une partie ou un client de jeu.
              </p>
              <p className="mt-3">
                Un <strong className="text-ink">bot Discord</strong> accompagne
                le site. Invité sur un serveur, il y affiche ces mêmes
                classements et permet d&apos;organiser des parties
                personnalisées entre joueurs. Il n&apos;ajoute aucune donnée
                nouvelle sur les comptes Riot : il présente celles que le site
                a déjà relevées. L&apos;inviter, le configurer et le retirer
                sont à la main des administrateurs du serveur.
              </p>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">
                Utilisation acceptée
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  Créer un ladder et y ajouter des Riot ID suppose que tu as le
                  droit de les y faire figurer (le tien, ceux de tes amis avec
                  leur accord) — aucune vérification de propriété n&apos;est
                  faite, c&apos;est à toi d&apos;en être responsable.
                </li>
                <li>
                  Le site ne doit pas être utilisé pour harceler, traquer ou
                  identifier une personne à partir d&apos;informations qu&apos;elle
                  n&apos;a pas rendues publiques elle-même.
                </li>
                <li>
                  Aucune automatisation de jeu, aucun script tiers, aucune
                  tentative de solliciter l&apos;API Riot autrement qu&apos;à
                  travers le site lui-même.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">
                Ce que tu peux attendre du service
              </h2>
              <p className="mt-3">
                C&apos;est un projet personnel, gratuit, sans engagement de
                disponibilité ni d&apos;exactitude. Les données affichées
                dépendent de l&apos;API Riot Games, qui peut être en panne, en
                retard, ou changer sans préavis. Un ladder et son historique
                peuvent être retirés par leur propriétaire à tout moment.
              </p>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">
                Propriété et affiliation
              </h2>
              <p className="mt-3">
                SOLOQ/LADDER n&apos;est ni approuvé, ni sponsorisé, ni affilié à
                Riot Games ou à Discord. League of Legends est une marque
                déposée de Riot Games, Inc. Le code source est disponible sur{" "}
                <a
                  href="https://github.com/lkenak/Leaderboard"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-acid underline decoration-acid/40 underline-offset-2"
                >
                  GitHub
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">Modifications</h2>
              <p className="mt-3">
                Ces conditions peuvent évoluer avec le site. Pour toute
                question,{" "}
                <a
                  href="https://github.com/lkenak/Leaderboard/issues"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-acid underline decoration-acid/40 underline-offset-2"
                >
                  ouvre une issue sur le dépôt GitHub
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
