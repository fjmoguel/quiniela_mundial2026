import { prisma } from "./db";
import { buildUserBracket } from "./bracket";
import { SCORING } from "./config";

/**
 * Recalculates `pointsAwarded` for all knockout match predictions.
 *
 * BUG FIX: previously, KO points were given based ONLY on score numbers
 * matching (e.g. 2-1 == 2-1), without verifying that the teams predicted
 * by the user actually matched the teams in the real match.
 *
 * NEW LOGIC: a KO prediction earns points ONLY IF the user's predicted
 * teams (from their bracket) match the real teams in that match
 * (in any home/away order).
 *
 * Idempotent — safe to run multiple times.
 */
export async function recalcKoPointsForAllUsers(): Promise<{
  usersUpdated: number;
  matchesUpdated: number;
  details: string[];
}> {
  const details: string[] = [];

  const koMatches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
  });
  const koMatchById = new Map(koMatches.map((m) => [m.id, m]));

  const users = await prisma.user.findMany();

  let usersUpdated = 0;
  let totalMatchUpdates = 0;

  for (const user of users) {
    const bracket = await buildUserBracket(user.id);
    const slotByMatchId = new Map<string, (typeof bracket)[number]>();
    for (const slot of bracket) {
      if (slot.matchId) slotByMatchId.set(slot.matchId, slot);
    }

    const preds = await prisma.prediction.findMany({
      where: {
        userId: user.id,
        matchId: { in: koMatches.map((m) => m.id) },
      },
    });

    let userUpdates = 0;
    for (const pred of preds) {
      const match = koMatchById.get(pred.matchId);
      if (!match) continue;
      const slot = slotByMatchId.get(pred.matchId);

      const newPts = scoreKoMatch(pred, match, slot ?? null);
      const oldPts = pred.pointsAwarded ?? 0;

      if (newPts !== oldPts) {
        await prisma.prediction.update({
          where: { id: pred.id },
          data: { pointsAwarded: newPts },
        });
        userUpdates++;
        totalMatchUpdates++;
      }
    }

    if (userUpdates > 0) {
      usersUpdated++;
      details.push(`@${user.username}: ${userUpdates} partidos KO actualizados`);
    }
  }

  return { usersUpdated, matchesUpdated: totalMatchUpdates, details };
}

/**
 * Score a single KO match prediction, verifying teams match before awarding.
 */
function scoreKoMatch(pred: any, match: any, userSlot: any | null): number {
  if (match.homeScore == null || match.awayScore == null) return 0;
  if (!userSlot) return 0;

  const predHomeTeamId = userSlot.homeTeamId;
  const predAwayTeamId = userSlot.awayTeamId;
  if (!predHomeTeamId || !predAwayTeamId) return 0;

  const realHomeId = match.homeTeamId;
  const realAwayId = match.awayTeamId;
  if (!realHomeId || !realAwayId) return 0;

  // CRITICAL: verify teams match (in either home/away order)
  const sameOrder = predHomeTeamId === realHomeId && predAwayTeamId === realAwayId;
  const swappedOrder = predHomeTeamId === realAwayId && predAwayTeamId === realHomeId;
  if (!sameOrder && !swappedOrder) return 0;

  let pHome: number, pAway: number;
  let pHomeET: number | null, pAwayET: number | null;
  let pHomePens: number | null, pAwayPens: number | null;
  if (sameOrder) {
    pHome = pred.predHomeScore;
    pAway = pred.predAwayScore;
    pHomeET = pred.predHomeScoreET;
    pAwayET = pred.predAwayScoreET;
    pHomePens = pred.predHomePens;
    pAwayPens = pred.predAwayPens;
  } else {
    pHome = pred.predAwayScore;
    pAway = pred.predHomeScore;
    pHomeET = pred.predAwayScoreET;
    pAwayET = pred.predHomeScoreET;
    pHomePens = pred.predAwayPens;
    pAwayPens = pred.predHomePens;
  }

  let pts = 0;
  if (pHome === match.homeScore && pAway === match.awayScore) {
    pts += SCORING.KO_EXACT;
  } else {
    const realSign = Math.sign(match.homeScore - match.awayScore);
    const predSign = Math.sign(pHome - pAway);
    if (realSign === predSign) pts += SCORING.KO_RESULT;
  }

  if (match.wentToExtraTime && pred.predExtraTime) {
    pts += SCORING.KO_ET_BONUS;
    if (
      pHomeET != null && pAwayET != null &&
      match.homeScoreET != null && match.awayScoreET != null &&
      pHomeET === match.homeScoreET && pAwayET === match.awayScoreET
    ) {
      pts += SCORING.KO_EXACT_ET_BONUS;
    }
  }

  if (match.wentToPenalties && pred.predPenalties) {
    pts += SCORING.KO_PEN_BONUS;
    if (
      pHomePens != null && pAwayPens != null &&
      match.homePens != null && match.awayPens != null &&
      pHomePens === match.homePens && pAwayPens === match.awayPens
    ) {
      pts += SCORING.KO_EXACT_PEN_BONUS;
    }
  }

  return pts;
}
