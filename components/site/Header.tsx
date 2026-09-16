"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/actions/auth";
import { Popover } from "@/components/ui/Popover";
import { Logo } from "./Logo";

export interface HeaderUser {
  name: string;
  avatar: string | null;
}

export interface HeaderLadder {
  slug: string;
  name: string;
  owned: boolean;
}

/**
 * En-tête collant. Le fond ne devient opaque qu'après 8 px de défilement : au
 * repos, l'en-tête est posé sur la page ; en défilement, il s'en détache par un
 * filet et un fond, sans flou — le flou brouille le tableau qui passe dessous.
 *
 * Le site étant multi-ladder et l'accueil étant un classement, la nav porte un
 * **sélecteur de ladder** plutôt qu'un lien figé : c'est ce qui permet
 * d'atterrir sur du contenu et de passer d'un ladder à l'autre sans repasser
 * par une page de gestion.
 *
 * **Deux natures de navigation, deux endroits.** À gauche, se déplacer dans le
 * contenu : quel classement je regarde. À droite, sous l'avatar, tout ce qui
 * me concerne : mes comptes Riot, mes ladders, la déconnexion.
 *
 * Elles étaient mélangées — « Mes comptes Riot » se trouvait en bas du
 * sélecteur de ladder, donc à deux niveaux de profondeur, derrière un bouton
 * portant le nom d'un ladder. Quelqu'un qui arrivait sans ladder n'avait même
 * pas ce sélecteur, et la page de ses comptes n'était atteignable que par un
 * lien en petit dans un paragraphe de `/ladders`. Le menu du compte est
 * l'endroit où l'on cherche ses réglages ; il fallait qu'ils y soient.
 */
export function Header({
  liveCount,
  currentSlug,
  ladders = [],
  user,
}: {
  liveCount?: number;
  /** Slug du ladder consulté, s'il y en a un — surligné dans le sélecteur. */
  currentSlug?: string;
  ladders?: HeaderLadder[];
  user?: HeaderUser | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const current = ladders.find((l) => l.slug === currentSlug);
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[0.8125rem] transition-colors duration-150";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-200",
        scrolled
          ? "border-b border-hair bg-base/95 supports-[backdrop-filter]:bg-base/80 supports-[backdrop-filter]:backdrop-blur-sm"
          : "border-b border-transparent",
      )}
    >
      <div className="shell flex h-16 items-center gap-4">
        <Link href="/" className="rounded-xs" aria-label="SOLOQ/LADDER — accueil">
          <Logo />
        </Link>

        {user && (
          <nav className="hidden items-center gap-2 md:flex" aria-label="Navigation principale">
            {ladders.length > 0 ? (
              <Popover
                align="left"
                title="Changer de ladder"
                active={Boolean(current)}
                label={
                  <span className="max-w-[18ch] truncate">
                    {current ? current.name : "Mes ladders"}
                  </span>
                }
              >
                {(close) => (
                  <>
                    {ladders.map((l) => (
                      <Link
                        key={l.slug}
                        href={`/l/${l.slug}`}
                        onClick={close}
                        className={cn(
                          itemClass,
                          l.slug === currentSlug
                            ? "bg-acid/10 text-acid"
                            : "text-ink-2 hover:bg-panel-3 hover:text-ink",
                        )}
                      >
                        <span className="truncate">{l.name}</span>
                        {!l.owned && (
                          <span className="num ml-auto shrink-0 text-[0.5625rem] tracking-[0.08em] text-ink-4">
                            INVITÉ
                          </span>
                        )}
                      </Link>
                    ))}
                    <div className="my-1 h-px bg-hair" />
                    <Link
                      href="/ladders"
                      onClick={close}
                      className={cn(itemClass, "text-ink-3 hover:bg-panel-3 hover:text-ink")}
                    >
                      Tous mes ladders
                    </Link>
                  </>
                )}
              </Popover>
            ) : (
              <Link
                href="/ladders"
                className="rounded-xs px-3 py-2 text-[0.8125rem] font-medium text-ink-3 transition-colors duration-150 hover:text-ink"
              >
                Mes ladders
              </Link>
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {liveCount !== undefined && (
            <span className="hidden items-center gap-2 rounded-sm border border-hair bg-panel/60 px-2.5 py-1.5 sm:flex">
              <span className="relative flex size-[6px]">
                <span className="absolute inset-0 animate-pulse-dot rounded-full bg-screen" />
              </span>
              <span className="num text-micro font-medium tracking-[0.1em] text-ink-2">
                {liveCount} EN JEU
              </span>
            </span>
          )}

          {user ? (
            /* Le menu du compte. C'est ici qu'on cherche ses réglages, donc
               c'est ici que « Mes comptes Riot » doit être — et non au fond
               du sélecteur de ladder, où il était invisible. */
            <div className="hidden sm:block">
              <Popover
                align="right"
                title="Mon compte"
                label={
                  <span className="flex items-center gap-2">
                    {user.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element -- source distante, taille fixe, cf. components/ui/Avatar.tsx
                      <img
                        src={user.avatar}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 shrink-0 rounded-full ring-1 ring-hair"
                      />
                    )}
                    <span className="max-w-[12ch] truncate">{user.name}</span>
                  </span>
                }
              >
                {(close) => (
                  <>
                    <Link
                      href="/profil"
                      onClick={close}
                      className={cn(itemClass, "text-ink-2 hover:bg-panel-3 hover:text-ink")}
                    >
                      Mes comptes Riot
                    </Link>
                    <Link
                      href="/ladders"
                      onClick={close}
                      className={cn(itemClass, "text-ink-2 hover:bg-panel-3 hover:text-ink")}
                    >
                      Mes ladders
                    </Link>
                    <Link
                      href="/ladders/new"
                      onClick={close}
                      className={cn(itemClass, "text-ink-2 hover:bg-panel-3 hover:text-ink")}
                    >
                      Créer un ladder
                    </Link>
                    <div className="my-1 h-px bg-hair" />
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        className={cn(itemClass, "text-ink-4 hover:bg-panel-3 hover:text-ink-2")}
                      >
                        Déconnexion
                      </button>
                    </form>
                  </>
                )}
              </Popover>
            </div>
          ) : (
            <Link
              href="/login"
              className="num hidden h-9 items-center rounded-sm bg-acid px-4 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-acid-ink transition-[filter] duration-150 hover:brightness-110 sm:flex"
            >
              Se connecter
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Ouvrir le menu"
            className="grid size-9 place-items-center rounded-sm border border-hair text-ink-2 transition-colors duration-150 hover:text-ink md:hidden"
          >
            <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden>
              {open ? (
                <path
                  d="M1.5 1.5l12 8M13.5 1.5l-12 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              ) : (
                <path d="M0 1h15M0 5.5h15M0 10h11" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-hair bg-base md:hidden" aria-label="Navigation principale">
          <ul className="shell flex flex-col py-2">
            {user ? (
              <>
                {ladders.map((l) => (
                  <li key={l.slug}>
                    <Link
                      href={`/l/${l.slug}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between py-3 text-[0.9375rem] font-medium",
                        l.slug === currentSlug ? "text-ink" : "text-ink-2",
                      )}
                    >
                      <span className="truncate">{l.name}</span>
                      {l.slug === currentSlug && (
                        <span className="size-1.5 shrink-0 rounded-full bg-acid" />
                      )}
                    </Link>
                  </li>
                ))}
                {/* Même séparation qu'en grand écran : les ladders au-dessus
                    (du contenu), mon compte en dessous (des réglages). */}
                <li className="my-1 h-px bg-hair" aria-hidden />
                <li>
                  <Link
                    href="/ladders"
                    onClick={() => setOpen(false)}
                    className="flex items-center py-3 text-[0.9375rem] font-medium text-ink-2"
                  >
                    Tous mes ladders
                  </Link>
                </li>
                <li>
                  <Link
                    href="/ladders/new"
                    onClick={() => setOpen(false)}
                    className="flex items-center py-3 text-[0.9375rem] font-medium text-ink-2"
                  >
                    Créer un ladder
                  </Link>
                </li>
                <li className="my-1 h-px bg-hair" aria-hidden />
                <li>
                  <Link
                    href="/profil"
                    onClick={() => setOpen(false)}
                    className="flex items-center py-3 text-[0.9375rem] font-medium text-ink"
                  >
                    Mes comptes Riot
                  </Link>
                </li>
                <li>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center py-3 text-[0.9375rem] font-medium text-ink-4"
                    >
                      Déconnexion
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <li>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center py-3 text-[0.9375rem] font-medium text-ink"
                >
                  Se connecter
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
