"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/actions/auth";
import { Logo } from "./Logo";

export interface HeaderUser {
  name: string;
  avatar: string | null;
}

/**
 * En-tête collant. Le fond ne devient opaque qu'après 8 px de défilement : au
 * repos, l'en-tête est posé sur la page ; en défilement, il s'en détache par un
 * filet et un fond, sans flou — le flou brouille le tableau qui passe dessous.
 *
 * Plus de nav figée sur « le » classement : le site est multi-ladder, donc le
 * seul lien constant est « Mes ladders », et le ladder consulté s'affiche
 * comme contexte de page plutôt que comme item de nav cliquable.
 */
export function Header({
  liveCount,
  ladderHref,
  ladderLabel,
  user,
}: {
  liveCount?: number;
  ladderHref?: string;
  ladderLabel?: string;
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

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-200",
        scrolled
          ? "border-b border-hair bg-base/95 supports-[backdrop-filter]:bg-base/80 supports-[backdrop-filter]:backdrop-blur-sm"
          : "border-b border-transparent",
      )}
    >
      <div className="shell flex h-16 items-center gap-6">
        <Link href="/" className="rounded-xs" aria-label="SOLOQ/LADDER — accueil">
          <Logo />
        </Link>

        {ladderHref && (
          <Link
            href={ladderHref}
            aria-current="page"
            className="relative hidden rounded-xs px-3 py-2 text-[0.8125rem] font-medium text-ink md:block"
          >
            {ladderLabel}
            <span className="absolute inset-x-3 -bottom-px h-[2px] bg-acid" />
          </Link>
        )}

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {user && (
            <Link
              href="/ladders"
              className="rounded-xs px-3 py-2 text-[0.8125rem] font-medium text-ink-3 transition-colors duration-150 hover:text-ink"
            >
              Mes ladders
            </Link>
          )}
        </nav>

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
            <div className="hidden items-center gap-2.5 sm:flex">
              {user.avatar && (
                // eslint-disable-next-line @next/next/no-img-element -- source distante, taille fixe, cf. components/ui/Avatar.tsx
                <img
                  src={user.avatar}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 shrink-0 rounded-full ring-1 ring-hair"
                />
              )}
              <span className="max-w-[10ch] truncate text-[0.8125rem] text-ink-2">
                {user.name}
              </span>
              {/* `contents` : le <form> ne doit pas devenir une boîte bloc qui
                  casse l'alignement flex de ses voisins (avatar, pseudo). */}
              <form action={signOutAction} className="contents">
                <button
                  type="submit"
                  className="num shrink-0 text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-ink-4 transition-colors duration-150 hover:text-ink-2"
                >
                  Déconnexion
                </button>
              </form>
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
            {ladderHref && (
              <li>
                <Link
                  href={ladderHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between py-3 text-[0.9375rem] font-medium text-ink"
                >
                  {ladderLabel}
                  <span className="size-1.5 rounded-full bg-acid" />
                </Link>
              </li>
            )}
            {user ? (
              <>
                <li>
                  <Link
                    href="/ladders"
                    onClick={() => setOpen(false)}
                    className="flex items-center py-3 text-[0.9375rem] font-medium text-ink"
                  >
                    Mes ladders
                  </Link>
                </li>
                <li>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center py-3 text-[0.9375rem] font-medium text-ink-3"
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
