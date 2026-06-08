import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isMatchLocked } from "@/lib/scoring";

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
    const predExtraTime = Boolean(body.predExtraTime);
    const predPenalties = Boolean(body.predPenalties);

    if (
      !matchId ||
      !Number.isInteger(predHomeScore) ||
      predHomeScore < 0 ||
      predHomeScore > 20 ||
      !Number.isInteger(predAwayScore) ||
      predAwayScore < 0 ||
      predAwayScore > 20
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return NextResponse.json({ error: "Partido no existe" }, { status: 404 });

    if (isMatchLocked(match.kickoff)) {
      return NextResponse.json({ error: "Predicciones cerradas para este partido" }, { status: 403 });
    }

    if (!match.homeTeamId || !match.awayTeamId) {
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
        predExtraTime,
        predPenalties,
      },
      update: { predHomeScore, predAwayScore, predExtraTime, predPenalties },
    });

    return NextResponse.json({ prediction });
  } catch (e) {
    console.error("prediction error", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
