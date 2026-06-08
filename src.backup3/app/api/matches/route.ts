import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const stage = req.nextUrl.searchParams.get("stage");
  const groupLetter = req.nextUrl.searchParams.get("group");

  const where: any = {};
  if (stage) where.stage = stage;
  if (groupLetter) where.groupLetter = groupLetter;

  const matches = await prisma.match.findMany({
    where,
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  return NextResponse.json({ matches });
}
