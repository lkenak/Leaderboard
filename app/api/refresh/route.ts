import { NextResponse } from "next/server";
import { hasKey, isRunning, runSync } from "@/lib/riot/refresh";

/**
 * Déclenche un relevé. Deux usages :
 *  - un cron (Vercel Cron, systemd, cron-job.org) avec l'en-tête
 *    `Authorization: Bearer $REFRESH_SECRET` ;
 *  - le bouton « Relever maintenant » des réglages d'un ladder (`/l/[slug]/settings`).
 *
 * En développement local, le secret est facultatif — l'exiger ne protégerait
 * rien sur une machine à laquelle on a déjà accès, et l'oubli est la première
 * cause de « pourquoi ça ne se met pas à jour ».
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.REFRESH_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Vercel Cron envoie son propre en-tête ; on accepte aussi le secret en
  // paramètre pour les crons externes qui ne savent pas poser d'en-tête.
  return new URL(request.url).searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: "Non autorisé. Fournir REFRESH_SECRET." },
      { status: 401 },
    );
  }
  if (!hasKey()) {
    return NextResponse.json(
      {
        error:
          "RIOT_API_KEY absente. Copier .env.example vers .env.local et y coller une clé personnelle.",
      },
      { status: 503 },
    );
  }
  const alreadyRunning = isRunning();
  const report = await runSync();
  return NextResponse.json({ alreadyRunning, ...report });
}

export const GET = handle;
export const POST = handle;
