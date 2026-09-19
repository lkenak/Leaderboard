import Image from "next/image";
import { emblemSrc, rankLabel } from "@/lib/lol";
import { agoLabel, signed } from "@/lib/format";
import { Delta } from "@/components/ui/Delta";
import { FormStrip } from "@/components/ui/FormStrip";
import { Crest } from "@/components/ui/Crest";
import type { RankingSnapshot } from "@/lib/types";

/**
 * En-tête de page volontairement asymétrique : le titre occupe la colonne
 * large, le leader du jour occupe une carte à droite avec son emblème de palier
 * en filigrane. Une grille de deux blocs de même poids donnerait l'« effet
 * inventaire » qu'on cherche justement à éviter en haut de page.
 */
export function PageHeader({
  snapshot,
  ladderName,
  now,
}: {
  snapshot: RankingSnapshot;
  ladderName: string;
  now: number;
}) {
  /* Un ladder peut être vide — tout juste créé, comptes non encore résolus.
     Le titre et les compteurs restent affichés : c'est ce qui distingue
     « rien à montrer pour l'instant » d'une page cassée. */
  const leader = snapshot.entries.at(0);
  const dayGames = snapshot.entries.reduce((a, e) => a + e.session.games, 0);
  /* Seuls les joueurs dont la variation est *mesurée* peuvent figurer au
     palmarès. Rabattre une variation inconnue sur 0 la faisait concourir comme
     si elle valait zéro, et un joueur sans données pouvait se retrouver
     désigné « meilleure progression » à +0 LP. */
  const mesures = snapshot.entries.filter((e) => e.session.lp !== null);
  const byDay = (dir: 1 | -1) =>
    [...mesures].sort(
      (a, b) => ((b.session.lp ?? 0) - (a.session.lp ?? 0)) * dir,
    )[0];
  const best = byDay(1);
  const worst = byDay(-1);
  const longestStreak = [...snapshot.entries]
    .filter((e) => e.streak.count > 0)
    .sort((a, b) => b.streak.count - a.streak.count)[0];
  /* Il faut de quoi remplir les trois cases, et deux joueurs distincts pour
     que « meilleure » et « pire » ne désignent pas la même personne. */
  const hasFacts = Boolean(
    best && worst && longestStreak && best !== worst,
  );

  return (
    <section className="pt-10 md:pt-14">
      <div className="shell">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* — Titre — */}
          <div className="lg:col-span-7 xl:col-span-8">
            <p className="label">
              Classement · {snapshot.splitName}
            </p>
            <h1 className="mt-4 text-[2.25rem] leading-[0.98] font-bold tracking-[-0.03em] text-ink md:text-[3.25rem]">
              {ladderName}
              <span className="text-acid">.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
              Rang, LP, forme et bilan des dernières 24 h de chaque membre,
              relevés automatiquement. Le classement se recalcule à chaque
              partie terminée.
            </p>

            <dl className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Meta label="Joueurs" value={String(snapshot.entries.length)} />
              <Meta label="Parties 24 h" value={String(dayGames)} />
              <Meta
                label="Relevé"
                value={agoLabel(snapshot.updatedAt, now)}
                live
              />
            </dl>
          </div>

          {/* — Leader du jour — */}
          {leader && (
          <div className="lg:col-span-5 xl:col-span-4">
            <article className="grain relative overflow-hidden rounded-lg border border-hair bg-panel">
              <span className="grain-layer" />
              {/* L'emblème sert de matière, pas d'illustration : très sombre,
                  coupé par le bord de la carte.

                  Les fichiers sont en 16:9 (1280x720 ou 2560x1440), avec le
                  crest posé au centre d'un cadre presque vide. Les afficher
                  dans une boîte carrée sans `object-cover` les étire — c'est
                  `fill` par défaut sur un <img> — et le crest ressort étroit et
                  haut. `object-cover` rogne les marges vides au lieu de
                  déformer le dessin ; `object-contain` ne conviendrait pas ici,
                  il ferait entrer tout le cadre vide et réduirait le crest au
                  quart de sa taille. */}
              <Image
                src={emblemSrc(leader.rank.tier)}
                alt=""
                width={373}
                height={210}
                aria-hidden
                className="pointer-events-none absolute -top-6 -right-8 size-[210px] object-cover opacity-[0.2] select-none"
              />

              <div className="relative p-5">
                <div className="flex items-center justify-between">
                  <span className="label">Leader</span>
                  <span className="num rounded-xs bg-acid px-1.5 py-1 text-nano font-semibold tracking-[0.1em] text-acid-ink">
                    #1
                  </span>
                </div>

                <p className="mt-4 text-[1.5rem] leading-none font-semibold tracking-[-0.02em] text-ink">
                  {leader.player.gameName}
                  <span className="num ml-1 text-[0.875rem] font-normal text-ink-4">
                    #{leader.player.tagLine}
                  </span>
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Crest tier={leader.rank.tier} size={22} />
                  <span className="text-[0.8125rem] font-medium text-ink-2">
                    {rankLabel(leader.rank)}
                  </span>
                  <span className="num text-[0.8125rem] font-semibold text-ink tabular-nums">
                    {leader.rank.leaguePoints} LP
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-hair bg-hair">
                  <Cell label="24 h">
                    <Delta value={leader.session.lp} unit={null} />
                  </Cell>
                  <Cell label="Winrate">
                    <span className="num text-num font-medium text-ink tabular-nums">
                      {leader.winrate}%
                    </span>
                  </Cell>
                  <Cell label="Forme">
                    <FormStrip form={leader.form} />
                  </Cell>
                </div>
              </div>
            </article>
          </div>
          )}
        </div>

        {/* — Bandeau de faits du jour : trois faits, séparés par des filets — */}
        {hasFacts && (
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-hair bg-hair sm:grid-cols-3">
          <Fact
            label="Meilleure progression"
            name={best.player.gameName}
            value={`${signed(best.session.lp ?? 0)} LP`}
            tone="up"
          />
          <Fact
            label="Plus forte chute"
            name={worst.player.gameName}
            value={`${signed(worst.session.lp ?? 0)} LP`}
            tone="down"
          />
          <Fact
            label="Plus longue série"
            name={longestStreak.player.gameName}
            value={
              longestStreak.streak.type === "win"
                ? `${longestStreak.streak.count} victoires`
                : `${longestStreak.streak.count} défaites`
            }
            tone={longestStreak.streak.type === "win" ? "up" : "down"}
          />
        </div>
        )}
      </div>
    </section>
  );
}

function Meta({
  label,
  value,
  live,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-2 flex items-center gap-1.5 text-[0.9375rem] font-medium text-ink tabular-nums">
        {live && (
          <span className="size-[5px] animate-pulse-dot rounded-full bg-acid" />
        )}
        {value}
      </dd>
    </div>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 bg-panel px-3 py-2.5">
      <span className="label text-[0.5625rem]">{label}</span>
      <span className="flex h-4 items-center">{children}</span>
    </div>
  );
}

function Fact({
  label,
  name,
  value,
  tone,
}: {
  label: string;
  name: string;
  value: string;
  tone: "up" | "down";
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-panel px-5 py-4">
      <div className="min-w-0">
        <p className="label">{label}</p>
        <p className="mt-2 truncate text-[0.9375rem] font-medium text-ink">
          {name}
        </p>
      </div>
      <p
        className={`num shrink-0 text-[1.0625rem] font-semibold tabular-nums ${
          tone === "up" ? "text-acid" : "text-blaze"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
