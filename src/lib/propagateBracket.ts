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
 * Propagates real match results through the bracket:
 * - Assigns group winners/runner-ups to R32 slots
 * - Assigns best 3rds (FIFA Annex C) to R32 slots
 * - Propagates KO winners to next round
 *
 * Idempotent — safe to call repeatedly. Only fills empty slots, never
 * overwrites already-assigned teams.
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
      const winnerMatch = source.match(/^W(\d+)$/);
      if (winnerMatch) {
        const sourceM = matchByNum.get(parseInt(winnerMatch[1]));
        if (!sourceM) return null;
        return getRealWinner(sourceM);
      }
      const loserMatch = source.match(/^L(\d+)$/);
      if (loserMatch) {
        const sourceM = matchByNum.get(parseInt(loserMatch[1]));
        if (!sourceM) return null;
        return getRealLoser(sourceM);
      }
    }
    if (typeof source === "object" && source.kind === "third") {
      return thirdsAssignment[currentMatchNum] ?? null;
    }
    return null;
  }

  let updates = 0;
  for (const slot of BRACKET_MAP) {
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
      details.push(`M${slot.matchNum} (${slot.stage}): asignado ${Object.keys(update).join(", ")}`);
    }
  }

  return { updatedMatches: updates, details };
}
