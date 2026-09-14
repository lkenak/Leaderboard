"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

const NAV = [
  { href: "/ranking", label: "Classement", ready: true },
  { href: "/live", label: "Live", ready: false },
  { href: "/equipes", label: "Équipes", ready: false },
  { href: "/historique", label: "Historique", ready: false },
  { href: "/tierlist", label: "Tier list", ready: false },
] as const;

/**
 * En-tête collant. Le fond ne devient opaque qu'après 8 px de défilement : au
 * repos, l'en-tête est posé sur la page ; en défilement, il s'en détache par un
 * filet et un fond, sans flou — le flou brouille le tableau qui passe dessous.
 */
export function Header({ liveCount }: { liveCount: number }) {
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
        <Link
          href="/ranking"
          className="rounded-xs"
          aria-label="SOLOQ/LADDER — accueil"
        >
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.href === "/ranking" ? "page" : undefined}
                className={cn(
                  "relative rounded-xs px-3 py-2 text-[0.8125rem] font-medium transition-colors duration-150",
                  item.href === "/ranking"
                    ? "text-ink"
                    : "text-ink-3 hover:text-ink",
                )}
              >
                {item.label}
                {item.href === "/ranking" && (
                  <span className="absolute inset-x-3 -bottom-px h-[2px] bg-acid" />
                )}
              </Link>
            ) : (
              <span
                key={item.href}
                aria-disabled
                title="Bientôt"
                className="flex cursor-default items-center gap-1.5 rounded-xs px-3 py-2 text-[0.8125rem] font-medium text-ink-4"
              >
                {item.label}
                <span className="num rounded-[2px] bg-panel-3 px-1 py-px text-[0.5625rem] font-medium tracking-[0.08em] text-ink-3">
                  SOON
                </span>
              </span>
            ),
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-sm border border-hair bg-panel/60 px-2.5 py-1.5 sm:flex">
            <span className="relative flex size-[6px]">
              <span className="absolute inset-0 animate-pulse-dot rounded-full bg-screen" />
            </span>
            <span className="num text-micro font-medium tracking-[0.1em] text-ink-2">
              {liveCount} EN JEU
            </span>
          </span>

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
                <path
                  d="M0 1h15M0 5.5h15M0 10h11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="border-t border-hair bg-base md:hidden"
          aria-label="Navigation principale"
        >
          <ul className="shell flex flex-col py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                {item.ready ? (
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-3 text-[0.9375rem] font-medium text-ink"
                  >
                    {item.label}
                    {item.href === "/ranking" && (
                      <span className="size-1.5 rounded-full bg-acid" />
                    )}
                  </Link>
                ) : (
                  <span className="flex items-center justify-between py-3 text-[0.9375rem] font-medium text-ink-4">
                    {item.label}
                    <span className="num rounded-[2px] bg-panel-3 px-1.5 py-0.5 text-[0.5625rem] tracking-[0.08em] text-ink-3">
                      SOON
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
