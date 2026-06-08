import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { TOURNAMENT_LOCK, isTournamentLocked } from "@/lib/config";
import { getUserTotalPoints } from "@/lib/scoring";

export default async function DashboardPage() {
  const user = await requireUser();
  const locked = isTournamentLocked();

  // Next 3 upcoming matches
  const upcoming = await prisma.match.findMany({
    where: { kickoff: { gte: new Date() }, homeTeamId: { not: null }, awayTeamId: { not: null } },
    orderBy: { kickoff: "asc" },
    take: 3,
    include: { homeTeam: true, awayTeam: true },
  });

  // Leaderboard — using getUserTotalPoints for accurate bracket scoring
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  const leaderboard = await Promise.all(
    users.map(async (u) => {
      const total = await getUserTotalPoints(u.id);
      const preds = await prisma.prediction.count({ where: { userId: u.id } });
      return { id: u.id, username: u.username, total, preds };
    })
  );
  leaderboard.sort((a, b) => b.total - a.total);

  const myRank = leaderboard.findIndex((r) => r.id === user.id) + 1;
  const myEntry = leaderboard.find((r) => r.id === user.id);

  // Count my predictions
  const myMatchPreds = await prisma.prediction.count({ where: { userId: user.id, match: { stage: "group" } } });
  const myKOPreds = await prisma.prediction.count({ where: { userId: user.id, match: { stage: { not: "group" } } } });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Hola, {user.username} 👋</h1>
        <p className="text-gray-600 text-sm">
          Posición #{myRank} · {myEntry?.total ?? 0} pts
        </p>
      </div>

      {!locked && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          ⏰ <strong>Cierre de quiniela:</strong>{" "}
          {TOURNAMENT_LOCK.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
          <div className="text-xs text-blue-700 mt-1">
            Tienes {myMatchPreds}/72 marcadores de grupos · {myKOPreds}/32 partidos KO
          </div>
        </div>
      )}
      {locked && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          🔒 La quiniela está cerrada. ¡Que comience el Mundial!
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Link href="/predicciones" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          <div className="text-xs text-gray-500">Predecir</div>
          <div className="font-medium text-sm">Marcadores</div>
          <div className="text-xs text-gray-400 mt-1">{myMatchPreds}/72</div>
        </Link>
        <Link href="/mis-grupos" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          <div className="text-xs text-gray-500">Ver</div>
          <div className="font-medium text-sm">Mis grupos</div>
          <div className="text-xs text-gray-400 mt-1">Derivado</div>
        </Link>
        <Link href="/mi-bracket" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          <div className="text-xs text-gray-500">Predecir</div>
          <div className="font-medium text-sm">Mi bracket</div>
          <div className="text-xs text-gray-400 mt-1">{myKOPreds}/32 partidos</div>
        </Link>
        <Link href="/leaderboard" className="bg-white border rounded-lg p-3 hover:bg-gray-50">
          <div className="text-xs text-gray-500">Ver</div>
          <div className="font-medium text-sm">Tabla</div>
          <div className="text-xs text-gray-400 mt-1">#{myRank}</div>
        </Link>
      </div>

      <section className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-medium">Próximos partidos</h2>
          <Link href="/predicciones" className="text-sm text-brand underline">
            Ver todos →
          </Link>
        </div>
        <div>
          {upcoming.length === 0 ? (
            <p className="px-4 py-6 text-gray-500 text-sm">No hay partidos próximos.</p>
          ) : (
            upcoming.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
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
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-medium">Leaderboard</h2>
          <Link href="/leaderboard" className="text-sm text-brand underline">
            Ver completo →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-4 py-2">Usuario</th>
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
                <td className="text-right px-4 py-2 font-semibold">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
