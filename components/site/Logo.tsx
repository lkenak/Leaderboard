import { cn } from "@/lib/cn";

/**
 * Signature : un carré acide portant un chevron noir (la flèche de montée de
 * classement), puis le mot-valise en deux graisses. Le second terme est en
 * mono — c'est la police des chiffres du site, donc celle de la performance.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid size-7 place-items-center rounded-xs bg-acid">
        <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
          <path
            d="M6.5 1.6 11.4 9H8.9v2.4H4.1V9H1.6L6.5 1.6Z"
            fill="var(--color-acid-ink)"
          />
        </svg>
      </span>
      <span className="flex items-baseline gap-px leading-none">
        <span className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
          SOLOQ
        </span>
        <span className="num text-[1.0625rem] font-medium tracking-[-0.04em] text-acid">
          /
        </span>
        <span className="num text-[1.0625rem] font-normal tracking-[-0.02em] text-ink-2">
          LADDER
        </span>
      </span>
    </span>
  );
}
