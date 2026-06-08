import { prisma } from "./db";
import { dbNameFromApiName } from "./teamMapping";
import { rescoreMatch } from "./scoring";

// ============================================================================
// openfootball/worldcup.json — schedule + fixtures (no API key required)
// ============================================================================

const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

type OpenFootballMatch = {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: { ft?: [number, number] };
};

type OpenFootballData = {
  name: string;
  matches: OpenFootballMatch[];
};

/**
 * Parse "13:00 UTC-6" or "20:00 UTC-4" into a Date.
 */
function parseOpenFootballDate(date: string, time: string): Date {
  // time format: "HH:MM UTC[+-]N"
  const match = time.match(/(\d{1,2}):(\d{2})\s*UTC([+-])(\d{1,2})/);
  if (!match) {
    // Fallback: just use the time as UTC
    return new Date(`${date}T${time.slice(0, 5)}:00Z`);
  }
  const [, hh, mm, sign, offset] = match;
  // Compute UTC time: if local is "13:00 UTC-6", UTC = 13 + 6 = 19:00
  const localHour = parseInt(hh);
  const localMin = parseInt(mm);
  const offsetHours = parseInt(offset);
  const utcHour = sign === "-" ? localHour + offsetHours : localHour - offsetHours;
  const iso = `${date}T${String(utcHour).padStart(2, "0")}:${String(localMin).padStart(2, "0")}:00Z`;
  return new Date(iso);
}

export type SyncResult = {
  fixturesUpdated: number;
  resultsApplied: number;
  knockoutTeamsAssigned: number;
  errors: string[];
};

/**
 * Sync fixtures (dates + teams + group-stage results) from openfootball/worldcup.json.
 */
export async function syncFromOpenFootball(): Promise<SyncResult> {
  const result: SyncResult = {
    fixturesUpdated: 0,
    resultsApplied: 0,
    knockoutTeamsAssigned: 0,
    errors: [],
  };

  let data: OpenFootballData;
  try {
    const r = await fetch(OPENFOOTBALL_URL, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    data = await r.json();
  } catch (e: any) {
    result.errors.push(`openfootball fetch failed: ${e.message}`);
    return result;
  }

  // All teams (cached for lookups)
  const allTeams = await prisma.team.findMany();
  const teamByDbName = new Map(allTeams.map((t) => [t.name, t]));

  // Map openfootball name -> our team record
  function findTeam(apiName: string) {
    const dbName = dbNameFromApiName(apiName);
    if (!dbName) return null;
    return teamByDbName.get(dbName) ?? null;
  }

  for (const m of data.matches) {
    const home = findTeam(m.team1);
    const away = findTeam(m.team2);
    if (!home || !away) {
      // Could be a knockout slot whose teams aren't determined yet (e.g. "W101")
      continue;
    }

    // Find our match: by home + away pair (regardless of order),
    // restricted to matches with matching stage if available
    const dbMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { homeTeamId: home.id, awayTeamId: away.id },
          { homeTeamId: away.id, awayTeamId: home.id }, // in case order is flipped
        ],
      },
    });

    if (!dbMatch) {
      result.errors.push(`No DB match found for ${m.team1} vs ${m.team2}`);
      continue;
    }

    const kickoff = parseOpenFootballDate(m.date, m.time);

    // Update kickoff if it differs
    if (Math.abs(dbMatch.kickoff.getTime() - kickoff.getTime()) > 60 * 1000) {
      await prisma.match.update({
        where: { id: dbMatch.id },
        data: { kickoff, venue: m.ground ?? dbMatch.venue },
      });
      result.fixturesUpdated++;
    }

    // Apply group-stage results if present (knockout handled separately by API-Football)
    if (m.score?.ft && dbMatch.stage === "group") {
      const [hs, as] = m.score.ft;
      // Respect manual results — don't overwrite
      if (dbMatch.resultSource !== "manual") {
        if (dbMatch.homeScore !== hs || dbMatch.awayScore !== as) {
          // Score is for original home/away; if our DB has flipped, swap
          const wasFlipped =
            dbMatch.homeTeamId === away.id && dbMatch.awayTeamId === home.id;
          await prisma.match.update({
            where: { id: dbMatch.id },
            data: {
              homeScore: wasFlipped ? as : hs,
              awayScore: wasFlipped ? hs : as,
              resultRecordedAt: new Date(),
              resultSource: "api",
            },
          });
          await rescoreMatch(dbMatch.id);
          result.resultsApplied++;
        }
      }
    }
  }

  return result;
}

// ============================================================================
// API-Football — live scores + knockout team assignments (requires API key)
// ============================================================================

const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const API_FOOTBALL_LEAGUE = 1; // FIFA World Cup
const API_FOOTBALL_SEASON = 2026;

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string };
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  league: {
    round: string; // e.g. "Group Stage - 1", "Round of 16"
  };
};

const STAGE_FROM_ROUND: Record<string, string> = {
  "Round of 32": "r32",
  "Round of 16": "r16",
  "Quarter-finals": "qf",
  "Quarter Finals": "qf",
  Quarterfinals: "qf",
  "Semi-finals": "sf",
  Semifinals: "sf",
  "Semi Finals": "sf",
  "3rd Place Final": "third_place",
  "3rd Place": "third_place",
  Final: "final",
};

function stageFromRound(round: string): string | null {
  if (round.startsWith("Group Stage")) return "group";
  for (const [k, v] of Object.entries(STAGE_FROM_ROUND)) {
    if (round.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return null;
}

export async function syncFromApiFootball(): Promise<SyncResult> {
  const result: SyncResult = {
    fixturesUpdated: 0,
    resultsApplied: 0,
    knockoutTeamsAssigned: 0,
    errors: [],
  };

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    result.errors.push("API_FOOTBALL_KEY not set — skipping live results sync");
    return result;
  }

  let fixtures: ApiFootballFixture[];
  try {
    const r = await fetch(
      `${API_FOOTBALL_BASE}/fixtures?league=${API_FOOTBALL_LEAGUE}&season=${API_FOOTBALL_SEASON}`,
      {
        headers: { "x-apisports-key": key },
        cache: "no-store",
      }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    fixtures = data.response ?? [];
  } catch (e: any) {
    result.errors.push(`api-football fetch failed: ${e.message}`);
    return result;
  }

  const allTeams = await prisma.team.findMany();
  const teamByDbName = new Map(allTeams.map((t) => [t.name, t]));
  function findTeam(apiName: string) {
    const dbName = dbNameFromApiName(apiName);
    if (!dbName) return null;
    return teamByDbName.get(dbName) ?? null;
  }

  // Process group stage matches: update results
  for (const f of fixtures) {
    const stage = stageFromRound(f.league.round);
    if (!stage) continue;

    const home = findTeam(f.teams.home.name);
    const away = findTeam(f.teams.away.name);
    if (!home || !away) continue;

    if (stage === "group") {
      // Look up match by team pair
      const dbMatch = await prisma.match.findFirst({
        where: {
          stage: "group",
          OR: [
            { homeTeamId: home.id, awayTeamId: away.id },
            { homeTeamId: away.id, awayTeamId: home.id },
          ],
        },
      });
      if (!dbMatch) continue;

      // Only update if status is FT (full-time finished)
      const finalStatuses = ["FT", "AET", "PEN"];
      if (!finalStatuses.includes(f.fixture.status.short)) continue;
      if (dbMatch.resultSource === "manual") continue;

      const hs = f.score.fulltime.home ?? f.goals.home;
      const as = f.score.fulltime.away ?? f.goals.away;
      if (hs == null || as == null) continue;

      const wasFlipped =
        dbMatch.homeTeamId === away.id && dbMatch.awayTeamId === home.id;
      if (dbMatch.homeScore !== (wasFlipped ? as : hs) || dbMatch.awayScore !== (wasFlipped ? hs : as)) {
        await prisma.match.update({
          where: { id: dbMatch.id },
          data: {
            homeScore: wasFlipped ? as : hs,
            awayScore: wasFlipped ? hs : as,
            resultRecordedAt: new Date(),
            resultSource: "api",
          },
        });
        await rescoreMatch(dbMatch.id);
        result.resultsApplied++;
      }
    } else {
      // Knockout match — find an unassigned slot of this stage and fill it,
      // OR if already assigned, update the result.
      // Strategy: try to find a slot in this stage that already has both teams matching.
      let dbMatch = await prisma.match.findFirst({
        where: {
          stage,
          OR: [
            { homeTeamId: home.id, awayTeamId: away.id },
            { homeTeamId: away.id, awayTeamId: home.id },
          ],
        },
      });

      if (!dbMatch) {
        // Find first knockout slot of this stage with no teams assigned
        dbMatch = await prisma.match.findFirst({
          where: { stage, homeTeamId: null, awayTeamId: null },
          orderBy: { kickoff: "asc" },
        });
        if (dbMatch) {
          await prisma.match.update({
            where: { id: dbMatch.id },
            data: {
              homeTeamId: home.id,
              awayTeamId: away.id,
              kickoff: new Date(f.fixture.date),
            },
          });
          result.knockoutTeamsAssigned++;
        }
      }

      if (!dbMatch) continue;

      // Apply result if final
      const finalStatuses = ["FT", "AET", "PEN"];
      if (!finalStatuses.includes(f.fixture.status.short)) continue;
      const fresh = await prisma.match.findUnique({ where: { id: dbMatch.id } });
      if (!fresh || fresh.resultSource === "manual") continue;

      const hs = f.score.fulltime.home ?? f.goals.home;
      const as = f.score.fulltime.away ?? f.goals.away;
      if (hs == null || as == null) continue;

      const wentToET =
        f.score.extratime.home != null || f.fixture.status.short === "AET";
      const wentToPens =
        f.score.penalty.home != null || f.fixture.status.short === "PEN";

      await prisma.match.update({
        where: { id: fresh.id },
        data: {
          homeScore: hs,
          awayScore: as,
          wentToExtraTime: wentToET,
          wentToPenalties: wentToPens,
          resultRecordedAt: new Date(),
          resultSource: "api",
        },
      });
      await rescoreMatch(fresh.id);
      result.resultsApplied++;
    }
  }

  return result;
}

/**
 * Run both syncs in sequence and aggregate results.
 */
export async function syncAll(): Promise<SyncResult> {
  const r1 = await syncFromOpenFootball();
  const r2 = await syncFromApiFootball();
  return {
    fixturesUpdated: r1.fixturesUpdated + r2.fixturesUpdated,
    resultsApplied: r1.resultsApplied + r2.resultsApplied,
    knockoutTeamsAssigned: r1.knockoutTeamsAssigned + r2.knockoutTeamsAssigned,
    errors: [...r1.errors, ...r2.errors],
  };
}
