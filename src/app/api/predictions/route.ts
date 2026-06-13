import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isLockedForUser, BYPASS_LOCK_USERNAMES, isTournamentLocked } from "@/lib/config";

// GET: list all of the current user's predictions
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const preds = await prisma.prediction.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ predictions: preds });
}

// POST: create or update a prediction
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const body = await req.json();
    const matchId = String(body.matchId ?? "");

    const predHomeScore = Number(body.predHomeScore);
    const predAwayScore = Number(body.predAwayScore);

    // ET scores (optional)
    const predHomeScoreET =
      body.predHomeScoreET != null && body.predHomeScoreET !== "" ? Number(body.predHomeScoreET) : null;
    const predAwayScoreET =
      body.predAwayScoreET != null && body.predAwayScoreET !== "" ? Number(body.predAwayScoreET) : null;

    // Penalty scores (optional)
    const predHomePens =
      body.predHomePens != null && body.predHomePens !== "" ? Number(body.predHomePens) : null;
    const predAwayPens =
      body.predAwayPens != null && body.predAwayPens !== "" ? Number(body.predAwayPens) : null;

    if (
      !matchId ||
      !Number.isInteger(predHomeScore) ||
      predHomeScore < 0 ||
      predHomeScore > 20 ||
      !Number.isInteger(predAwayScore) ||
      predAwayScore < 0 ||
      predAwayScore > 20
    ) {
      return NextResponse.json({ error: "Marcador en tiempo regular inválido" }, { status: 400 });
    }
    // Validate ET scores if provided
    for (const v of [predHomeScoreET, predAwayScoreET, predHomePens, predAwayPens]) {
      if (v != null && (!Number.isInteger(v) || v < 0 || v > 20)) {
        return NextResponse.json({ error: "Marcador ET/Pen inválido" }, { status: 400 });
      }
    }

    // Auto-derive flags
    const predExtraTime = predHomeScoreET != null || predAwayScoreET != null;
    const predPenalties = predHomePens != null || predAwayPens != null;

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return NextResponse.json({ error: "Partido no existe" }, { status: 404 });

    if (isLockedForUser(user.username)) {
      // Include debug info so we can diagnose bypass issues
      const debug = {
        username: user.username,
        usernameLower: user.username?.toLowerCase(),
        bypassList: BYPASS_LOCK_USERNAMES,
        tournamentLocked: isTournamentLocked(),
        serverTime: new Date().toISOString(),
      };
      console.log("LOCK DENIED:", JSON.stringify(debug));
      return NextResponse.json(
        {
          error: "Las predicciones ya están cerradas (cerraron al inicio del Mundial)",
          debug,
        },
        { status: 403 }
      );
    }

    if (match.stage === "group" && (!match.homeTeamId || !match.awayTeamId)) {
      return NextResponse.json(
        { error: "Este partido aún no tiene equipos asignados" },
        { status: 400 }
      );
    }

    const prediction = await prisma.prediction.upsert({
      where: { userId_matchId: { userId: user.id, matchId } },
      create: {
        userId: user.id,
        matchId,
        predHomeScore,
        predAwayScore,
        predHomeScoreET,
        predAwayScoreET,
        predHomePens,
        predAwayPens,
        predExtraTime,
        predPenalties,
      },
      update: {
        predHomeScore,
        predAwayScore,
        predHomeScoreET,
        predAwayScoreET,
        predHomePens,
        predAwayPens,
        predExtraTime,
        predPenalties,
      },
    });

    return NextResponse.json({ prediction });
  } catch (e: any) {
    console.error("prediction error", e);
    return NextResponse.json({ error: e.message ?? "Error interno" }, { status: 500 });
  }
}
