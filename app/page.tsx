import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
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
  if (session?.user) redirect("/ladders");

  return (
    <>
      <Header />
      <main className="flex-1 pb-24">
        <div className="shell max-w-2xl pt-20 md:pt-28">
          <p className="label">SoloQ entre amis</p>
          <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-bold tracking-[-0.03em] text-ink md:text-[3.5rem]">
            Le classement de ton groupe
            <span className="text-acid">.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
            Connecte-toi avec Discord, crée un ladder, ajoute ton compte et
            ceux de tes amis. Rang, historique et forme se mettent à jour
            tout seuls — et si un de tes comptes est déjà suivi ailleurs, tu
            le retrouves automatiquement dans « mes ladders ».
          </p>

          <form action={signInWithDiscord} className="mt-8">
            <button
              type="submit"
              className="num h-11 rounded-sm bg-acid px-6 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110"
            >
              Se connecter avec Discord
            </button>
          </form>

          <dl className="mt-14 grid gap-8 sm:grid-cols-3">
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
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
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
