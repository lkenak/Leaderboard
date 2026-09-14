import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SOLOQ/LADDER — classement SoloQ en direct",
    template: "%s · SOLOQ/LADDER",
  },
  description:
    "Suivi de classement League of Legends SoloQ : LP, forme, séries et historique de parties pour un plateau de joueurs choisi.",
  applicationName: "SOLOQ/LADDER",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "SOLOQ/LADDER",
    title: "SOLOQ/LADDER — classement SoloQ en direct",
    description:
      "LP, forme, séries et historique de parties, recalculés à chaque partie terminée.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b10",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="relative flex min-h-full flex-col">
        {/* Fond : une trame de plan très faible, une nappe de points qui ne
            saigne que du coin haut-droit, et un dégradé qui referme le bas de
            page. Trois couches fixes, aucune ne réagit à la souris. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="gridlines absolute inset-0 opacity-70" />
          <div className="dotfield absolute inset-x-0 top-0 h-[420px] opacity-40" />
          <div className="absolute inset-x-0 bottom-0 h-[60vh] bg-gradient-to-b from-transparent to-void" />
        </div>
        {children}
      </body>
    </html>
  );
}
