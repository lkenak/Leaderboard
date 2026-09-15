import { cn } from "@/lib/cn";
import { agoLabel, signed, thousands } from "@/lib/format";
import type { RankingSnapshot } from "@/lib/types";
import { CutoffWidget, Countdown } from "./Widgets";

/**
 * En-tête de page volontairement asymétrique : le titre occupe la colonne
 * large, les deux repères de contexte (la coupe apex, la fin du split) la
 * colonne étroite. Une grille de deux blocs de même poids donnerait l'« effet
 * inventaire » qu'on cherche justement à éviter en haut de page.
 *
 * La colonne étroite portait une carte « Leader ». Elle est partie : le podium
 * juste en dessous montre déjà les trois premiers, et la première ligne du
 * tableau montre le premier une troisième fois. Trois affichages du même joueur
 * avant la première réponse, c'est deux de trop (DESIGN.md § 1). La coupe et le
 * compte à rebours, eux, ne sont nulle part ailleurs — et ils étaient enterrés
 * dans le chapeau du tableau derrière un `hidden lg:block`, donc invisibles sur
 * la moitié des écrans.
 */
export function PageHeader({
  snapshot,
  now,
  serverNow,
}: {
  snapshot: RankingSnapshot;
  now: number;
  serverNow: number;
}) {
  /* Une sélection peut être vide — plateau tout juste créé, comptes non encore
     résolus, ou tous les joueurs rangés dans l'autre sélection. Le titre et les
     compteurs restent affichés : c'est ce qui distingue « rien à montrer pour
     l'instant » d'une page cassée. */
  const dayGames = snapshot.entries.reduce((a, e) => a + e.session.games, 0);
  const lpTraded = snapshot.entries.reduce(
    (a, e) => a + Math.abs(e.session.lp ?? 0),
    0,
  );

  const aside = snapshot.cutoff !== null || snapshot.splitEndsAt !== null;

  return (
    <section className="pt-10 md:pt-14">
      <div className="shell">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className={aside ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"}>
            <p className="label">Classement · {snapshot.splitName}</p>
            <h1 className="mt-4 text-[2.25rem] leading-[0.98] font-bold tracking-[-0.03em] text-ink md:text-[3.25rem]">
              {snapshot.bracketId === "high-elo" ? "High elo" : "Low elo"}
              <span className="text-acid">.</span>
            </h1>
            <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-ink-2">
              Le classement se recalcule à chaque partie terminée. Les LP sont
              ramenés à une échelle unique de Fer&nbsp;IV à Challenger, ce qui
              permet de comparer deux joueurs qui ne sont pas dans le même
              palier.
            </p>

            <dl className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Meta label="Joueurs" value={String(snapshot.entries.length)} />
              <Meta label="Parties 24 h" value={String(dayGames)} />
              <Meta label="LP échangés" value={thousands(lpTraded)} />
              <Meta label="Relevé" value={agoLabel(snapshot.updatedAt, now)} />
            </dl>
          </div>

          {aside && (
            <div className="flex flex-col gap-3 lg:col-span-5 xl:col-span-4">
              {snapshot.cutoff && (
                <CutoffWidget
                  challenger={snapshot.cutoff.challenger}
                  grandmaster={snapshot.cutoff.grandmaster}
                  className="w-full justify-between"
                />
              )}
              {snapshot.splitEndsAt !== null && (
                <Countdown
                  endsAt={snapshot.splitEndsAt}
                  serverNow={serverNow}
                  className="w-full justify-between"
                />
              )}
            </div>
          )}
        </div>

        <Facts snapshot={snapshot} dayGames={dayGames} />
      </div>
    </section>
  );
}

/**
 * Faits de la journée. Chaque fait doit être *vrai* pour s'afficher :
 *
 * - une progression n'en est une qu'au-dessus de zéro,
 * - une chute qu'en dessous,
 * - une série qu'à partir de deux parties de suite.
 *
 * Le bandeau affichait les trois inconditionnellement dès qu'il existait une
 * entrée, donc « Meilleure progression · +0 LP » trois fois de suite en début
 * de journée : trois faits inventés par un tri sur une liste de zéros
 * (DESIGN.md § 9). Il ne reste ici que ce qui s'est réellement passé, et le
 * bandeau disparaît quand il n'y a rien à dire.
 */
function Facts({
  snapshot,
  dayGames,
}: {
  snapshot: RankingSnapshot;
  dayGames: number;
}) {
  if (dayGames === 0) return null;

  const played = snapshot.entries.filter((e) => e.session.games > 0);
  const byLp = (dir: 1 | -1) =>
    [...played].sort((a, b) => ((b.session.lp ?? 0) - (a.session.lp ?? 0)) * dir)[0];

  const best = byLp(1);
  const worst = byLp(-1);
  const streak = [...snapshot.entries].sort(
    (a, b) => b.streak.count - a.streak.count,
  )[0];

  const facts: Array<{
    label: string;
    name: string;
    value: string;
    tone: "up" | "down";
  }> = [];

  if (best && (best.session.lp ?? 0) > 0) {
    facts.push({
      label: "Meilleure progression",
      name: best.player.gameName,
      value: `${signed(best.session.lp ?? 0)} LP`,
      tone: "up",
    });
  }
  if (worst && (worst.session.lp ?? 0) < 0) {
    facts.push({
      label: "Plus forte chute",
      name: worst.player.gameName,
      value: `${signed(worst.session.lp ?? 0)} LP`,
      tone: "down",
    });
  }
  if (streak && streak.streak.count >= 2) {
    facts.push({
      label: "Plus longue série",
      name: streak.player.gameName,
      value:
        streak.streak.type === "win"
          ? `${streak.streak.count} victoires`
          : `${streak.streak.count} défaites`,
      tone: streak.streak.type === "win" ? "up" : "down",
    });
  }

  if (facts.length === 0) return null;

  return (
    <div
      className={cn(
        "mt-10 grid gap-px overflow-hidden rounded-md border border-hair bg-hair",
        facts.length === 3
          ? "sm:grid-cols-3"
          : facts.length === 2
            ? "sm:grid-cols-2"
            : "",
      )}
    >
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex items-center justify-between gap-4 bg-panel px-5 py-4"
        >
          <div className="min-w-0">
            <p className="label">{f.label}</p>
            <p className="mt-2 truncate text-[0.9375rem] font-medium text-ink">
              {f.name}
            </p>
          </div>
          <p
            className={cn(
              "num shrink-0 text-[1.0625rem] font-semibold tabular-nums",
              f.tone === "up" ? "text-acid" : "text-blaze",
            )}
          >
            {f.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="num mt-2 text-[0.9375rem] font-medium text-ink tabular-nums">
        {value}
      </dd>
    </div>
  );
}
