import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { scoreBracketForUser } from "@/lib/scoring";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  const ranked = await Promise.all(
    users.map(async (u) => {
      const matchPts = await prisma.prediction.aggregate({
        where: { userId: u.id },
        _sum: { pointsAwarded: true },
      });
      const bracketPts = await scoreBracketForUser(u.id);
      const preds = await prisma.prediction.count({ where: { userId: u.id } });
      const matchTotal = matchPts._sum.pointsAwarded ?? 0;
      return {
        id: u.id,
        username: u.username,
        matchPoints: matchTotal,
        bracketPoints: bracketPts,
        totalPoints: matchTotal + bracketPts,
        predictionsMade: preds,
      };
    })
  );
  ranked.sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ leaderboard: ranked });
}
