import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { rescoreMatch } from "@/lib/scoring";

// POST: Admin sets/updates a match result; recomputes everyone's points
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const matchId = String(body.matchId ?? "");
    const homeScore = body.homeScore == null ? null : Number(body.homeScore);
    const awayScore = body.awayScore == null ? null : Number(body.awayScore);
    const wentToExtraTime = Boolean(body.wentToExtraTime);
    const wentToPenalties = Boolean(body.wentToPenalties);

    // ET and Pen scores (optional)
    const parseOpt = (v: any) => (v == null || v === "" ? null : Number(v));
    const homeScoreET = parseOpt(body.homeScoreET);
    const awayScoreET = parseOpt(body.awayScoreET);
    const homePens = parseOpt(body.homePens);
    const awayPens = parseOpt(body.awayPens);

    const homeTeamId = body.homeTeamId ? String(body.homeTeamId) : undefined;
    const awayTeamId = body.awayTeamId ? String(body.awayTeamId) : undefined;

    if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore,
        awayScore,
        homeScoreET,
        awayScoreET,
        homePens,
        awayPens,
        wentToExtraTime,
        wentToPenalties,
        homeTeamId: homeTeamId ?? match.homeTeamId,
        awayTeamId: awayTeamId ?? match.awayTeamId,
        resultRecordedAt: homeScore != null && awayScore != null ? new Date() : null,
        resultSource: homeScore != null && awayScore != null ? "manual" : null,
      },
    });

    // Recompute all predictions for this match
    if (homeScore != null && awayScore != null) {
      await rescoreMatch(matchId);
    }

    return NextResponse.json({ match: updated });
  } catch (e) {
    console.error("admin result error", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
