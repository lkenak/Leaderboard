import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { primaryLadderFor } from "@/lib/db/users";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { LadderRiver } from "@/components/site/LadderRiver";
import { Footer } from "@/components/site/Footer";
import { signInWithDiscord } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "Classements SoloQ entre amis : connecte-toi avec Discord, crée ton ladder, ajoute tes comptes et ceux de tes potes.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  await connection();
  const now = reportedNow();
  const session = await auth();
  if (session?.user) {
    /* Connecté, on atterrit sur du classement, pas sur une page de gestion :
       son ladder d'accueil, ou `/ladders` s'il n'en a encore aucun (la page
       propose alors d'en créer un). */
    const home = primaryLadderFor(session.user.id);
    redirect(home ? `/l/${home.slug}` : "/ladders");
  }

  return (
    <>
      <Header />
      <main className="flex-1 pb-24">
        {/* La hauteur est portée par le contenu, pas par une valeur fixe : le
            décor se cale dessus, jamais l'inverse. */}
        <section className="relative flex min-h-[34rem] items-center overflow-hidden">
          <LadderRiver />

          <div className="shell relative pt-20 pb-20 md:pt-28 md:pb-28">
            <div className="max-w-2xl">
              <p className="label">SoloQ entre amis</p>
              <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-bold tracking-[-0.03em] text-ink md:text-[3.5rem]">
                Le classement de ton groupe
                <span className="text-acid">.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
                Un ladder privé pour ta bande : rang, LP, forme et historique
                de chacun, relevés tout seuls. Le classement se recalcule à
                chaque partie terminée, et un bot Discord l&apos;affiche dans
                ton serveur.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <form action={signInWithDiscord}>
                  <button
                    type="submit"
                    className="num h-11 rounded-sm bg-acid px-6 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110"
                  >
                    Se connecter avec Discord
                  </button>
                </form>
                <p className="num text-[0.75rem] text-ink-4">
                  Gratuit · aucune inscription séparée
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Ce que le produit fait, une fois qu'on a compris ce que c'est. */}
        <div className="shell max-w-5xl">
          <dl className="grid gap-8 border-t border-hair pt-12 sm:grid-cols-3">
            <Step n="1" title="Connexion">
              Un compte Discord suffit — pas d&apos;inscription séparée.
            </Step>
            <Step n="2" title="Créer un ladder">
              Nomme-le, ajoute ton Riot ID et ceux de tes amis.
            </Step>
            <Step n="3" title="Suivre">
              Rang, LP, forme et historique se relèvent automatiquement.
            </Step>
          </dl>

          <div className="mt-12 grid gap-8 border-t border-hair pt-12 sm:grid-cols-3">
            <Feature title="Une échelle unique">
              Les LP sont ramenés de Fer&nbsp;IV à Challenger sur une seule
              échelle : deux joueurs de paliers différents se comparent
              vraiment.
            </Feature>
            <Feature title="Dans ton Discord">
              Le bot affiche le classement, organise les parties
              personnalisées et poste un compte rendu après chaque partie
              classée.
            </Feature>
            <Feature title="Sans rien réclamer">
              Aucune installation, aucun accès à ton compte Riot — seulement
              des données publiques, relevées pour toi.
            </Feature>
          </div>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[0.9375rem] font-semibold text-ink">{title}</p>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-3">
        {children}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="num flex size-7 items-center justify-center rounded-xs bg-panel-3 text-[0.75rem] font-semibold text-ink-2">
        {n}
      </span>
      <p className="mt-3 text-[0.9375rem] font-semibold text-ink">{title}</p>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-ink-3">
        {children}
      </p>
    </div>
  );
}
