import type { Metadata } from "next";
import { connection } from "next/server";
import { headerContext } from "@/lib/header";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export const metadata: Metadata = { title: "Confidentialité" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  await connection();
  const now = reportedNow();
  const { user, ladders } = await headerContext();

  return (
    <>
      <Header ladders={ladders} user={user} />
      <main className="flex-1 pb-24">
        <div className="shell max-w-2xl pt-16 md:pt-20">
          <p className="label">Confidentialité</p>
          <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
            Politique de confidentialité
          </h1>
          <p className="mt-4 text-[0.8125rem] italic text-ink-4">
            Summary for reviewers: this is a small hobby project. It stores your
            Discord profile (for login), the Riot IDs you choose to track, and
            the corresponding public Riot API data (rank, matches, live status).
            Nothing is sold, shared with advertisers, or used to de-anonymize
            anyone — data shown is limited to Riot IDs explicitly entered by a
            user.
          </p>

          <div className="mt-10 flex flex-col gap-8 text-[0.875rem] leading-relaxed text-ink-2">
            <section>
              <h2 className="text-sub font-semibold text-ink">
                Ce que le site enregistre
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-ink">Ton compte Discord</strong> —
                  identifiant, pseudo et avatar, fournis par Discord au moment de
                  la connexion. Le site n&apos;a accès à rien d&apos;autre sur
                  ton compte Discord (pas tes messages, pas tes serveurs, pas ton
                  e-mail).
                </li>
                <li>
                  <strong className="text-ink">Les Riot ID que tu ajoutes</strong>{" "}
                  (les tiens ou ceux de tes amis) — région, pseudo, tag.
                </li>
                <li>
                  <strong className="text-ink">Les données publiques Riot</strong>{" "}
                  associées à ces comptes une fois relevées : palier, LP,
                  historique de parties classées, champions joués, état « en
                  partie », icône de profil, niveau. Elles proviennent de l&apos;API
                  Riot Games et sont mises en cache pour éviter de la solliciter à
                  chaque page.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">Pourquoi</h2>
              <p className="mt-3">
                Uniquement pour faire fonctionner les ladders : afficher un
                classement, calculer les variations de LP, et te permettre de
                retrouver dans quels ladders un compte que tu as déclaré comme
                tien apparaît.
              </p>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">
                Ce qui n&apos;est jamais fait
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Aucune donnée n&apos;est vendue ni partagée avec un tiers publicitaire.</li>
                <li>Aucun cookie de suivi ou de mesure d&apos;audience.</li>
                <li>
                  Aucune fonction de recherche qui permettrait de retrouver un
                  joueur autrement qu&apos;en connaissant déjà son Riot ID exact —
                  le site ne sert pas à désanonymiser qui que ce soit.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">
                Conservation et suppression
              </h2>
              <p className="mt-3">
                Un compte Riot retiré de tous les ladders qui le référencent (et
                de « mes comptes » de tout utilisateur) voit son historique
                supprimé automatiquement. Pour supprimer ton compte Discord ou
                demander la suppression complète de tes données, ouvre une
                demande sur le dépôt du projet.
              </p>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">Tiers sollicités</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-ink">Riot Games</strong> (API League of
                  Legends) — pour les données de classement.
                </li>
                <li>
                  <strong className="text-ink">Discord</strong> (OAuth) — pour la
                  connexion uniquement.
                </li>
                <li>
                  <strong className="text-ink">Data Dragon / Community Dragon</strong>{" "}
                  (Riot Games) et <strong className="text-ink">flagcdn.com</strong> —
                  pour les images (emblèmes, champions, drapeaux).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-sub font-semibold text-ink">Contact</h2>
              <p className="mt-3">
                Ce site est un projet personnel, non affilié à Riot Games ni à
                Discord. Pour toute question ou demande liée à tes données,{" "}
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
