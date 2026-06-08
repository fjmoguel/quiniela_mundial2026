import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getUserTotalPoints, scoreBracketForUser } from "@/lib/scoring";

export default async function LeaderboardPage() {
  const user = await requireUser();

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
  });

  const leaderboard = await Promise.all(
    users.map(async (u) => {
      const matchSum = await prisma.prediction.aggregate({
        where: { userId: u.id },
        _sum: { pointsAwarded: true },
      });
      const groupSum = await prisma.groupPrediction.aggregate({
        where: { userId: u.id },
        _sum: { pointsAwarded: true },
      });
      const bracketPts = await scoreBracketForUser(u.id);
      const preds = await prisma.prediction.count({ where: { userId: u.id } });
      const matchPts = matchSum._sum.pointsAwarded ?? 0;
      const groupPts = groupSum._sum.pointsAwarded ?? 0;
      return {
        id: u.id,
        username: u.username,
        matchPts,
        groupPts,
        bracketPts,
        total: matchPts + groupPts + bracketPts,
        preds,
      };
    })
  );
  leaderboard.sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-xs uppercase bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Usuario</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Marcadores</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Posiciones</th>
              <th className="text-right px-4 py-3 hidden sm:table-cell">Bracket</th>
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
                <td className="text-right px-4 py-3 hidden sm:table-cell text-gray-700">{r.matchPts}</td>
                <td className="text-right px-4 py-3 hidden sm:table-cell text-gray-700">{r.groupPts}</td>
                <td className="text-right px-4 py-3 hidden sm:table-cell text-gray-700">{r.bracketPts}</td>
                <td className="text-right px-4 py-3 font-bold text-lg">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
