import { prisma } from "./db";
import { TOURNAMENT_LOCK, BRACKET_ROUNDS, PERFECT_ROUND_BONUS, isTournamentLocked } from "./config";

/**
 * Scoring system (v2):
 *
 * GROUP STAGE — predicciones por partido (marcadores)
 *   - Resultado correcto (W/D/L): 1 pt
 *   - Marcador exacto:            3 pts (incluye resultado, no se suma)
 *
 * KNOCKOUT — bracket picks (qué equipos avanzan por ronda)
 *   - Equipo correcto en R16:  2 pts c/u  (max 32)
 *   - Equipo correcto en QF:   4 pts c/u  (max 32)
 *   - Equipo correcto en SF:   8 pts c/u  (max 32)
 *   - Finalista correcto:      15 pts c/u (max 30)
 *   - Tercer lugar correcto:   15 pts
 *   - Campeón correcto:        50 pts ⭐
 *
 * BONUS POR RONDA PERFECTA
 *   - R16 perfecta (16/16):  +5 pts
 *   - QF perfecta (8/8):    +10 pts
 *   - SF perfecta (4/4):    +15 pts
 *
 * GROUP POSITIONS (derivadas de tus marcadores)
 *   - Cada posición correcta (1°, 2°, 3°, 4°): 2 pts (max 8 por grupo)
 */

export const SCORING = {
  GROUP_RESULT: 1,
  GROUP_EXACT: 3,
  GROUP_POSITION: 2,
};

export { TOURNAMENT_LOCK, isTournamentLocked, BRACKET_ROUNDS, PERFECT_ROUND_BONUS };

type ScoringMatch = {
  stage: string;
  homeScore: number | null;
  awayScore: number | null;
};

type ScoringPrediction = {
  predHomeScore: number;
  predAwayScore: number;
};

/**
 * Score a single group-stage prediction.
 */
export function scoreSinglePrediction(match: ScoringMatch, pred: ScoringPrediction): number {
  if (match.stage !== "group") return 0;
  if (match.homeScore == null || match.awayScore == null) return 0;

  // Exact?
  if (pred.predHomeScore === match.homeScore && pred.predAwayScore === match.awayScore) {
    return SCORING.GROUP_EXACT;
  }
  // Just outcome?
  const actual = Math.sign(match.homeScore - match.awayScore);
  const predOut = Math.sign(pred.predHomeScore - pred.predAwayScore);
  return actual === predOut ? SCORING.GROUP_RESULT : 0;
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
 * Score a user's bracket picks against actual results.
 * This is called for everyone after each knockout round completes.
 */
export async function scoreBracketForUser(userId: string): Promise<number> {
  // Get user picks grouped by round
  const picks = await prisma.knockoutBracketPick.findMany({ where: { userId } });
  const picksByRound: Record<string, string[]> = {};
  for (const p of picks) {
    if (!picksByRound[p.slotKey]) picksByRound[p.slotKey] = [];
    picksByRound[p.slotKey].push(p.teamId);
  }

  // Determine actual teams that reached each round from match results
  const matches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "final", "third_place"] } },
    include: { homeTeam: true, awayTeam: true },
  });

  // Teams in each round = teams that ARRIVED to it (i.e. won the previous round)
  const actualByRound: Record<string, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
    third: new Set(),
    champion: new Set(),
  };

  function winnerOf(m: (typeof matches)[number]): string | null {
    if (m.homeScore == null || m.awayScore == null) return null;
    if (m.homeScore > m.awayScore) return m.homeTeamId;
    if (m.awayScore > m.homeScore) return m.awayTeamId;
    return null; // ties shouldn't happen in knockout
  }

  // Winners of R32 → arrived to R16
  for (const m of matches.filter((x) => x.stage === "r32")) {
    const w = winnerOf(m);
    if (w) actualByRound.r16.add(w);
  }
  // Winners of R16 → QF
  for (const m of matches.filter((x) => x.stage === "r16")) {
    const w = winnerOf(m);
    if (w) actualByRound.qf.add(w);
  }
  // Winners of QF → SF
  for (const m of matches.filter((x) => x.stage === "qf")) {
    const w = winnerOf(m);
    if (w) actualByRound.sf.add(w);
  }
  // Winners of SF → Final
  for (const m of matches.filter((x) => x.stage === "sf")) {
    const w = winnerOf(m);
    if (w) actualByRound.final.add(w);
  }
  // Third place match winner
  const tp = matches.find((x) => x.stage === "third_place");
  if (tp) {
    const w = winnerOf(tp);
    if (w) actualByRound.third.add(w);
  }
  // Final winner = champion
  const fn = matches.find((x) => x.stage === "final");
  if (fn) {
    const w = winnerOf(fn);
    if (w) actualByRound.champion.add(w);
  }

  // Score per round
  let total = 0;
  for (const round of BRACKET_ROUNDS) {
    const picks = picksByRound[round.key] ?? [];
    const actual = actualByRound[round.key] ?? new Set();
    let correctCount = 0;
    for (const teamId of picks) {
      if (actual.has(teamId)) correctCount++;
    }
    total += correctCount * round.pointsPerCorrect;

    // Perfect round bonus
    if (
      PERFECT_ROUND_BONUS[round.key] &&
      correctCount === round.count &&
      actual.size === round.count // actual round is fully decided
    ) {
      total += PERFECT_ROUND_BONUS[round.key];
    }
  }

  return total;
}

/**
 * Derive predicted group standings from a user's match predictions.
 * Returns map of groupLetter -> [team1Id, team2Id, team3Id, team4Id] in order 1°→4°.
 */
export async function derivePredictedGroupStandings(
  userId: string
): Promise<Record<string, string[]>> {
  // Get all group matches with teams
  const matches = await prisma.match.findMany({
    where: { stage: "group" },
    include: { homeTeam: true, awayTeam: true },
  });
  const userPreds = await prisma.prediction.findMany({
    where: { userId, match: { stage: "group" } },
  });
  const predByMatch = new Map(userPreds.map((p) => [p.matchId, p]));

  // Per group: simulate standings
  const byGroup: Record<string, Map<string, { pts: number; gf: number; ga: number }>> = {};
  for (const m of matches) {
    if (!m.groupLetter || !m.homeTeamId || !m.awayTeamId) continue;
    if (!byGroup[m.groupLetter]) byGroup[m.groupLetter] = new Map();
    const g = byGroup[m.groupLetter];
    if (!g.has(m.homeTeamId)) g.set(m.homeTeamId, { pts: 0, gf: 0, ga: 0 });
    if (!g.has(m.awayTeamId)) g.set(m.awayTeamId, { pts: 0, gf: 0, ga: 0 });

    const p = predByMatch.get(m.id);
    if (!p) continue; // user didn't predict this match — skip

    const home = g.get(m.homeTeamId)!;
    const away = g.get(m.awayTeamId)!;
    home.gf += p.predHomeScore;
    home.ga += p.predAwayScore;
    away.gf += p.predAwayScore;
    away.ga += p.predHomeScore;
    if (p.predHomeScore > p.predAwayScore) home.pts += 3;
    else if (p.predHomeScore < p.predAwayScore) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  }

  const result: Record<string, string[]> = {};
  for (const [letter, teamMap] of Object.entries(byGroup)) {
    const arr = Array.from(teamMap.entries()).map(([id, s]) => ({ id, ...s, gd: s.gf - s.ga }));
    arr.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    result[letter] = arr.map((x) => x.id);
  }
  return result;
}

/**
 * Get user's total points: match points + group position points + bracket points.
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
 * Backwards-compat: per-match lock. Returns true if predictions are locked
 * for this match (now ALL match predictions lock simultaneously at TOURNAMENT_LOCK).
 */
export function isMatchLocked(_kickoff: Date): boolean {
  return isTournamentLocked();
}
