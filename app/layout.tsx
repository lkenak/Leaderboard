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
        {/* Fond : une seule couche, le grain. Il donne sa matière au noir sans
            rien prétendre signifier. Le quadrillage et la nappe de points qui
            l'accompagnaient sont partis — une trame de plan est la façon par
            défaut de rendre une page plate « technique », et la nappe dépensait
            l'acide en décor alors qu'il ne signale que quatre choses
            (DESIGN.md § 3 et § 8). */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <span className="grain-layer" />
        </div>
        {children}
      </body>
    </html>
  );
}
