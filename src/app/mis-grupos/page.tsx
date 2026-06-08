import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { derivePredictedGroupStandings } from "@/lib/scoring";
import Link from "next/link";

export default async function MisGruposPage() {
  const user = await requireUser();
  const teams = await prisma.team.findMany();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const standings = await derivePredictedGroupStandings(user.id);

  // For each group, derive the standings table with points
  const groupMatches = await prisma.match.findMany({
    where: { stage: "group" },
    include: { homeTeam: true, awayTeam: true },
  });
  const userPreds = await prisma.prediction.findMany({
    where: { userId: user.id, match: { stage: "group" } },
  });
  const predByMatch = new Map(userPreds.map((p) => [p.matchId, p]));

  // Build full standings with W/D/L/GF/GA/Pts
  const fullStandings: Record<
    string,
    Array<{ id: string; w: number; d: number; l: number; gf: number; ga: number; pts: number }>
  > = {};
  for (const m of groupMatches) {
    if (!m.groupLetter || !m.homeTeamId || !m.awayTeamId) continue;
    if (!fullStandings[m.groupLetter]) fullStandings[m.groupLetter] = [];
    const g = fullStandings[m.groupLetter];
    if (!g.find((x) => x.id === m.homeTeamId))
      g.push({ id: m.homeTeamId, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    if (!g.find((x) => x.id === m.awayTeamId))
      g.push({ id: m.awayTeamId, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    const p = predByMatch.get(m.id);
    if (!p) continue;
    const home = g.find((x) => x.id === m.homeTeamId)!;
    const away = g.find((x) => x.id === m.awayTeamId)!;
    home.gf += p.predHomeScore;
    home.ga += p.predAwayScore;
    away.gf += p.predAwayScore;
    away.ga += p.predHomeScore;
    if (p.predHomeScore > p.predAwayScore) {
      home.pts += 3;
      home.w++;
      away.l++;
    } else if (p.predHomeScore < p.predAwayScore) {
      away.pts += 3;
      away.w++;
      home.l++;
    } else {
      home.pts++;
      away.pts++;
      home.d++;
      away.d++;
    }
  }

  // Sort by predicted standings order
  for (const letter of Object.keys(fullStandings)) {
    const order = standings[letter] ?? [];
    fullStandings[letter].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }

  const totalPredicted = userPreds.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mis grupos predichos</h1>
        <p className="text-gray-600 text-sm">
          Cómo crees que termina cada grupo según tus marcadores predichos. Esto se actualiza
          conforme guardas marcadores en{" "}
          <Link href="/predicciones" className="underline text-brand">
            Predecir
          </Link>
          .
        </p>
        {totalPredicted < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {totalPredicted}/72 partidos. Los grupos pueden mostrarse incompletos.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(fullStandings)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([letter, rows]) => (
            <div key={letter} className="bg-white border rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b">
                <h2 className="font-medium">Grupo {letter}</h2>
              </div>
              <table className="w-full text-xs">
                <thead className="text-gray-500">
                  <tr>
                    <th className="text-left px-2 py-1">#</th>
                    <th className="text-left px-2 py-1">Equipo</th>
                    <th className="text-right px-1 py-1">PJ</th>
                    <th className="text-right px-1 py-1">G</th>
                    <th className="text-right px-1 py-1">E</th>
                    <th className="text-right px-1 py-1">P</th>
                    <th className="text-right px-1 py-1">DG</th>
                    <th className="text-right px-2 py-1">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const team = teamById.get(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`border-t ${
                          i < 2 ? "bg-green-50" : i === 2 ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="px-2 py-1 font-medium">{i + 1}</td>
                        <td className="px-2 py-1">
                          {team?.flag} {team?.name}
                        </td>
                        <td className="text-right px-1 py-1">{r.w + r.d + r.l}</td>
                        <td className="text-right px-1 py-1">{r.w}</td>
                        <td className="text-right px-1 py-1">{r.d}</td>
                        <td className="text-right px-1 py-1">{r.l}</td>
                        <td className="text-right px-1 py-1">{r.gf - r.ga}</td>
                        <td className="text-right px-2 py-1 font-semibold">{r.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>

      <div className="text-xs text-gray-500 px-1">
        <span className="inline-block w-2 h-2 bg-green-200 rounded mr-1" /> Avanzan directo (1° y 2°) ·{" "}
        <span className="inline-block w-2 h-2 bg-yellow-200 rounded mr-1" /> Posible "mejor tercero"
      </div>
    </div>
  );
}
