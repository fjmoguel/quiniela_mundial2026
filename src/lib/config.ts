/**
 * Single source of truth for tournament dates, scoring, and bracket structure.
 */

// 11 jun 2026, 13:00 CDMX = 19:00 UTC (kickoff inaugural)
export const TOURNAMENT_LOCK = new Date("2026-06-11T19:00:00Z");

export function isTournamentLocked(): boolean {
  return new Date() >= TOURNAMENT_LOCK;
}

export function msUntilLock(): number {
  return Math.max(0, TOURNAMENT_LOCK.getTime() - Date.now());
}

/**
 * SCORING — final v3 (Mundial 2026)
 *
 * Grupos (marcadores predichos):
 *   - Resultado correcto (W/D/L):   1 pt
 *   - Marcador exacto:              3 pts (incluye resultado)
 *
 * Knockout (cada partido — marcadores derivados de tu bracket):
 *   - Resultado correcto tiempo regular:  2 pts
 *   - Marcador exacto tiempo regular:     6 pts (incluye resultado)
 *   - Predijiste ET y fue ET:            +5 pts
 *   - Predijiste penales y fue penales:  +8 pts
 *
 * Bracket (equipos correctos por ronda):
 *   - Equipo correcto en R16:    2 pts c/u (max 32)
 *   - Equipo correcto en QF:     4 pts c/u (max 32)
 *   - Equipo correcto en SF:     8 pts c/u (max 32)
 *   - Finalista correcto:        12 pts c/u (max 24)
 *   - Tercer lugar correcto:     12 pts
 *   - Campeón correcto:          30 pts ⭐
 *
 * Bonus por ronda perfecta:
 *   - R16 perfecta (16/16):   +5
 *   - QF perfecta (8/8):     +10
 *   - SF perfecta (4/4):     +15
 */

export const SCORING = {
  // Grupos
  GROUP_RESULT: 1,
  GROUP_EXACT: 3,
  // Knockout marcadores
  KO_RESULT: 2,
  KO_EXACT: 6,
  KO_ET_BONUS: 5,
  KO_PEN_BONUS: 8,
  // Bonus extra por marcador exacto en ET y en penales (predijo el marcador y pegó)
  KO_EXACT_ET_BONUS: 2,
  KO_EXACT_PEN_BONUS: 2,
};

export const BRACKET_ROUNDS = [
  { key: "r16", label: "Octavos", count: 16, pointsPerCorrect: 2 },
  { key: "qf", label: "Cuartos", count: 8, pointsPerCorrect: 4 },
  { key: "sf", label: "Semifinales", count: 4, pointsPerCorrect: 8 },
  { key: "final", label: "Finalistas", count: 2, pointsPerCorrect: 12 },
  { key: "third", label: "Tercer lugar", count: 1, pointsPerCorrect: 12 },
  { key: "champion", label: "Campeón", count: 1, pointsPerCorrect: 60 },
] as const;

export const PERFECT_ROUND_BONUS: Record<string, number> = {
  r16: 5,
  qf: 10,
  sf: 15,
};

/**
 * BRACKET MAP — el bracket oficial FIFA del Mundial 2026.
 *
 * Cada slot de R32 tiene un "home" y "away" que describe de DÓNDE
 * viene el equipo. Las cadenas como "1A", "2B" significan
 * "ganador grupo A", "2do grupo A". Las cadenas "3:A,B,C,D,F" indican
 * que viene un 3° de uno de esos 5 grupos.
 */
export type SlotSource =
  | { type: "groupPos"; group: string; pos: 1 | 2 } // ej "1A" = ganador A
  | { type: "thirdFrom"; allowedGroups: string[] } // ej "3°(A/B/C/D/F)"
  | { type: "winnerOf"; matchNum: number } // ej "W74"
  | { type: "loserOf"; matchNum: number }; // ej "L101" (tercer lugar)

export type BracketSlot = {
  matchNum: number;
  stage: string;
  home: SlotSource;
  away: SlotSource;
};

export const BRACKET_MAP: BracketSlot[] = [
  // Round of 32
  { matchNum: 73, stage: "r32", home: { type: "groupPos", group: "A", pos: 2 }, away: { type: "groupPos", group: "B", pos: 2 } },
  { matchNum: 74, stage: "r32", home: { type: "groupPos", group: "E", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["A", "B", "C", "D", "F"] } },
  { matchNum: 75, stage: "r32", home: { type: "groupPos", group: "F", pos: 1 }, away: { type: "groupPos", group: "C", pos: 2 } },
  { matchNum: 76, stage: "r32", home: { type: "groupPos", group: "C", pos: 1 }, away: { type: "groupPos", group: "F", pos: 2 } },
  { matchNum: 77, stage: "r32", home: { type: "groupPos", group: "I", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["C", "D", "F", "G", "H"] } },
  { matchNum: 78, stage: "r32", home: { type: "groupPos", group: "E", pos: 2 }, away: { type: "groupPos", group: "I", pos: 2 } },
  { matchNum: 79, stage: "r32", home: { type: "groupPos", group: "A", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["C", "E", "F", "H", "I"] } },
  { matchNum: 80, stage: "r32", home: { type: "groupPos", group: "L", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["E", "H", "I", "J", "K"] } },
  { matchNum: 81, stage: "r32", home: { type: "groupPos", group: "D", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["B", "E", "F", "I", "J"] } },
  { matchNum: 82, stage: "r32", home: { type: "groupPos", group: "G", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["A", "E", "H", "I", "J"] } },
  { matchNum: 83, stage: "r32", home: { type: "groupPos", group: "K", pos: 2 }, away: { type: "groupPos", group: "L", pos: 2 } },
  { matchNum: 84, stage: "r32", home: { type: "groupPos", group: "H", pos: 1 }, away: { type: "groupPos", group: "J", pos: 2 } },
  { matchNum: 85, stage: "r32", home: { type: "groupPos", group: "B", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["E", "F", "G", "I", "J"] } },
  { matchNum: 86, stage: "r32", home: { type: "groupPos", group: "J", pos: 1 }, away: { type: "groupPos", group: "H", pos: 2 } },
  { matchNum: 87, stage: "r32", home: { type: "groupPos", group: "K", pos: 1 }, away: { type: "thirdFrom", allowedGroups: ["D", "E", "I", "J", "L"] } },
  { matchNum: 88, stage: "r32", home: { type: "groupPos", group: "D", pos: 2 }, away: { type: "groupPos", group: "G", pos: 2 } },
  // Round of 16
  { matchNum: 89, stage: "r16", home: { type: "winnerOf", matchNum: 74 }, away: { type: "winnerOf", matchNum: 77 } },
  { matchNum: 90, stage: "r16", home: { type: "winnerOf", matchNum: 73 }, away: { type: "winnerOf", matchNum: 75 } },
  { matchNum: 91, stage: "r16", home: { type: "winnerOf", matchNum: 76 }, away: { type: "winnerOf", matchNum: 78 } },
  { matchNum: 92, stage: "r16", home: { type: "winnerOf", matchNum: 79 }, away: { type: "winnerOf", matchNum: 80 } },
  { matchNum: 93, stage: "r16", home: { type: "winnerOf", matchNum: 83 }, away: { type: "winnerOf", matchNum: 84 } },
  { matchNum: 94, stage: "r16", home: { type: "winnerOf", matchNum: 81 }, away: { type: "winnerOf", matchNum: 82 } },
  { matchNum: 95, stage: "r16", home: { type: "winnerOf", matchNum: 86 }, away: { type: "winnerOf", matchNum: 88 } },
  { matchNum: 96, stage: "r16", home: { type: "winnerOf", matchNum: 85 }, away: { type: "winnerOf", matchNum: 87 } },
  // Quarter-finals
  { matchNum: 97, stage: "qf", home: { type: "winnerOf", matchNum: 89 }, away: { type: "winnerOf", matchNum: 90 } },
  { matchNum: 98, stage: "qf", home: { type: "winnerOf", matchNum: 93 }, away: { type: "winnerOf", matchNum: 94 } },
  { matchNum: 99, stage: "qf", home: { type: "winnerOf", matchNum: 91 }, away: { type: "winnerOf", matchNum: 92 } },
  { matchNum: 100, stage: "qf", home: { type: "winnerOf", matchNum: 95 }, away: { type: "winnerOf", matchNum: 96 } },
  // Semi-finals
  { matchNum: 101, stage: "sf", home: { type: "winnerOf", matchNum: 97 }, away: { type: "winnerOf", matchNum: 98 } },
  { matchNum: 102, stage: "sf", home: { type: "winnerOf", matchNum: 99 }, away: { type: "winnerOf", matchNum: 100 } },
  // Third place
  { matchNum: 103, stage: "third_place", home: { type: "loserOf", matchNum: 101 }, away: { type: "loserOf", matchNum: 102 } },
  // Final
  { matchNum: 104, stage: "final", home: { type: "winnerOf", matchNum: 101 }, away: { type: "winnerOf", matchNum: 102 } },
];

/**
 * Describe a slot source in human-readable form.
 */
export function describeSource(s: SlotSource): string {
  switch (s.type) {
    case "groupPos":
      return s.pos === 1 ? `1° Grupo ${s.group}` : `2° Grupo ${s.group}`;
    case "thirdFrom":
      return `3° de ${s.allowedGroups.join("/")}`;
    case "winnerOf":
      return `Ganador del partido ${s.matchNum}`;
    case "loserOf":
      return `Perdedor del partido ${s.matchNum}`;
  }
}
