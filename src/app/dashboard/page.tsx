import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isMatchLocked } from "@/lib/scoring";

export default async function DashboardPage() {
  const user = await requireUser();

  // Next 3 upcoming matches (with teams assigned)
  const upcoming = await prisma.match.findMany({
    where: { kickoff: { gte: new Date() }, homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "asc" },
    take: 3,
    include: { homeTeam: true, awayTeam: true },
  });

  // Leaderboard
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      predictions: { select: { pointsAwarded: true } },
      groupPredictions: { select: { pointsAwarded: true } },
    },
  });
  const leaderboard = users
    .map((u) => ({
      id: u.id,
      username: u.username,
      total:
        u.predictions.reduce((a, p) => a + p.pointsAwarded, 0) +
        u.groupPredictions.reduce((a, p) => a + p.pointsAwarded, 0),
      preds: u.predictions.length,
    }))
    .sort((a, b) => b.total - a.total);

  const myRank = leaderboard.findIndex((r) => r.id === user.id) + 1;
  const myEntry = leaderboard.find((r) => r.id === user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {user.username} 👋</h1>
        <p className="text-gray-600 text-sm">
          Posición #{myRank} · {myEntry?.total ?? 0} pts · {myEntry?.preds ?? 0} predicciones hechas
        </p>
      </div>

      <section className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-medium">Próximos 3 partidos</h2>
          <Link href="/predicciones" className="text-sm text-brand underline">
            Ver todos →
          </Link>
        </div>
        <div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-gray-500 text-sm">No hay partidos próximos.</p>
          ) : (
            upcoming.map((m) => {
              const locked = isMatchLocked(m.kickoff);
              return (
                <Link
                  key={m.id}
                  href={`/predicciones`}
                  className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{m.homeTeam?.flag}</span>
                    <span className="font-medium">{m.homeTeam?.name}</span>
                    <span className="text-gray-400 text-sm">vs</span>
                    <span className="font-medium">{m.awayTeam?.name}</span>
                    <span className="text-2xl">{m.awayTeam?.flag}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {new Date(m.kickoff).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {locked ? (
                      <div className="text-red-500 font-medium">🔒 Cerrado</div>
                    ) : (
                      <div className="text-green-600">Abierto</div>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <section className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-medium">Leaderboard del grupo</h2>
          <Link href="/leaderboard" className="text-sm text-brand underline">
            Ver completo →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-4 py-2">Usuario</th>
              <th className="text-right px-4 py-2">Predicciones</th>
              <th className="text-right px-4 py-2">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.slice(0, 5).map((r, i) => (
              <tr
                key={r.id}
                className={`border-t ${r.id === user.id ? "bg-amber-50" : ""}`}
              >
                <td className="px-4 py-2">{i + 1}</td>
                <td className="px-4 py-2 font-medium">@{r.username}</td>
                <td className="text-right px-4 py-2 text-gray-500">{r.preds}</td>
                <td className="text-right px-4 py-2 font-semibold">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
