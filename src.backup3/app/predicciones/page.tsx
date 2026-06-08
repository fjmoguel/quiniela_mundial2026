import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, TOURNAMENT_LOCK } from "@/lib/config";
import PredictionList from "@/components/PredictionList";

export default async function PrediccionesPage() {
  const user = await requireUser();

  // Only group stage matches — knockout is handled via /mi-bracket
  const matches = await prisma.match.findMany({
    where: { stage: "group", homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const myPreds = await prisma.prediction.findMany({
    where: { userId: user.id },
  });

  const myPredsMap = new Map(myPreds.map((p) => [p.matchId, p]));
  const locked = isTournamentLocked();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Marcadores · fase de grupos</h1>
        <p className="text-gray-600 text-sm">
          Predice el marcador de los 72 partidos de fase de grupos. 1 pt por resultado, 3 pts
          por marcador exacto.
        </p>
        {locked ? (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 Predicciones cerradas. El Mundial ya empezó.
          </div>
        ) : (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            {TOURNAMENT_LOCK.toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            (kickoff del partido inaugural). Después de esa hora, todo se bloquea.
          </div>
        )}
      </div>
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
          Array.from(myPredsMap.entries()).map(([k, v]) => [
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
