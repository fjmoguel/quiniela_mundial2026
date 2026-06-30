import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, isLockedForUser, getBypassDeadline, TOURNAMENT_LOCK, BRACKET_ROUNDS } from "@/lib/config";
import { buildUserBracket } from "@/lib/bracket";
import { buildRealBracket } from "@/lib/realBracket";
import BracketView, { type RealMatchData } from "@/components/BracketView";
import BracketScoreSummary from "@/components/BracketScoreSummary";
import LocalDate from "@/components/LocalDate";
import UserSelector from "@/components/UserSelector";

const REAL_BRACKET_ID = "__real__";

function getRealWinner(m: {
  homeTeamId: string | null; awayTeamId: string | null;
  homeScore: number | null; awayScore: number | null;
  homeScoreET: number | null; awayScoreET: number | null;
  homePens: number | null; awayPens: number | null;
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

const STAGE_NEXT_ROUND: Record<string, string> = {
  r32: "r16", r16: "qf", qf: "sf", sf: "final", final: "champion", third_place: "third",
};

export default async function MiBracketPage({
  searchParams,
}: {
  searchParams: { u?: string };
}) {
  const me = await requireUser();

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });

  const requestedUserId = searchParams.u;
  const viewingReal = requestedUserId === REAL_BRACKET_ID;

  const viewedUser = viewingReal
    ? null
    : users.find((u) => u.id === requestedUserId) ?? users.find((u) => u.id === me.id)!;
  const viewingOther = !viewingReal && viewedUser!.id !== me.id;

  const bracket = viewingReal
    ? await buildRealBracket()
    : await buildUserBracket(viewedUser!.id);

  const teams = await prisma.team.findMany();
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const koMatchesAll = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
  });
  const realByMatchNum: Record<number, RealMatchData> = {};
  for (const m of koMatchesAll) {
    const num = extractMatchNum(m.label, m.stage);
    if (!num) continue;
    realByMatchNum[num] = {
      matchNum: num,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
      homeTeam: m.homeTeamId ? (teamById as any)[m.homeTeamId] ?? null : null,
      awayTeam: m.awayTeamId ? (teamById as any)[m.awayTeamId] ?? null : null,
      homeScore: m.homeScore, awayScore: m.awayScore,
      homeScoreET: m.homeScoreET, awayScoreET: m.awayScoreET,
      homePens: m.homePens, awayPens: m.awayPens,
      wentToExtraTime: m.wentToExtraTime ?? false,
      wentToPenalties: m.wentToPenalties ?? false,
      realWinnerTeamId: getRealWinner(m),
    };
  }

  // Sets of teams that REALLY reached each round
  const teamsInRealRound: Record<string, Set<string>> = {
    r16: new Set(), qf: new Set(), sf: new Set(),
    final: new Set(), champion: new Set(), third: new Set(),
  };
  for (const m of koMatchesAll) {
    if (m.stage === "r32") {
      const w = getRealWinner(m); if (w) teamsInRealRound.r16.add(w);
    } else if (m.stage === "r16") {
      const w = getRealWinner(m); if (w) teamsInRealRound.qf.add(w);
    } else if (m.stage === "qf") {
      const w = getRealWinner(m); if (w) teamsInRealRound.sf.add(w);
    } else if (m.stage === "sf") {
      if (m.homeTeamId) teamsInRealRound.final.add(m.homeTeamId);
      if (m.awayTeamId) teamsInRealRound.final.add(m.awayTeamId);
    } else if (m.stage === "final") {
      const w = getRealWinner(m); if (w) teamsInRealRound.champion.add(w);
    } else if (m.stage === "third_place") {
      const w = getRealWinner(m); if (w) teamsInRealRound.third.add(w);
    }
  }

  // Bonus pts per slot — only if the user's PREDICTED winner actually reached
  // the corresponding next round in reality. The +N appears next to the
  // predicted winner ONLY; no bonus to the predicted loser even if that team
  // happened to advance in reality.
  const bonusByMatchNum: Record<number, { home: number; away: number }> = {};
  if (!viewingReal) {
    for (const slot of bracket) {
      const nextRound = STAGE_NEXT_ROUND[slot.stage];
      if (!nextRound) continue;
      const round = BRACKET_ROUNDS.find((r) => r.key === nextRound);
      const pts = round?.pointsPerCorrect ?? 0;
      const realSet = teamsInRealRound[nextRound];
      const winnerId = slot.predWinnerTeamId;
      // Only give bonus if user's predicted winner actually advanced in real life
      const winnerAdvanced = winnerId && realSet?.has(winnerId);
      const homePts = winnerAdvanced && winnerId === slot.homeTeamId ? pts : 0;
      const awayPts = winnerAdvanced && winnerId === slot.awayTeamId ? pts : 0;
      if (homePts > 0 || awayPts > 0) {
        bonusByMatchNum[slot.matchNum] = { home: homePts, away: awayPts };
      }
    }
  }

  // KO match marker points per matchId from Prediction.pointsAwarded
  const pointsByMatchId: Record<string, number> = {};
  if (!viewingReal) {
    const koPreds = await prisma.prediction.findMany({
      where: {
        userId: viewedUser!.id,
        matchId: { in: koMatchesAll.map((m) => m.id) },
      },
      select: { matchId: true, pointsAwarded: true },
    });
    for (const p of koPreds) {
      pointsByMatchId[p.matchId] = p.pointsAwarded ?? 0;
    }
  }

  const groupPredCount = viewingReal
    ? 0
    : await prisma.prediction.count({
        where: { userId: viewedUser!.id, match: { stage: "group" } },
      });

  const locked = viewingReal || viewingOther || isLockedForUser(me.username);

  const headerTitle = viewingReal
    ? "📊 Bracket real — resultados oficiales"
    : viewingOther
    ? `Bracket de @${viewedUser!.username}`
    : "Mi bracket";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{headerTitle}</h1>
        {viewingReal ? (
          <p className="text-gray-600 text-sm">
            Cómo va el Mundial en la realidad, conforme se van metiendo los resultados oficiales.
          </p>
        ) : (
          <p className="text-gray-600 text-sm">
            El bracket se arma <strong>automáticamente</strong> con los marcadores de fase de grupos.
            Usa el toggle <strong>📋 Mi bracket / 📊 Real</strong> para comparar.
          </p>
        )}
        {!viewingReal && !viewingOther && groupPredCount < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {groupPredCount}/72 marcadores de grupos. Completa todos en{" "}
            <Link href="/predicciones" className="underline">Predicciones</Link>{" "}
            para que el bracket se llene completo.
          </div>
        )}
        {!viewingReal && !viewingOther && isLockedForUser(me.username) && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 Predicciones cerradas. El Mundial ya empezó.
          </div>
        )}
        {!viewingReal && !viewingOther && !isLockedForUser(me.username) && isTournamentLocked() && (
          <div className="mt-3 bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2 rounded text-sm">
            🎟️ Acceso especial: tienes permiso para predecir aunque el torneo ya empezó.
            {getBypassDeadline(me.username) && (
              <> Tu acceso expira el{" "}
                <LocalDate iso={getBypassDeadline(me.username)!.toISOString()} format="full" />
                . Después de esa hora, todo se bloquea.
              </>
            )}
          </div>
        )}
        {!viewingReal && !viewingOther && !isTournamentLocked() && (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            <LocalDate iso={TOURNAMENT_LOCK.toISOString()} format="full" />{" "}
            (kickoff inaugural).
          </div>
        )}
      </div>

      <UserSelector
        users={users}
        currentViewedUserId={viewingReal ? REAL_BRACKET_ID : viewedUser!.id}
        currentUserId={me.id}
        extraOptions={[{ id: REAL_BRACKET_ID, label: "📊 Resultados reales (oficiales)" }]}
      />

      {!viewingReal && (
        <BracketScoreSummary userId={viewedUser!.id} bracket={bracket} />
      )}

      <BracketView
        key={viewingReal ? "real" : viewedUser!.id}
        bracket={bracket.map((s) => ({
          ...s,
          homeTeam: s.homeTeamId ? (teamById as any)[s.homeTeamId] ?? null : null,
          awayTeam: s.awayTeamId ? (teamById as any)[s.awayTeamId] ?? null : null,
        }))}
        locked={locked}
        realByMatchNum={!viewingReal ? realByMatchNum : undefined}
        bonusByMatchNum={!viewingReal ? bonusByMatchNum : undefined}
        pointsByMatchId={!viewingReal ? pointsByMatchId : undefined}
      />
    </div>
  );
}
