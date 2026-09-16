import type { Metadata } from "next";
import { connection } from "next/server";
import { headerContext } from "@/lib/header";
import { clockTime } from "@/lib/format";
import { reportedNow } from "@/lib/now";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { createLadderAction } from "./actions";

export const metadata: Metadata = { title: "Nouveau ladder" };
export const dynamic = "force-dynamic";

export default async function NewLadderPage() {
  await connection();
  const now = reportedNow();
  const { user, ladders } = await headerContext();

  return (
    <>
      <Header ladders={ladders} user={user} />
      <main className="flex-1 pb-24">
        <div className="shell max-w-md pt-24">
          <p className="label">Nouveau ladder</p>
          <h1 className="mt-3 text-[2rem] leading-none font-bold tracking-[-0.03em] text-ink">
            Créer un ladder
          </h1>
          <p className="mt-4 text-[0.875rem] text-ink-3">
            Un nom suffit pour commencer — tu ajouteras ton compte et ceux de
            tes amis juste après.
          </p>

          <form action={createLadderAction} className="mt-8 flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="label">
                Nom du ladder
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                autoFocus
                placeholder="Les copains du mardi soir"
                className="mt-2 h-11 w-full rounded-sm border border-hair bg-panel-3/60 px-3 text-[0.9375rem] text-ink transition-colors duration-150 placeholder:text-ink-4 hover:border-hair-2 focus:border-acid/50"
              />
            </div>
            <button
              type="submit"
              className="num h-11 self-start rounded-sm bg-acid px-5 text-[0.75rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110"
            >
              Créer
            </button>
          </form>
        </div>
      </main>
      <Footer updatedLabel={clockTime(now)} />
    </>
  );
}
