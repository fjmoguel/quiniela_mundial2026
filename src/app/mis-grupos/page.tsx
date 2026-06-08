import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeUserGroupStandings } from "@/lib/bracket";
import Link from "next/link";

export default async function MisGruposPage() {
  const user = await requireUser();
  const teams = await prisma.team.findMany();
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const standings = await computeUserGroupStandings(user.id);
  const userPredCount = await prisma.prediction.count({
    where: { userId: user.id, match: { stage: "group" } },
  });

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
        {userPredCount < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {userPredCount}/72 partidos. Los grupos pueden mostrarse incompletos.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(standings)
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
                    <th className="text-right px-1 py-1">DG</th>
                    <th className="text-right px-1 py-1">GF</th>
                    <th className="text-right px-2 py-1">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const team = teamById.get(r.teamId);
                    return (
                      <tr
                        key={r.teamId}
                        className={`border-t ${
                          i < 2 ? "bg-green-50" : i === 2 ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="px-2 py-1 font-medium">{i + 1}</td>
                        <td className="px-2 py-1">
                          {team?.flag} {team?.name}
                        </td>
                        <td className="text-right px-1 py-1">{r.gd}</td>
                        <td className="text-right px-1 py-1">{r.gf}</td>
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
