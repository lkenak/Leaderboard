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
            Summary for reviewers: this is a small hobby project, made of a
            website and a Discord bot sharing one database. It stores your
            Discord profile (for login), the Riot IDs you choose to track, and
            the corresponding public Riot API data (rank, matches, live status).
            The bot additionally stores the guild and channel IDs it was
            configured for, and — for custom-game sign-ups — participant Discord
            IDs with their RSVP status. <strong>The bot requests only the
            Guilds intent and cannot read message content.</strong> Nothing is
            sold, shared with advertisers, or used to de-anonymize anyone — data
            shown is limited to Riot IDs explicitly entered by a user.
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
                  la connexion. Le site ne demande aucune autre autorisation sur
                  ton compte : ni ton e-mail, ni la liste de tes serveurs, ni
                  quoi que ce soit d&apos;autre.
                </li>
                <li>
                  <strong className="text-ink">
                    Ce que le bot Discord enregistre
                  </strong>{" "}
                  — quand il est invité sur un serveur : l&apos;identifiant du
                  serveur et celui du salon choisi pour ses messages, pour savoir
                  quel classement afficher et où. Quand quelqu&apos;un s&apos;inscrit à
                  une partie personnalisée : son identifiant Discord, son statut
                  (inscrit, liste d&apos;attente, indisponible) et, s&apos;il n&apos;a
                  pas lié de compte Riot, le palier et les postes qu&apos;il
                  déclare lui-même.
                  <br />
                  <strong className="text-ink">
                    Le bot ne lit aucun message.
                  </strong>{" "}
                  Il ne demande à Discord que l&apos;autorisation minimale
                  (<span className="num">Guilds</span>) : il reçoit les clics sur
                  ses propres boutons et les commandes qui lui sont adressées,
                  rien d&apos;autre. Il ne peut techniquement pas voir le contenu
                  des conversations, même dans les salons où il se trouve.
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
                supprimé automatiquement. Retirer le bot d&apos;un serveur, ou
                le délier avec <span className="num">/ladder delier</span>,
                efface la configuration de ce serveur. Pour supprimer ton compte
                Discord ou demander la suppression complète de tes données,
                ouvre une demande sur le dépôt du projet.
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
                  <strong className="text-ink">Discord</strong> — pour la
                  connexion au site (OAuth), et pour le bot : afficher les
                  classements et organiser les parties personnalisées dans les
                  serveurs qui l&apos;ont invité.
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
