import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { propagateBracket } from "@/lib/propagateBracket";
import { recalcKoPointsForAllUsers, scoreKoMatch } from "@/lib/recalcKoPoints";
import { SCORING } from "@/lib/config";
import { buildUserBracket } from "@/lib/bracket";

/**
 * Admin endpoint to save match results.
 *
 * After saving, automatically:
 * 1. Propagates the bracket (assigns winners to next round slots)
 * 2. Recalculates points for all users (using corrected logic that verifies teams)
 *
 * Expected body:
 * {
 *   matchId: string,
 *   homeScore: number | null,
 *   awayScore: number | null,
 *   homeScoreET?: number | null,
 *   awayScoreET?: number | null,
 *   homePens?: number | null,
 *   awayPens?: number | null,
 *   wentToExtraTime?: boolean,
 *   wentToPenalties?: boolean,
 * }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { matchId } = body;
  if (!matchId) return NextResponse.json({ error: "matchId required" }, { status: 400 });

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });

  // Build update payload (only fields that were provided)
  const data: any = {};
  if ("homeScore" in body) data.homeScore = body.homeScore ?? null;
  if ("awayScore" in body) data.awayScore = body.awayScore ?? null;
  if ("homeScoreET" in body) data.homeScoreET = body.homeScoreET ?? null;
  if ("awayScoreET" in body) data.awayScoreET = body.awayScoreET ?? null;
  if ("homePens" in body) data.homePens = body.homePens ?? null;
  if ("awayPens" in body) data.awayPens = body.awayPens ?? null;
  if ("wentToExtraTime" in body) data.wentToExtraTime = body.wentToExtraTime ?? false;
  if ("wentToPenalties" in body) data.wentToPenalties = body.wentToPenalties ?? false;

  await prisma.match.update({ where: { id: matchId }, data });

  const isKO = ["r32", "r16", "qf", "sf", "third_place", "final"].includes(match.stage);
  const isGroup = match.stage === "group";

  let propagateInfo: any = null;
  let recalcInfo: any = null;
  let groupRecalcCount = 0;

  if (isKO) {
    // 1. Propagate winner to next round
    try {
      propagateInfo = await propagateBracket();
    } catch (e: any) {
      console.error("propagate error", e);
      propagateInfo = { error: e.message ?? String(e) };
    }

    // 2. Recalculate ALL KO points (cheap because it just verifies teams + scores)
    try {
      recalcInfo = await recalcKoPointsForAllUsers();
    } catch (e: any) {
      console.error("recalc KO error", e);
      recalcInfo = { error: e.message ?? String(e) };
    }
  } else if (isGroup) {
    // For group stage matches: recalc predictions for this match
    try {
      const preds = await prisma.prediction.findMany({ where: { matchId } });
      const updated = await prisma.match.findUnique({ where: { id: matchId } });
      if (updated && updated.homeScore != null && updated.awayScore != null) {
        for (const pred of preds) {
          let pts = 0;
          if (
            pred.predHomeScore === updated.homeScore &&
            pred.predAwayScore === updated.awayScore
          ) {
            pts = SCORING.GROUP_EXACT;
          } else if (
            pred.predHomeScore != null &&
            pred.predAwayScore != null &&
            Math.sign(pred.predHomeScore - pred.predAwayScore) ===
              Math.sign(updated.homeScore - updated.awayScore)
          ) {
            pts = SCORING.GROUP_RESULT;
          }
          if ((pred.pointsAwarded ?? 0) !== pts) {
            await prisma.prediction.update({
              where: { id: pred.id },
              data: { pointsAwarded: pts },
            });
            groupRecalcCount++;
          }
        }
      }
    } catch (e: any) {
      console.error("group recalc error", e);
    }
  }

  return NextResponse.json({
    ok: true,
    matchUpdated: matchId,
    stage: match.stage,
    propagated: propagateInfo,
    recalcedKO: recalcInfo,
    recalcedGroupPreds: groupRecalcCount,
  });
}

export async function GET() {
  return NextResponse.json({ error: "Use POST to save results" }, { status: 405 });
}
