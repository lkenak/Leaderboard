"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Menu déroulant minimal : positionné en flux (pas de portail), refermé au
 * clic extérieur, à Échap et à la perte de focus clavier. Écrire ces trente
 * lignes coûte moins qu'embarquer une librairie de primitives pour deux menus.
 */
export function Popover({
  label,
  title,
  children,
  align = "right",
  active = false,
}: {
  label: ReactNode;
  title?: string;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        title={title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-[0.75rem] font-medium transition-colors duration-150",
          active || open
            ? "border-acid/45 bg-acid/10 text-acid"
            : "border-hair bg-panel-3/60 text-ink-2 hover:border-hair-2 hover:text-ink",
        )}
      >
        {label}
        <svg width="7" height="4" viewBox="0 0 7 4" aria-hidden className="opacity-60">
          <path d="M3.5 4 0 0h7z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+6px)] z-40 min-w-[200px] overflow-hidden rounded-md border border-hair-2 bg-panel p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.6)]",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ animation: "rise 0.16s var(--ease-out-quint) both" }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function PopoverItem({
  selected,
  onSelect,
  children,
}: {
  selected?: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-[0.8125rem] transition-colors duration-150",
        selected
          ? "bg-acid/10 text-acid"
          : "text-ink-2 hover:bg-panel-3 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
