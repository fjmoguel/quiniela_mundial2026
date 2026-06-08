import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AdminResults from "@/components/AdminResults";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) redirect("/dashboard");

  const matches = await prisma.match.findMany({
    orderBy: { kickoff: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const allTeams = await prisma.team.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Admin · Resultados</h1>
        <p className="text-gray-600 text-sm">
          Mete los resultados aquí y se recalculan los puntos de todos los usuarios
          automáticamente.
        </p>
      </div>
      <AdminResults
        matches={matches.map((m) => ({
          id: m.id,
          stage: m.stage,
          groupLetter: m.groupLetter,
          matchday: m.matchday,
          kickoff: m.kickoff.toISOString(),
          label: m.label,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          wentToExtraTime: m.wentToExtraTime,
          wentToPenalties: m.wentToPenalties,
        }))}
        allTeams={allTeams.map((t) => ({ id: t.id, name: t.name, flag: t.flag }))}
      />
    </div>
  );
}
