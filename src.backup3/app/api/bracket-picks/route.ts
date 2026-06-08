import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isTournamentLocked, BRACKET_ROUNDS } from "@/lib/config";

// GET — list current user's bracket picks
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const picks = await prisma.knockoutBracketPick.findMany({
    where: { userId: user.id },
  });
  // Group by round
  const byRound: Record<string, string[]> = {};
  for (const p of picks) {
    if (!byRound[p.slotKey]) byRound[p.slotKey] = [];
    byRound[p.slotKey].push(p.teamId);
  }
  return NextResponse.json({ picks: byRound });
}

// POST — replace all picks for a given round
// Body: { round: "r16" | "qf" | "sf" | "final" | "third" | "champion", teamIds: string[] }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (isTournamentLocked()) {
    return NextResponse.json(
      { error: "Las predicciones ya están cerradas" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const round = String(body.round ?? "");
    const teamIds: string[] = Array.isArray(body.teamIds) ? body.teamIds : [];

    const roundDef = BRACKET_ROUNDS.find((r) => r.key === round);
    if (!roundDef) {
      return NextResponse.json({ error: "Ronda inválida" }, { status: 400 });
    }
    if (teamIds.length > roundDef.count) {
      return NextResponse.json(
        { error: `Demasiados equipos para esta ronda (max ${roundDef.count})` },
        { status: 400 }
      );
    }
    // Dedupe
    const uniqueTeamIds = Array.from(new Set(teamIds));
    if (uniqueTeamIds.length !== teamIds.length) {
      return NextResponse.json({ error: "Equipos duplicados" }, { status: 400 });
    }
    // Verify teams exist
    const validTeams = await prisma.team.findMany({
      where: { id: { in: uniqueTeamIds } },
    });
    if (validTeams.length !== uniqueTeamIds.length) {
      return NextResponse.json({ error: "Algún equipo no existe" }, { status: 400 });
    }

    // Replace: delete existing for this round, insert new
    await prisma.knockoutBracketPick.deleteMany({
      where: { userId: user.id, slotKey: round },
    });
    if (uniqueTeamIds.length > 0) {
      await prisma.knockoutBracketPick.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          userId: user.id,
          slotKey: round,
          teamId,
        })),
      });
    }

    return NextResponse.json({ ok: true, count: uniqueTeamIds.length });
  } catch (e: any) {
    console.error("bracket pick error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
