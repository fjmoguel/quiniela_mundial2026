import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isTournamentLocked } from "@/lib/config";

// GET: list user's group order overrides
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const overrides = await prisma.groupPrediction.findMany({ where: { userId: user.id } });
  return NextResponse.json({ overrides });
}

// POST: save/update manual order for a group
// Body: { groupLetter: string, orderedTeamIds: string[] (length 4, in order 1°-4°) }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  if (isTournamentLocked()) {
    return NextResponse.json(
      { error: "El torneo ya empezó, no se puede cambiar el orden" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const groupLetter = String(body.groupLetter ?? "");
    const orderedTeamIds: string[] = Array.isArray(body.orderedTeamIds) ? body.orderedTeamIds : [];

    if (!groupLetter || orderedTeamIds.length !== 4) {
      return NextResponse.json(
        { error: "Se requieren groupLetter y 4 teamIds en orden" },
        { status: 400 }
      );
    }

    // Validate that all 4 teams belong to this group
    const teams = await prisma.team.findMany({
      where: { id: { in: orderedTeamIds }, groupLetter },
    });
    if (teams.length !== 4) {
      return NextResponse.json(
        { error: "Equipos inválidos para este grupo" },
        { status: 400 }
      );
    }

    const saved = await prisma.groupPrediction.upsert({
      where: { userId_groupLetter: { userId: user.id, groupLetter } },
      create: {
        userId: user.id,
        groupLetter,
        firstPlaceTeamId: orderedTeamIds[0],
        secondPlaceTeamId: orderedTeamIds[1],
        thirdPlaceTeamId: orderedTeamIds[2],
        fourthPlaceTeamId: orderedTeamIds[3],
      },
      update: {
        firstPlaceTeamId: orderedTeamIds[0],
        secondPlaceTeamId: orderedTeamIds[1],
        thirdPlaceTeamId: orderedTeamIds[2],
        fourthPlaceTeamId: orderedTeamIds[3],
      },
    });

    return NextResponse.json({ override: saved });
  } catch (e: any) {
    console.error("group-order error", e);
    return NextResponse.json({ error: e.message ?? "Error interno" }, { status: 500 });
  }
}
