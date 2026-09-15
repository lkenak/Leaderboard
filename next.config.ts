import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Produit `.next/standalone`, un dossier autonome contenant le serveur et
   * seulement les dépendances réellement utilisées — quelques dizaines de
   * mégaoctets au lieu des 600 de `node_modules`. C'est ce qu'on copie sur le
   * serveur.
   */
  output: "standalone",

  /**
   * Le traçage de Next suit les fichiers réellement ouverts au moment du build
   * et embarque `.data/store.json` dans la sortie, parce que `lib/store.ts` le
   * lit. Conséquence si on ne l'exclut pas : chaque déploiement emporte le
   * fichier de la machine de build et écrase l'historique de LP du serveur —
   * silencieusement, et sur la seule donnée que rien ne peut reconstruire.
   *
   * `LADDER_DATA_DIR` met déjà l'historique hors du dossier de déploiement ;
   * cette exclusion évite en plus d'expédier une copie périmée et trompeuse.
   */
  outputFileTracingExcludes: {
    "*": [".data/**"],
  },
};

export default nextConfig;
