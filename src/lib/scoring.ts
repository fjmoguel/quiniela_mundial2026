import { prisma } from "./db";

/**
 * Scoring system:
 *   GROUP STAGE
 *     - Correct result (W/D/L):     1 pt
 *     - Exact score:                3 pts (includes result, not added on top)
 *
 *   KNOCKOUT (all 2x)
 *     - Correct result:             2 pts
 *     - Exact score:                6 pts
 *     - Correct "went to ET":       +2 pts bonus
 *     - Correct "went to penalties": +2 pts bonus
 *
 *   GROUP POSITIONS (computed when admin marks group stage as final)
 *     - Each correctly placed team (1st, 2nd, 3rd, 4th): 2 pts
 *
 *   PERFECT-ROUND BONUS (knockout brackets)
 *     - All R16 picks correct:  +5 pts
 *     - All QF picks correct:   +5 pts
 *     - All SF picks correct:   +5 pts
 *     - Final winner correct:   +5 pts
 *     - Champion correct:       +10 pts
 */

export const SCORING = {
  GROUP_RESULT: 1,
  GROUP_EXACT: 3,
  KO_RESULT: 2,
  KO_EXACT: 6,
  KO_ET_BONUS: 2,
  KO_PEN_BONUS: 2,
  GROUP_POSITION: 2,
  PERFECT_ROUND_BONUS: 5,
  CHAMPION_BONUS: 10,
};

type ScoringMatch = {
  stage: string;
  homeScore: number | null;
  awayScore: number | null;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
};

type ScoringPrediction = {
  predHomeScore: number;
  predAwayScore: number;
  predExtraTime: boolean;
  predPenalties: boolean;
};

export function scoreSinglePrediction(match: ScoringMatch, pred: ScoringPrediction): number {
  if (match.homeScore == null || match.awayScore == null) return 0;

  const isKO = match.stage !== "group";
  const exactPts = isKO ? SCORING.KO_EXACT : SCORING.GROUP_EXACT;
  const resultPts = isKO ? SCORING.KO_RESULT : SCORING.GROUP_RESULT;

  let pts = 0;

  // Exact score?
  const exact =
    pred.predHomeScore === match.homeScore && pred.predAwayScore === match.awayScore;
  if (exact) {
    pts += exactPts;
  } else {
    // Just the result (W/D/L)?
    const actualOutcome = Math.sign(match.homeScore - match.awayScore);
    const predOutcome = Math.sign(pred.predHomeScore - pred.predAwayScore);
    if (actualOutcome === predOutcome) pts += resultPts;
  }

  // KO bonuses
  if (isKO) {
    if (match.wentToExtraTime && pred.predExtraTime) pts += SCORING.KO_ET_BONUS;
    if (match.wentToPenalties && pred.predPenalties) pts += SCORING.KO_PEN_BONUS;
  }

  return pts;
}

/**
 * Recalculate and persist points for every prediction on a given match.
 * Called when admin saves/updates a match result.
 */
export async function rescoreMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return;

  const preds = await prisma.prediction.findMany({ where: { matchId } });
  const now = new Date();

  for (const p of preds) {
    const pts = scoreSinglePrediction(match, p);
    await prisma.prediction.update({
      where: { id: p.id },
      data: { pointsAwarded: pts, scoredAt: now },
    });
  }
}

/**
 * Total points for a user across all predictions.
 * (Group-position and perfect-round bonuses are stored separately and would
 * be computed by admin endpoint when group/knockout stages conclude.)
 */
export async function getUserTotalPoints(userId: string): Promise<number> {
  const sums = await prisma.prediction.aggregate({
    where: { userId },
    _sum: { pointsAwarded: true },
  });
  const groupPos = await prisma.groupPrediction.aggregate({
    where: { userId },
    _sum: { pointsAwarded: true },
  });
  return (sums._sum.pointsAwarded ?? 0) + (groupPos._sum.pointsAwarded ?? 0);
}

/**
 * Whether a match is still open for predictions.
 * Picks close 15 minutes before kickoff.
 */
export function isMatchLocked(kickoff: Date): boolean {
  const cutoff = new Date(kickoff.getTime() - 15 * 60 * 1000);
  return new Date() >= cutoff;
}
