import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PredictionList from "@/components/PredictionList";

export default async function PrediccionesPage() {
  const user = await requireUser();

  const matches = await prisma.match.findMany({
    where: { homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const myPreds = await prisma.prediction.findMany({
    where: { userId: user.id },
  });

  const myPredsMap = new Map(myPreds.map((p) => [p.matchId, p]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tus predicciones</h1>
        <p className="text-gray-600 text-sm">
          Las predicciones se cierran 15 min antes del inicio de cada partido. Puedes editar
          mientras esté abierto. Las horas se muestran en tu zona horaria local.
        </p>
      </div>
      <PredictionList
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
