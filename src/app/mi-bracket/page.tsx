import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, isLockedForUser, getBypassDeadline, TOURNAMENT_LOCK } from "@/lib/config";
import { buildUserBracket } from "@/lib/bracket";
import BracketView from "@/components/BracketView";
import BracketScoreSummary from "@/components/BracketScoreSummary";
import LocalDate from "@/components/LocalDate";
import UserSelector from "@/components/UserSelector";

export default async function MiBracketPage({
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

  const bracket = await buildUserBracket(viewedUser.id);
  const teams = await prisma.team.findMany();
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const groupPredCount = await prisma.prediction.count({
    where: { userId: viewedUser.id, match: { stage: "group" } },
  });

  // Lock if viewing other user OR tournament locked for this specific user
  const locked = viewingOther || isLockedForUser(me.username);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {viewingOther ? `Bracket de @${viewedUser.username}` : "Mi bracket"}
        </h1>
        <p className="text-gray-600 text-sm">
          El bracket se arma <strong>automáticamente</strong> con los marcadores de fase de grupos.
        </p>
        {!viewingOther && groupPredCount < 72 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm">
            ⚠️ Has predicho {groupPredCount}/72 marcadores de grupos. Completa todos en{" "}
            <Link href="/predicciones" className="underline">
              Predicciones
            </Link>{" "}
            para que el bracket se llene completo.
          </div>
        )}
        {!viewingOther && isLockedForUser(me.username) && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 Predicciones cerradas. El Mundial ya empezó.
          </div>
        )}
        {!viewingOther && !isLockedForUser(me.username) && isTournamentLocked() && (
          <div className="mt-3 bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2 rounded text-sm">
            🎟️ Acceso especial: tienes permiso para predecir aunque el torneo ya empezó.
            {getBypassDeadline(me.username) && (
              <> Tu acceso expira el{" "}
                <LocalDate iso={getBypassDeadline(me.username)!.toISOString()} format="full" />
                . Después de esa hora, todo se bloquea.
              </>
            )}
          </div>
        )}
        {!viewingOther && !isTournamentLocked() && (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            <LocalDate iso={TOURNAMENT_LOCK.toISOString()} format="full" />{" "}
            (kickoff inaugural).
          </div>
        )}
      </div>

      <UserSelector
        users={users}
        currentViewedUserId={viewedUser.id}
        currentUserId={me.id}
      />

      {/* NEW: Score summary above the bracket */}
      <BracketScoreSummary userId={viewedUser.id} bracket={bracket} />

      <BracketView
        key={viewedUser.id}
        bracket={bracket.map((s) => ({
          ...s,
          homeTeam: s.homeTeamId ? teamById[s.homeTeamId] : null,
          awayTeam: s.awayTeamId ? teamById[s.awayTeamId] : null,
        }))}
        locked={locked}
      />
    </div>
  );
}
