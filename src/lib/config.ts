/**
 * Single source of truth for tournament dates and lock cutoffs.
 *
 * The Mundial 2026 kicks off on June 11 at 13:00 CDMX time (Mexico City, UTC-6).
 * That is 19:00 UTC. After this moment, ALL predictions are locked — group
 * marcadores and bracket picks alike. To change the lock to any other time,
 * edit TOURNAMENT_LOCK below.
 */

// 11 jun 2026, 13:00 CDMX = 19:00 UTC (kickoff Mexico vs South Africa)
export const TOURNAMENT_LOCK = new Date("2026-06-11T19:00:00Z");

export function isTournamentLocked(): boolean {
  return new Date() >= TOURNAMENT_LOCK;
}

export function msUntilLock(): number {
  return Math.max(0, TOURNAMENT_LOCK.getTime() - Date.now());
}

/**
 * Knockout bracket structure — what picks the user makes per round.
 * Counts represent how many teams the user should pick for that round.
 */
export const BRACKET_ROUNDS = [
  { key: "r16", label: "Octavos de final", count: 16, pointsPerCorrect: 2 },
  { key: "qf", label: "Cuartos de final", count: 8, pointsPerCorrect: 4 },
  { key: "sf", label: "Semifinales", count: 4, pointsPerCorrect: 8 },
  { key: "final", label: "Finalistas", count: 2, pointsPerCorrect: 15 },
  { key: "third", label: "Tercer lugar", count: 1, pointsPerCorrect: 15 },
  { key: "champion", label: "Campeón", count: 1, pointsPerCorrect: 50 },
] as const;

export const PERFECT_ROUND_BONUS: Record<string, number> = {
  r16: 5,
  qf: 10,
  sf: 15,
};
