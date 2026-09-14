import { cn } from "@/lib/cn";
import type { StreamerHandle } from "@/lib/types";

const BASE: Record<StreamerHandle["platform"], string> = {
  twitch: "https://twitch.tv/",
  kick: "https://kick.com/",
  youtube: "https://youtube.com/@",
};

const LABEL: Record<StreamerHandle["platform"], string> = {
  twitch: "Twitch",
  kick: "Kick",
  youtube: "YouTube",
};

/**
 * Lien de chaîne. Volontairement pas de violet Twitch ni de vert Kick : trois
 * couleurs de marque dans un tableau ruinent la hiérarchie. Le glyphe suffit à
 * identifier la plateforme, la couleur reste celle du texte secondaire.
 */
export function StreamLink({
  streamer,
  live = false,
  className,
}: {
  streamer: StreamerHandle;
  live?: boolean;
  className?: string;
}) {
  return (
    <a
      href={`${BASE[streamer.platform]}${streamer.login}`}
      target="_blank"
      rel="noreferrer noopener"
      title={`${LABEL[streamer.platform]} · ${streamer.login}`}
      className={cn(
        // 28 px au doigt, 24 px à la souris.
        "inline-flex size-7 shrink-0 items-center justify-center rounded-xs text-ink-3 transition-colors duration-150 hover:bg-panel-3 hover:text-ink md:size-6",
        live && "text-screen hover:text-screen",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {streamer.platform === "twitch" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M4.3 0 1 4.7v15.6h5.3V24l4.4-3.7h3.5L22 13V0H4.3Zm15.9 12.2-3.5 3.5h-3.5l-3 3v-3H6.3V1.8h13.9v10.4ZM17.6 5.2h-1.8v5.2h1.8V5.2Zm-4.8 0H11v5.2h1.8V5.2Z" />
        </svg>
      ) : streamer.platform === "kick" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M2 2h6.4v5.1h2.1V4.6h2.2V2H20v7.7h-2.1v2.6h-2.2v2.6h2.2v2.6H20V22h-7.3v-2.6h-2.2v-2.5H8.4V22H2V2Z" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
      )}
    </a>
  );
}
