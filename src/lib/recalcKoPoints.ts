import { prisma } from "./db";
import { buildUserBracket } from "./bracket";
import { SCORING } from "./config";

/**
 * Recalculates `pointsAwarded` for all knockout match predictions for ALL users.
 *
 * Logic:
 * - Verify the user's predicted teams (from their bracket) match the real teams
 * - Determine predicted winner using cascading: 90' → ET → Pen (matches how real
 *   winner is determined)
 * - Award KO_RESULT (2) if predicted winner matches real winner
 * - Award KO_EXACT (6) if 90' score is exact
 * - Award ET/Pen bonuses if applicable
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
 * Determines the winner side ("home" or "away") of a match using cascading logic.
 * Used both for real winner and predicted winner.
 */
function cascadeWinner(
  s90h: number | null,
  s90a: number | null,
  hasET: boolean,
  sETh: number | null,
  sETa: number | null,
  hasPen: boolean,
  sPenh: number | null,
  sPena: number | null
): "home" | "away" | null {
  // Penalties (decisive if they happened)
  if (hasPen && sPenh != null && sPena != null) {
    if (sPenh > sPena) return "home";
    if (sPena > sPenh) return "away";
  }
  // Extra time
  if (hasET && sETh != null && sETa != null) {
    if (sETh > sETa) return "home";
    if (sETa > sETh) return "away";
  }
  // Regular 90'
  if (s90h != null && s90a != null) {
    if (s90h > s90a) return "home";
    if (s90a > s90h) return "away";
  }
  return null;
}

/**
 * Score a single KO match prediction, verifying teams match.
 */
export function scoreKoMatch(pred: any, match: any, userSlot: any | null): number {
  // No result yet → 0 pts
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

  // Normalize predicted scores to match the real home/away orientation
  const pHome = sameOrder ? pred.predHomeScore : pred.predAwayScore;
  const pAway = sameOrder ? pred.predAwayScore : pred.predHomeScore;
  const pHomeET = sameOrder ? pred.predHomeScoreET : pred.predAwayScoreET;
  const pAwayET = sameOrder ? pred.predAwayScoreET : pred.predHomeScoreET;
  const pHomePens = sameOrder ? pred.predHomePens : pred.predAwayPens;
  const pAwayPens = sameOrder ? pred.predAwayPens : pred.predHomePens;

  // Determine predicted winner (cascading: Pen → ET → 90')
  const predictedWinner = cascadeWinner(
    pHome, pAway,
    pred.predExtraTime, pHomeET, pAwayET,
    pred.predPenalties, pHomePens, pAwayPens
  );

  // Determine real winner (same cascading logic)
  const realWinner = cascadeWinner(
    match.homeScore, match.awayScore,
    match.wentToExtraTime ?? false, match.homeScoreET, match.awayScoreET,
    match.wentToPenalties ?? false, match.homePens, match.awayPens
  );

  let pts = 0;

  // Exact 90' score → KO_EXACT (implies correct result too)
  if (pHome === match.homeScore && pAway === match.awayScore) {
    pts += SCORING.KO_EXACT;
  } else if (predictedWinner && realWinner && predictedWinner === realWinner) {
    // Correct winner (regardless of how — 90'/ET/Pen) → KO_RESULT
    pts += SCORING.KO_RESULT;
  }

  // ET bonuses (only if real match went to ET AND user predicted it would)
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

  // Pen bonuses (only if real match went to Pen AND user predicted it would)
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
