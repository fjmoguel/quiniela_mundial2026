import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, TOURNAMENT_LOCK } from "@/lib/config";
import PredictionList from "@/components/PredictionList";
import LocalDate from "@/components/LocalDate";
import UserSelector from "@/components/UserSelector";

export default async function PrediccionesPage({
  searchParams,
}: {
  searchParams: { u?: string };
}) {
  const me = await requireUser();
  const requestedUserId = searchParams.u;
  const viewedUserId = requestedUserId ?? me.id;
  const viewingOther = viewedUserId !== me.id;

  // Load all users for the selector
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });

  // Validate that the requested user exists
  const viewedUser = users.find((u) => u.id === viewedUserId);
  const actualViewedUserId = viewedUser?.id ?? me.id;

  // Only group stage matches
  const matches = await prisma.match.findMany({
    where: { stage: "group", homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const viewedPreds = await prisma.prediction.findMany({
    where: { userId: actualViewedUserId },
  });

  const viewedPredsMap = new Map(viewedPreds.map((p) => [p.matchId, p]));
  // If viewing another user, force read-only. Otherwise honor the lock state.
  const locked = viewingOther || isTournamentLocked();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Marcadores · fase de grupos</h1>
        <p className="text-gray-600 text-sm">
          1 pt por resultado correcto, 3 pts por marcador exacto.
        </p>
        {!viewingOther && isTournamentLocked() && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 Predicciones cerradas. El Mundial ya empezó.
          </div>
        )}
        {!viewingOther && !isTournamentLocked() && (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            <LocalDate iso={TOURNAMENT_LOCK.toISOString()} format="full" />{" "}
            (kickoff del partido inaugural). Después de esa hora, todo se bloquea.
          </div>
        )}
      </div>

      <UserSelector
        users={users}
        currentViewedUserId={actualViewedUserId}
        currentUserId={me.id}
      />

      <PredictionList
        locked={locked}
        matches={matches.map((m) => ({
          id: m.id,
          stage: m.stage,
          groupLetter: m.groupLetter,
          matchday: m.matchday,
          kickoff: m.kickoff.toISOString(),
          label: m.label,
          homeTeam: m.homeTeam!,
          awayTeam: m.awayTeam!,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        }))}
        myPreds={Object.fromEntries(
          Array.from(viewedPredsMap.entries()).map(([k, v]) => [
            k,
            {
              predHomeScore: v.predHomeScore,
              predAwayScore: v.predAwayScore,
              predExtraTime: v.predExtraTime,
              predPenalties: v.predPenalties,
              pointsAwarded: v.pointsAwarded,
            },
          ])
        )}
      />
    </div>
  );
}
