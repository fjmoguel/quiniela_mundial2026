import { prisma } from "./db";
import {
  SCORING,
  BRACKET_ROUNDS,
  PERFECT_ROUND_BONUS,
  TOURNAMENT_LOCK,
  isTournamentLocked,
} from "./config";
import { teamsByRoundFromUserBracket } from "./bracket";

export { TOURNAMENT_LOCK, isTournamentLocked, SCORING, BRACKET_ROUNDS, PERFECT_ROUND_BONUS };

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

/**
 * Score a single match prediction (works for group and knockout).
 */
export function scoreSinglePrediction(match: ScoringMatch, pred: ScoringPrediction): number {
  if (match.homeScore == null || match.awayScore == null) return 0;
  const isKO = match.stage !== "group";

  let pts = 0;

  // Score for marker
  if (isKO) {
    // Marker in regular time
    if (pred.predHomeScore === match.homeScore && pred.predAwayScore === match.awayScore) {
      pts += SCORING.KO_EXACT;
    } else {
      const actual = Math.sign(match.homeScore - match.awayScore);
      const predOut = Math.sign(pred.predHomeScore - pred.predAwayScore);
      if (actual === predOut) pts += SCORING.KO_RESULT;
    }
    // ET bonus
    if (match.wentToExtraTime && pred.predExtraTime) pts += SCORING.KO_ET_BONUS;
    // Penalties bonus
    if (match.wentToPenalties && pred.predPenalties) pts += SCORING.KO_PEN_BONUS;
  } else {
    // Group
    if (pred.predHomeScore === match.homeScore && pred.predAwayScore === match.awayScore) {
      pts += SCORING.GROUP_EXACT;
    } else {
      const actual = Math.sign(match.homeScore - match.awayScore);
      const predOut = Math.sign(pred.predHomeScore - pred.predAwayScore);
      if (actual === predOut) pts += SCORING.GROUP_RESULT;
    }
  }
  return pts;
}

/**
 * Recalculate and persist points for every prediction on a given match.
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
 * Score a user's BRACKET (which teams arrived to which round)
 * by comparing their predicted bracket against actual match results.
 */
export async function scoreBracketForUser(userId: string): Promise<number> {
  // 1) Get the user's predicted teams by round
  const predictedByRound = await teamsByRoundFromUserBracket(userId);

  // 2) Get the actual teams that arrived to each round from real match results
  const matches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "final", "third_place"] } },
  });

  function winnerOf(m: (typeof matches)[number]): string | null {
    if (m.homeScore == null || m.awayScore == null) return null;
    if (m.homeScore > m.awayScore) return m.homeTeamId;
    if (m.awayScore > m.homeScore) return m.awayTeamId;
    return null;
  }

  const actualByRound: Record<string, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
    third: new Set(),
    champion: new Set(),
  };
  for (const m of matches.filter((x) => x.stage === "r32")) {
    const w = winnerOf(m);
    if (w) actualByRound.r16.add(w);
  }
  for (const m of matches.filter((x) => x.stage === "r16")) {
    const w = winnerOf(m);
    if (w) actualByRound.qf.add(w);
  }
  for (const m of matches.filter((x) => x.stage === "qf")) {
    const w = winnerOf(m);
    if (w) actualByRound.sf.add(w);
  }
  for (const m of matches.filter((x) => x.stage === "sf")) {
    const w = winnerOf(m);
    if (w) actualByRound.final.add(w);
  }
  const tp = matches.find((x) => x.stage === "third_place");
  if (tp) {
    const w = winnerOf(tp);
    if (w) actualByRound.third.add(w);
  }
  const fn = matches.find((x) => x.stage === "final");
  if (fn) {
    const w = winnerOf(fn);
    if (w) actualByRound.champion.add(w);
  }

  let total = 0;
  for (const round of BRACKET_ROUNDS) {
    const predicted = predictedByRound[round.key] ?? [];
    const actual = actualByRound[round.key] ?? new Set();
    let correctCount = 0;
    for (const teamId of predicted) {
      if (actual.has(teamId)) correctCount++;
    }
    total += correctCount * round.pointsPerCorrect;
    if (
      PERFECT_ROUND_BONUS[round.key] &&
      correctCount === round.count &&
      actual.size === round.count
    ) {
      total += PERFECT_ROUND_BONUS[round.key];
    }
  }
  return total;
}

/**
 * Total points for a user: match preds + group positions + bracket.
 */
export async function getUserTotalPoints(userId: string): Promise<number> {
  const m = await prisma.prediction.aggregate({
    where: { userId },
    _sum: { pointsAwarded: true },
  });
  const g = await prisma.groupPrediction.aggregate({
    where: { userId },
    _sum: { pointsAwarded: true },
  });
  const bracket = await scoreBracketForUser(userId);
  return (m._sum.pointsAwarded ?? 0) + (g._sum.pointsAwarded ?? 0) + bracket;
}

/**
 * Backwards-compat. Now all match predictions lock simultaneously.
 */
export function isMatchLocked(_kickoff: Date): boolean {
  return isTournamentLocked();
}
