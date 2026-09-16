import type { Metadata } from "next";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { signInWithDiscord } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await connection();
  const now = reportedNow();
  const session = await auth();
  const { from } = await searchParams;
  // `/` décide où atterrir (le ladder d'accueil), pour ne pas dupliquer ici la
  // règle de choix du ladder.
  if (session?.user) redirect(from || "/");

  return (
    <>
      <Header />
      <main className="flex-1 pb-24">
        <div className="shell max-w-md pt-24">
          <p className="label">Connexion</p>
          <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
            Se connecter
          </h1>
          <p className="mt-4 text-[0.875rem] leading-relaxed text-ink-3">
            Connecte-toi avec Discord pour créer ton propre ladder, y ajouter
            tes comptes et ceux de tes amis, et voir dans quels ladders tu
            apparais déjà.
          </p>
          <form action={signInWithDiscord} className="mt-8">
            <button
              type="submit"
              className="num h-11 w-full rounded-sm bg-acid px-5 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110"
            >
              Se connecter avec Discord
            </button>
          </form>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
