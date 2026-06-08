import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  // Aggregate points by user
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      predictions: { select: { pointsAwarded: true } },
      groupPredictions: { select: { pointsAwarded: true } },
    },
  });

  const ranked = users
    .map((u) => {
      const matchPts = u.predictions.reduce((acc, p) => acc + p.pointsAwarded, 0);
      const groupPts = u.groupPredictions.reduce((acc, p) => acc + p.pointsAwarded, 0);
      const total = matchPts + groupPts;
      return {
        id: u.id,
        username: u.username,
        matchPoints: matchPts,
        groupPoints: groupPts,
        totalPoints: total,
        predictionsMade: u.predictions.length,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ leaderboard: ranked });
}
