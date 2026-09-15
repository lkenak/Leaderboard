import Link from "next/link";
import { Logo } from "./Logo";

/**
 * Pied de page. Il ne liste que des destinations qui existent.
 *
 * Il portait trois colonnes de quatre entrées, dont onze étaient des `<span>`
 * inertes — sans destination, sans mention « bientôt », et pourtant dotées d'un
 * effet de survol. Une fausse affordance est pire qu'un lien mort : elle invite
 * le clic. Les colonnes existaient parce qu'un pied de page a des colonnes,
 * pas parce que le site avait de quoi les remplir (DESIGN.md § 10).
 *
 * Restent donc : les deux liens internes réels, les deux sources de données
 * qui sont de vrais liens externes, et les sections à venir regroupées sous la
 * même convention `SOON` que la navigation de l'en-tête.
 */

/** Sections annoncées dans la navigation mais pas encore livrées. */
const SOON = ["Live", "Équipes", "Historique", "Tier list"];

export function Footer({ updatedLabel }: { updatedLabel: string }) {
  return (
    <footer className="mt-24 border-t border-hair">
      <div className="shell grid gap-10 py-10 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <Logo />
          <p className="mt-4 max-w-sm text-[0.8125rem] leading-relaxed text-ink-3">
            Suivi de classement SoloQ pour un plateau de joueurs choisi. Les
            rangs, les parties et les variations de LP sont relevés en continu et
            recalculés à chaque partie terminée.
          </p>
          <p className="num mt-4 text-micro tracking-[0.1em] text-ink-4">
            RELEVÉ · {updatedLabel}
          </p>
        </div>

        <nav className="md:col-span-3" aria-label="Pages">
          <h2 className="label">Pages</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <FooterLink href="/ranking">Classement</FooterLink>
            </li>
            <li>
              <FooterLink href="/admin">Plateau suivi</FooterLink>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <h2 className="label">Sources</h2>
          <ul className="mt-3 space-y-2">
            <li>
              <FooterLink href="https://developer.riotgames.com/" external>
                API Riot Games
              </FooterLink>
            </li>
            <li>
              <FooterLink
                href="https://developer.riotgames.com/docs/lol#data-dragon"
                external
              >
                Data Dragon
              </FooterLink>
            </li>
          </ul>

          <h2 className="label mt-6">Bientôt</h2>
          <p className="mt-3 flex flex-wrap gap-1.5">
            {SOON.map((item) => (
              <span
                key={item}
                className="num rounded-[2px] bg-panel-3 px-1.5 py-1 text-[0.5625rem] font-medium tracking-[0.08em] text-ink-3"
              >
                {item.toUpperCase()}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="border-t border-hair">
        <div className="shell flex flex-col gap-2 py-5 text-[0.75rem] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            SOLOQ/LADDER n&apos;est ni approuvé par Riot Games ni lié de quelque
            manière que ce soit à Riot Games. League of Legends est une marque
            déposée de Riot Games, Inc.
          </p>
          <p className="num tracking-[0.08em]">© 2026</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  external = false,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "text-[0.8125rem] text-ink-3 transition-colors duration-150 hover:text-acid";

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
