import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeUserGroupStandings } from "@/lib/bracket";
import { isTournamentLocked } from "@/lib/config";
import TiebreakerControl from "@/components/TiebreakerControl";
import UserSelector from "@/components/UserSelector";
import Link from "next/link";

export default async function MisGruposPage({
  searchParams,
}: {
  searchParams: { u?: string };
}) {
  const me = await requireUser();

  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });

  const requestedUserId = searchParams.u;
  const viewedUser = users.find((u) => u.id === requestedUserId) ?? users.find((u) => u.id === me.id)!;
  const viewingOther = viewedUser.id !== me.id;

  const teams = await prisma.team.findMany();
  const teamByIdArr = teams.map((t) => [t.id, t] as const);
  const teamById = Object.fromEntries(teamByIdArr);
  const teamByIdMap = new Map(teamByIdArr);

  const standings = await computeUserGroupStandings(viewedUser.id);
  const viewedPredCount = await prisma.prediction.count({
    where: { userId: viewedUser.id, match: { stage: "group" } },
  });
  // Lock editing if viewing other user OR if tournament is locked
  const locked = viewingOther || isTournamentLocked();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {viewingOther ? `Grupos de @${viewedUser.username}` : "Mis grupos predichos"}
        </h1>
        <p className="text-gray-600 text-sm">
          Cómo termina cada grupo según los marcadores predichos. Si hay empate en
          pts/DG/GF, se puede reordenar manualmente los equipos empatados.
        </p>
        {!viewingOther && viewedPredCount < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {viewedPredCount}/72 partidos.{" "}
            <Link href="/predicciones" className="underline">Completar</Link>
          </div>
        )}
      </div>

      <UserSelector
        users={users}
        currentViewedUserId={viewedUser.id}
        currentUserId={me.id}
      />

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
                    const team = teamByIdMap.get(r.teamId);
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
              <TiebreakerControl
                groupLetter={letter}
                rows={rows}
                teamById={teamById as any}
                locked={locked}
              />
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
