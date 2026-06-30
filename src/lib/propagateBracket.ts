import { prisma } from "./db";
import { BRACKET_MAP } from "./config";
import {
  computeRealGroupStandings,
  rankBestThirds,
  assignThirdsToSlots,
} from "./bracket";

function getRealWinner(m: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreET: number | null;
  awayScoreET: number | null;
  homePens: number | null;
  awayPens: number | null;
}): string | null {
  if (!m.homeTeamId || !m.awayTeamId) return null;
  if (m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  if (m.homeScoreET != null && m.awayScoreET != null) {
    if (m.homeScoreET > m.awayScoreET) return m.homeTeamId;
    if (m.awayScoreET > m.homeScoreET) return m.awayTeamId;
  }
  if (m.homePens != null && m.awayPens != null) {
    if (m.homePens > m.awayPens) return m.homeTeamId;
    if (m.awayPens > m.homePens) return m.awayTeamId;
  }
  return null;
}

function getRealLoser(m: any): string | null {
  const winner = getRealWinner(m);
  if (!winner) return null;
  return winner === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
}

function extractMatchNum(label: string | null, stage: string): number | null {
  if (label) {
    const m = label.match(/Partido\s+(\d+)/i);
    if (m) return parseInt(m[1]);
    const m2 = label.match(/\b(\d{2,3})\b/);
    if (m2) {
      const n = parseInt(m2[1]);
      if (n >= 73 && n <= 104) return n;
    }
  }
  if (stage === "third_place") return 103;
  if (stage === "final") return 104;
  return null;
}

/**
 * Hardcoded FIFA bracket connections.
 * Each target match takes home from winner of one match, away from winner of another.
 * For the 3rd place match, it takes losers of the SFs.
 *
 * This is the official FIFA 2026 bracket structure.
 */
const KO_CONNECTIONS: Record<number, {
  homeFromMatch: number;
  awayFromMatch: number;
  homeIsLoser?: boolean;
  awayIsLoser?: boolean;
}> = {
  // R16 (8 matches): winners of R32 pairs
  89: { homeFromMatch: 74, awayFromMatch: 77 },
  90: { homeFromMatch: 73, awayFromMatch: 75 },
  91: { homeFromMatch: 76, awayFromMatch: 78 },
  92: { homeFromMatch: 79, awayFromMatch: 80 },
  93: { homeFromMatch: 83, awayFromMatch: 84 },
  94: { homeFromMatch: 81, awayFromMatch: 82 },
  95: { homeFromMatch: 86, awayFromMatch: 88 },
  96: { homeFromMatch: 85, awayFromMatch: 87 },
  // QF (4 matches): winners of R16 pairs
  97: { homeFromMatch: 89, awayFromMatch: 90 },
  98: { homeFromMatch: 93, awayFromMatch: 94 },
  99: { homeFromMatch: 91, awayFromMatch: 92 },
  100: { homeFromMatch: 95, awayFromMatch: 96 },
  // SF (2 matches): winners of QF pairs
  101: { homeFromMatch: 97, awayFromMatch: 98 },
  102: { homeFromMatch: 99, awayFromMatch: 100 },
  // 3rd place match: LOSERS of the SFs
  103: { homeFromMatch: 101, awayFromMatch: 102, homeIsLoser: true, awayIsLoser: true },
  // Final: winners of the SFs
  104: { homeFromMatch: 101, awayFromMatch: 102 },
};

/**
 * Propagates real match results through the bracket.
 *
 * R32: uses BRACKET_MAP + group standings (1°, 2°, best 3rds via Annex C)
 * R16, QF, SF, Final, 3rd place: uses hardcoded FIFA connections
 *
 * Idempotent — only fills empty slots, never overwrites already-assigned teams.
 */
export async function propagateBracket(): Promise<{
  updatedMatches: number;
  details: string[];
}> {
  const details: string[] = [];

  const koMatches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
  });

  const matchByNum = new Map<number, (typeof koMatches)[number]>();
  for (const m of koMatches) {
    const num = extractMatchNum(m.label, m.stage);
    if (num) matchByNum.set(num, m);
  }

  let updates = 0;

  // ============================================
  // PART 1: R32 — use BRACKET_MAP + group standings
  // ============================================
  const realStandings = await computeRealGroupStandings();
  const completeGroups = Object.keys(realStandings).sort();
  details.push(`Grupos terminados: ${completeGroups.length > 0 ? completeGroups.join(", ") : "ninguno aún"}`);

  let thirdsAssignment: Record<number, string> = {};
  try {
    if (completeGroups.length === 12) {
      const thirds = rankBestThirds(realStandings);
      const thirdSlots = BRACKET_MAP.filter(
        (s) => typeof s.home === "object" && (s.home as any).kind === "third"
      );
      thirdsAssignment = assignThirdsToSlots(thirds, thirdSlots as any);
      details.push(`Asignados ${Object.keys(thirdsAssignment).length} mejores terceros`);
    }
  } catch (e: any) {
    details.push(`Error asignando 3°s: ${e.message ?? e}`);
  }

  function resolveSource(source: any, currentMatchNum: number): string | null {
    if (!source) return null;
    if (typeof source === "string") {
      const groupMatch = source.match(/^([12])([A-L])$/);
      if (groupMatch) {
        const [, position, group] = groupMatch;
        const rows = realStandings[group];
        if (!rows || rows.length < 4) return null;
        return rows[parseInt(position) - 1].teamId;
      }
    }
    if (typeof source === "object" && source.kind === "third") {
      return thirdsAssignment[currentMatchNum] ?? null;
    }
    return null;
  }

  for (const slot of BRACKET_MAP) {
    if (slot.stage !== "r32") continue; // only R32 here
    const match = matchByNum.get(slot.matchNum);
    if (!match) continue;
    const update: { homeTeamId?: string; awayTeamId?: string } = {};
    if (!match.homeTeamId) {
      const teamId = resolveSource(slot.home, slot.matchNum);
      if (teamId) update.homeTeamId = teamId;
    }
    if (!match.awayTeamId) {
      const teamId = resolveSource(slot.away, slot.matchNum);
      if (teamId) update.awayTeamId = teamId;
    }
    if (Object.keys(update).length > 0) {
      await prisma.match.update({ where: { id: match.id }, data: update });
      updates++;
      details.push(`R32 M${slot.matchNum}: asignado ${Object.keys(update).join(", ")}`);
    }
  }

  // ============================================
  // PART 2: R16, QF, SF, 3rd, Final — use hardcoded connections
  // ============================================
  // Refresh matchByNum after R32 updates (to use latest data for cascading)
  const refreshed = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
  });
  matchByNum.clear();
  for (const m of refreshed) {
    const num = extractMatchNum(m.label, m.stage);
    if (num) matchByNum.set(num, m);
  }

  // Iterate multiple times so winners cascade through rounds (R32 → R16 → QF → SF → Final)
  for (let iteration = 0; iteration < 6; iteration++) {
    let iterationUpdates = 0;
    for (const [targetNumStr, conn] of Object.entries(KO_CONNECTIONS)) {
      const targetNum = parseInt(targetNumStr);
      const target = matchByNum.get(targetNum);
      if (!target) continue;

      const update: { homeTeamId?: string; awayTeamId?: string } = {};

      if (!target.homeTeamId) {
        const source = matchByNum.get(conn.homeFromMatch);
        if (source) {
          const teamId = conn.homeIsLoser ? getRealLoser(source) : getRealWinner(source);
          if (teamId) update.homeTeamId = teamId;
        }
      }
      if (!target.awayTeamId) {
        const source = matchByNum.get(conn.awayFromMatch);
        if (source) {
          const teamId = conn.awayIsLoser ? getRealLoser(source) : getRealWinner(source);
          if (teamId) update.awayTeamId = teamId;
        }
      }

      if (Object.keys(update).length > 0) {
        await prisma.match.update({ where: { id: target.id }, data: update });
        // Update local map for next iteration
        target.homeTeamId = update.homeTeamId ?? target.homeTeamId;
        target.awayTeamId = update.awayTeamId ?? target.awayTeamId;
        updates++;
        iterationUpdates++;
        details.push(`${target.stage.toUpperCase()} M${targetNum}: asignado ${Object.keys(update).join(", ")}`);
      }
    }
    if (iterationUpdates === 0) break; // nothing to propagate further
  }

  return { updatedMatches: updates, details };
}
