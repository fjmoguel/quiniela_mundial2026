import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getUserTotalPoints } from "@/lib/scoring";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  const ranked = await Promise.all(
    users.map(async (u) => {
      const total = await getUserTotalPoints(u.id);
      const preds = await prisma.prediction.count({ where: { userId: u.id } });
      return { id: u.id, username: u.username, totalPoints: total, predictionsMade: preds };
    })
  );
  ranked.sort((a, b) => b.totalPoints - a.totalPoints);
  return NextResponse.json({ leaderboard: ranked });
}
