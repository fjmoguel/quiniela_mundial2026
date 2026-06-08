import { prisma } from "./db";
import { BRACKET_MAP, SlotSource, describeSource } from "./config";

export type BracketSlotResolved = {
  matchNum: number;
  stage: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeLabel: string;
  awayLabel: string;
  predHomeScore: number | null;
  predAwayScore: number | null;
  predExtraTime: boolean;
  predPenalties: boolean;
  predWinnerTeamId: string | null;
  matchId: string | null;
};

type GroupRow = {
  teamId: string;
  groupLetter: string;
  pts: number;
  gd: number;
  gf: number;
  fifaRank: number;
};

export async function computeUserGroupStandings(
  userId: string
): Promise<Record<string, GroupRow[]>> {
  const teams = await prisma.team.findMany();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const matches = await prisma.match.findMany({ where: { stage: "group" } });
  const userPreds = await prisma.prediction.findMany({
    where: { userId, match: { stage: "group" } },
  });
  const predByMatch = new Map(userPreds.map((p) => [p.matchId, p]));

  const byGroup: Record<string, Map<string, GroupRow>> = {};
  for (const m of matches) {
    if (!m.groupLetter || !m.homeTeamId || !m.awayTeamId) continue;
    if (!byGroup[m.groupLetter]) byGroup[m.groupLetter] = new Map();
    const g = byGroup[m.groupLetter];

    const ensure = (teamId: string) => {
      if (!g.has(teamId)) {
        const t = teamById.get(teamId)!;
        g.set(teamId, {
          teamId,
          groupLetter: m.groupLetter!,
          pts: 0,
          gd: 0,
          gf: 0,
          fifaRank: t.fifaRank ?? 200,
        });
      }
      return g.get(teamId)!;
    };

    ensure(m.homeTeamId);
    ensure(m.awayTeamId);

    const p = predByMatch.get(m.id);
    if (!p) continue;

    const home = g.get(m.homeTeamId)!;
    const away = g.get(m.awayTeamId)!;
    home.gf += p.predHomeScore;
    home.gd += p.predHomeScore - p.predAwayScore;
    away.gf += p.predAwayScore;
    away.gd += p.predAwayScore - p.predHomeScore;
    if (p.predHomeScore > p.predAwayScore) home.pts += 3;
    else if (p.predHomeScore < p.predAwayScore) away.pts += 3;
    else {
      home.pts++;
      away.pts++;
    }
  }

  const result: Record<string, GroupRow[]> = {};
  for (const [letter, m] of Object.entries(byGroup)) {
    const arr = Array.from(m.values());
    arr.sort(
      (a, b) =>
        b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.fifaRank - b.fifaRank
    );
    result[letter] = arr;
  }
  return result;
}

export function rankBestThirds(standings: Record<string, GroupRow[]>): GroupRow[] {
  const thirds: GroupRow[] = [];
  for (const arr of Object.values(standings)) {
    if (arr[2]) thirds.push(arr[2]);
  }
  thirds.sort(
    (a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.fifaRank - b.fifaRank
  );
  return thirds.slice(0, 8);
}

export function assignThirdsToSlots(bestThirds: GroupRow[]): Record<number, string> {
  const thirdSlots = [
    { matchNum: 74, allowed: ["A", "B", "C", "D", "F"] },
    { matchNum: 77, allowed: ["C", "D", "F", "G", "H"] },
    { matchNum: 79, allowed: ["C", "E", "F", "H", "I"] },
    { matchNum: 80, allowed: ["E", "H", "I", "J", "K"] },
    { matchNum: 81, allowed: ["B", "E", "F", "I", "J"] },
    { matchNum: 82, allowed: ["A", "E", "H", "I", "J"] },
    { matchNum: 85, allowed: ["E", "F", "G", "I", "J"] },
    { matchNum: 87, allowed: ["D", "E", "I", "J", "L"] },
  ];

  const assignment: Record<number, string> = {};
  const used = new Set<string>();

  for (const slot of thirdSlots) {
    const candidate = bestThirds.find(
      (t) => !used.has(t.teamId) && slot.allowed.includes(t.groupLetter)
    );
    if (candidate) {
      assignment[slot.matchNum] = candidate.teamId;
      used.add(candidate.teamId);
    }
  }
  return assignment;
}

export async function buildUserBracket(userId: string): Promise<BracketSlotResolved[]> {
  const standings = await computeUserGroupStandings(userId);
  const bestThirds = rankBestThirds(standings);
  const thirdAssignment = assignThirdsToSlots(bestThirds);

  const koMatches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
    orderBy: { kickoff: "asc" },
  });
  const userKOPreds = await prisma.prediction.findMany({
    where: {
      userId,
      match: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
    },
  });
  const predByMatchId = new Map(userKOPreds.map((p) => [p.matchId, p]));

  const matchByNum = new Map<number, (typeof koMatches)[number]>();
  for (const m of koMatches) {
    const nMatch = m.label?.match(/Partido (\d+)/);
    if (nMatch) matchByNum.set(parseInt(nMatch[1]), m);
    else if (m.stage === "third_place") matchByNum.set(103, m);
    else if (m.stage === "final") matchByNum.set(104, m);
  }

  const slotResults = new Map<
    number,
    {
      winnerId: string | null;
      loserId: string | null;
      homeTeamId: string | null;
      awayTeamId: string | null;
    }
  >();

  function resolveSource(src: SlotSource, currentMatchNum: number) {
    if (src.type === "groupPos") {
      const arr = standings[src.group];
      const team = arr?.[src.pos - 1];
      return { teamId: team?.teamId ?? null, label: describeSource(src) };
    }
    if (src.type === "thirdFrom") {
      const teamId = thirdAssignment[currentMatchNum] ?? null;
      return { teamId, label: describeSource(src) };
    }
    if (src.type === "winnerOf") {
      const r = slotResults.get(src.matchNum);
      return { teamId: r?.winnerId ?? null, label: describeSource(src) };
    }
    if (src.type === "loserOf") {
      const r = slotResults.get(src.matchNum);
      return { teamId: r?.loserId ?? null, label: describeSource(src) };
    }
    return { teamId: null, label: "?" };
  }

  const resolved: BracketSlotResolved[] = [];
  const orderedSlots = [...BRACKET_MAP].sort((a, b) => a.matchNum - b.matchNum);

  for (const slot of orderedSlots) {
    const homeRes = resolveSource(slot.home, slot.matchNum);
    const awayRes = resolveSource(slot.away, slot.matchNum);

    const match = matchByNum.get(slot.matchNum);
    const pred = match ? predByMatchId.get(match.id) : undefined;

    let winnerId: string | null = null;
    let loserId: string | null = null;
    if (pred && homeRes.teamId && awayRes.teamId) {
      if (pred.predHomeScore > pred.predAwayScore) {
        winnerId = homeRes.teamId;
        loserId = awayRes.teamId;
      } else if (pred.predAwayScore > pred.predHomeScore) {
        winnerId = awayRes.teamId;
        loserId = homeRes.teamId;
      }
      // If tie: winner determined by penalties pick (TODO: track penalty winner)
    }

    slotResults.set(slot.matchNum, {
      winnerId,
      loserId,
      homeTeamId: homeRes.teamId,
      awayTeamId: awayRes.teamId,
    });

    resolved.push({
      matchNum: slot.matchNum,
      stage: slot.stage,
      homeTeamId: homeRes.teamId,
      awayTeamId: awayRes.teamId,
      homeLabel: homeRes.label,
      awayLabel: awayRes.label,
      predHomeScore: pred?.predHomeScore ?? null,
      predAwayScore: pred?.predAwayScore ?? null,
      predExtraTime: pred?.predExtraTime ?? false,
      predPenalties: pred?.predPenalties ?? false,
      predWinnerTeamId: winnerId,
      matchId: match?.id ?? null,
    });
  }

  return resolved;
}

/**
 * Used by scoring: list of teams the user predicted to reach each round.
 */
export async function teamsByRoundFromUserBracket(
  userId: string
): Promise<Record<string, string[]>> {
  const bracket = await buildUserBracket(userId);
  const out: Record<string, string[]> = {
    r16: [],
    qf: [],
    sf: [],
    final: [],
    third: [],
    champion: [],
  };
  // r16 = winners of r32
  for (const s of bracket.filter((x) => x.stage === "r32"))
    if (s.predWinnerTeamId) out.r16.push(s.predWinnerTeamId);
  for (const s of bracket.filter((x) => x.stage === "r16"))
    if (s.predWinnerTeamId) out.qf.push(s.predWinnerTeamId);
  for (const s of bracket.filter((x) => x.stage === "qf"))
    if (s.predWinnerTeamId) out.sf.push(s.predWinnerTeamId);
  for (const s of bracket.filter((x) => x.stage === "sf"))
    if (s.predWinnerTeamId) out.final.push(s.predWinnerTeamId);
  for (const s of bracket.filter((x) => x.stage === "final"))
    if (s.predWinnerTeamId) out.champion.push(s.predWinnerTeamId);
  for (const s of bracket.filter((x) => x.stage === "third_place"))
    if (s.predWinnerTeamId) out.third.push(s.predWinnerTeamId);
  return out;
}
