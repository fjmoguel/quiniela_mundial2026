import { prisma } from "./db";
import { BRACKET_MAP, describeSource } from "./config";
import type { BracketSlotResolved } from "./bracket";

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
 * Build a "real" bracket from actual match results in the DB.
 * Used when viewing "📊 Resultados reales (oficiales)" in the dropdown.
 */
export async function buildRealBracket(): Promise<BracketSlotResolved[]> {
  const koMatches = await prisma.match.findMany({
    where: {
      stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] },
    },
  });

  const byNum = new Map<number, (typeof koMatches)[number]>();
  for (const m of koMatches) {
    const num = extractMatchNum(m.label, m.stage);
    if (num) byNum.set(num, m);
  }

  const slots: BracketSlotResolved[] = [];
  for (const slot of BRACKET_MAP) {
    const match = byNum.get(slot.matchNum);
    if (!match) continue;

    slots.push({
      matchNum: slot.matchNum,
      stage: slot.stage,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeLabel: describeSource(slot.home, slot.matchNum),
      awayLabel: describeSource(slot.away, slot.matchNum),
      predHomeScore: match.homeScore,
      predAwayScore: match.awayScore,
      predHomeScoreET: match.homeScoreET,
      predAwayScoreET: match.awayScoreET,
      predHomePens: match.homePens,
      predAwayPens: match.awayPens,
      predExtraTime: match.wentToExtraTime ?? false,
      predPenalties: match.wentToPenalties ?? false,
      predWinnerTeamId: getRealWinner(match),
      matchId: match.id,
    });
  }
  return slots;
}
