import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isTournamentLocked, TOURNAMENT_LOCK } from "@/lib/config";
import { derivePredictedGroupStandings } from "@/lib/scoring";
import BracketForm from "@/components/BracketForm";

export default async function MiBracketPage() {
  const user = await requireUser();

  const teams = await prisma.team.findMany({ orderBy: { name: "asc" } });
  const myPicks = await prisma.knockoutBracketPick.findMany({
    where: { userId: user.id },
  });

  const picksByRound: Record<string, string[]> = {};
  for (const p of myPicks) {
    if (!picksByRound[p.slotKey]) picksByRound[p.slotKey] = [];
    picksByRound[p.slotKey].push(p.teamId);
  }

  // Suggest teams based on group standings (top 2 + best 8 thirds → 32 to R32 → 16 to R16)
  const standings = await derivePredictedGroupStandings(user.id);
  // top 2 of each group + 8 best thirds is the path; for the "suggested R16",
  // we just take top 2 of each group (24 teams) and pick the 8 most "favored" thirds
  // by their points. For simplicity, suggested R16 = top 1 of each group (12) + 4 favorites.
  const suggestedRound: Record<string, string[]> = {};
  const firstPlaces: string[] = [];
  const secondPlaces: string[] = [];
  for (const letter of Object.keys(standings).sort()) {
    const arr = standings[letter];
    if (arr[0]) firstPlaces.push(arr[0]);
    if (arr[1]) secondPlaces.push(arr[1]);
  }
  // Suggested R16: top 16 by group standing (12 first + 4 best seconds)
  suggestedRound.r16 = [...firstPlaces, ...secondPlaces].slice(0, 16);
  // Suggested QF: top 8 first-placed
  suggestedRound.qf = firstPlaces.slice(0, 8);
  // Suggested SF: top 4 first-placed
  suggestedRound.sf = firstPlaces.slice(0, 4);
  suggestedRound.final = firstPlaces.slice(0, 2);
  suggestedRound.third = firstPlaces.slice(2, 3);
  suggestedRound.champion = firstPlaces.slice(0, 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mi bracket</h1>
        <p className="text-gray-600 text-sm">
          Predice qué equipos avanzan a cada ronda del knockout. Las sugerencias se basan en
          tus marcadores predichos de grupos, pero puedes ajustar.
        </p>
        {isTournamentLocked() ? (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            🔒 El bracket está cerrado. El Mundial ya empezó.
          </div>
        ) : (
          <div className="mt-3 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            Cierra el{" "}
            {TOURNAMENT_LOCK.toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            (kickoff del partido inaugural).
          </div>
        )}
      </div>

      <BracketForm
        teams={teams.map((t) => ({ id: t.id, name: t.name, flag: t.flag, groupLetter: t.groupLetter }))}
        initialPicks={picksByRound}
        suggested={suggestedRound}
        locked={isTournamentLocked()}
      />
    </div>
  );
}
