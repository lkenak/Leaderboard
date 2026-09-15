import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Bandeau d'état, au-dessus du classement.
 *
 * Il n'apparaît que lorsqu'il a quelque chose à dire, et dit toujours *quoi
 * faire* plutôt que seulement ce qui manque : un tableau rempli de données
 * fictives sans avertissement est le pire des cas, on croit le site cassé
 * alors qu'il attend une clé.
 */
export function StatusBanner({
  tone,
  title,
  children,
  action,
}: {
  tone: "info" | "warn";
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="shell mt-6">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border px-4 py-3",
          tone === "warn"
            ? "border-blaze/35 bg-blaze/6"
            : "border-hair-2 bg-panel",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-[6px] shrink-0 rounded-full",
            tone === "warn" ? "bg-blaze" : "bg-acid",
          )}
        />
        <p className="text-[0.8125rem] text-ink-2">
          <strong
            className={cn(
              "font-semibold",
              tone === "warn" ? "text-blaze" : "text-ink",
            )}
          >
            {title}
          </strong>{" "}
          {children}
        </p>
        {action && (
          <Link
            href={action.href}
            className="num ml-auto shrink-0 rounded-sm border border-hair px-3 py-1.5 text-[0.625rem] font-semibold tracking-[0.1em] uppercase text-ink-2 transition-colors duration-150 hover:border-acid/50 hover:text-acid"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
