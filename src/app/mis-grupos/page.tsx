import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computeUserGroupStandings, computeRealGroupStandings } from "@/lib/bracket";
import { isTournamentLocked, isLockedForUser } from "@/lib/config";
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
  // Real standings — only includes groups where all 6 matches are complete
  const realStandings = await computeRealGroupStandings();

  const viewedPredCount = await prisma.prediction.count({
    where: { userId: viewedUser.id, match: { stage: "group" } },
  });
  const locked = viewingOther || isLockedForUser(me.username);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {viewingOther ? `Grupos de @${viewedUser.username}` : "Mis grupos predichos"}
        </h1>
        <p className="text-gray-600 text-sm">
          Cómo termina cada grupo según los marcadores predichos.
          Cuando termina la fase de un grupo, se otorga <strong className="text-green-700">+1 pt por cada posición acertada</strong>.
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
          .map(([letter, rows]) => {
            const realRows = realStandings[letter]; // undefined if group not finished
            const groupComplete = !!realRows && realRows.length === 4;
            const correctCount = groupComplete
              ? rows.reduce((acc, r, i) => acc + (r.teamId === realRows![i].teamId ? 1 : 0), 0)
              : 0;
            return (
              <div key={letter} className="bg-white border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
                  <h2 className="font-medium">Grupo {letter}</h2>
                  {groupComplete && (
                    <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                      +{correctCount} pts
                    </span>
                  )}
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
                      const positionCorrect = groupComplete && realRows![i].teamId === r.teamId;
                      return (
                        <tr
                          key={r.teamId}
                          className={`border-t ${
                            i < 2 ? "bg-green-50" : i === 2 ? "bg-yellow-50" : ""
                          }`}
                        >
                          <td className="px-2 py-1 font-medium">{i + 1}</td>
                          <td className="px-2 py-1">
                            <span className="inline-flex items-center gap-1">
                              <span>{team?.flag} {team?.name}</span>
                              {positionCorrect && (
                                <span
                                  title="Posición acertada"
                                  className="ml-1 inline-flex items-center text-[10px] font-bold text-green-700 bg-green-100 border border-green-300 rounded px-1 py-px"
                                >
                                  ✓ +1
                                </span>
                              )}
                            </span>
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
            );
          })}
      </div>

      <div className="text-xs text-gray-500 px-1">
        <span className="inline-block w-2 h-2 bg-green-200 rounded mr-1" /> Avanzan directo (1° y 2°) ·{" "}
        <span className="inline-block w-2 h-2 bg-yellow-200 rounded mr-1" /> Posible "mejor tercero" ·{" "}
        <span className="text-green-700 font-semibold">✓ +1</span> = posición acertada
      </div>
    </div>
  );
}
