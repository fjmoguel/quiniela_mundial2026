import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const STAGE_LABELS: Record<string, string> = {
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinal",
  third_place: "Tercer lugar",
  final: "Final",
};

export default async function BracketPage() {
  const user = await requireUser();

  const myPreds = await prisma.prediction.findMany({
    where: { userId: user.id },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { match: { kickoff: "asc" } },
  });

  // Group by stage
  const byStage: Record<string, typeof myPreds> = {};
  for (const p of myPreds) {
    const s = p.match.stage;
    if (!byStage[s]) byStage[s] = [];
    byStage[s].push(p);
  }

  const totalPoints = myPreds.reduce((a, p) => a + p.pointsAwarded, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mi bracket</h1>
        <p className="text-gray-600 text-sm">
          Resumen de todas tus predicciones — {myPreds.length} hechas · {totalPoints} pts
        </p>
      </div>

      {myPreds.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-3">Aún no has hecho predicciones.</p>
          <Link
            href="/predicciones"
            className="inline-block px-4 py-2 bg-black text-white rounded hover:opacity-85"
          >
            Empezar a predecir →
          </Link>
        </div>
      ) : (
        Object.entries(byStage).map(([stage, preds]) => (
          <section key={stage} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-medium">
                {stage === "group" ? "Fase de grupos" : STAGE_LABELS[stage] ?? stage}
              </h2>
            </div>
            <div>
              {preds.map((p) => {
                const m = p.match;
                const hasResult = m.homeScore != null && m.awayScore != null;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{m.homeTeam?.flag}</span>
                      <span className="font-medium">{m.homeTeam?.name}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{m.awayTeam?.name}</span>
                      <span className="text-xl">{m.awayTeam?.flag}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="font-mono">
                        Predicción: <strong>{p.predHomeScore}–{p.predAwayScore}</strong>
                        {(p.predExtraTime || p.predPenalties) && (
                          <span className="text-gray-500 ml-1">
                            ({p.predExtraTime ? "ET" : ""}
                            {p.predExtraTime && p.predPenalties ? "+" : ""}
                            {p.predPenalties ? "PEN" : ""})
                          </span>
                        )}
                      </span>
                      {hasResult ? (
                        <>
                          <span className="font-mono">
                            Real: <strong>{m.homeScore}–{m.awayScore}</strong>
                          </span>
                          <span
                            className={`font-semibold ${
                              p.pointsAwarded > 0 ? "text-green-600" : "text-gray-400"
                            }`}
                          >
                            {p.pointsAwarded} pts
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">Pendiente</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
