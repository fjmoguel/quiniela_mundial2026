import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, TOURNAMENT_LOCK } from "@/lib/config";
import { buildUserBracket } from "@/lib/bracket";
import BracketView from "@/components/BracketView";

export default async function MiBracketPage() {
  const user = await requireUser();
  const bracket = await buildUserBracket(user.id);
  const teams = await prisma.team.findMany();
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const groupPredCount = await prisma.prediction.count({
    where: { userId: user.id, match: { stage: "group" } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mi bracket</h1>
        <p className="text-gray-600 text-sm">
          El bracket se arma <strong>automáticamente</strong> con tus marcadores de fase de
          grupos. Aquí predices marcadores de cada partido de knockout: tiempo regular,
          tiempo extra y penales son <strong>opcionales</strong>.
        </p>
        {groupPredCount < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {groupPredCount}/72 marcadores de grupos. Completa todos en{" "}
            <Link href="/predicciones" className="underline">
              Predecir
            </Link>{" "}
            para que el bracket se llene completo.
          </div>
        )}
        {isTournamentLocked() ? (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 Predicciones cerradas. El Mundial ya empezó.
          </div>
        ) : (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            {TOURNAMENT_LOCK.toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            (kickoff inaugural).
          </div>
        )}
      </div>
      <BracketView
        bracket={bracket.map((s) => ({
          ...s,
          homeTeam: s.homeTeamId ? teamById[s.homeTeamId] : null,
          awayTeam: s.awayTeamId ? teamById[s.awayTeamId] : null,
        }))}
        locked={isTournamentLocked()}
      />
    </div>
  );
}
