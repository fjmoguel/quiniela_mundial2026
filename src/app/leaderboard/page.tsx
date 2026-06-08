import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export default async function LeaderboardPage() {
  const user = await requireUser();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      predictions: { select: { pointsAwarded: true } },
      groupPredictions: { select: { pointsAwarded: true } },
    },
  });

  const leaderboard = users
    .map((u) => {
      const matchPts = u.predictions.reduce((a, p) => a + p.pointsAwarded, 0);
      const groupPts = u.groupPredictions.reduce((a, p) => a + p.pointsAwarded, 0);
      return {
        id: u.id,
        username: u.username,
        matchPts,
        groupPts,
        total: matchPts + groupPts,
        preds: u.predictions.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Usuario</th>
              <th className="text-right px-4 py-3">Predicciones</th>
              <th className="text-right px-4 py-3">Pts partidos</th>
              <th className="text-right px-4 py-3">Pts grupos</th>
              <th className="text-right px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((r, i) => (
              <tr
                key={r.id}
                className={`border-t ${r.id === user.id ? "bg-amber-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">{i + 1}</td>
                <td className="px-4 py-3">@{r.username}</td>
                <td className="text-right px-4 py-3 text-gray-500">{r.preds}</td>
                <td className="text-right px-4 py-3">{r.matchPts}</td>
                <td className="text-right px-4 py-3">{r.groupPts}</td>
                <td className="text-right px-4 py-3 font-bold text-lg">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
