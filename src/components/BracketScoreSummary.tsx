import { prisma } from "@/lib/db";
import { SCORING, BRACKET_ROUNDS, PERFECT_ROUND_BONUS } from "@/lib/config";
import type { BracketSlotResolved } from "@/lib/bracket";

/**
 * Determines the real winner of a knockout match using cascading logic:
 * 90' regular time → ET → penalties.
 */
function getRealWinner(m: {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreET: number | null;
  awayScoreET: number | null;
  homePens: number | null;
  awayPens: number | null;
}): string | null {
  if (!m.homeTeamId || !m.awayTeamId) return null;
  if (m.homeScore == null || m.awayScore == null) return null;
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  // Tied 90'
  if (m.homeScoreET != null && m.awayScoreET != null) {
    if (m.homeScoreET > m.awayScoreET) return m.homeTeamId;
    if (m.awayScoreET > m.homeScoreET) return m.awayTeamId;
  }
  // Tied ET (or no ET data) → penalties
  if (m.homePens != null && m.awayPens != null) {
    if (m.homePens > m.awayPens) return m.homeTeamId;
    if (m.awayPens > m.homePens) return m.awayTeamId;
  }
  return null;
}

/**
 * Server Component: shows the user's bracket scoring breakdown above the bracket.
 * Shows points from KO match predictions + points from correct teams per round.
 */
export default async function BracketScoreSummary({
  userId,
  bracket,
}: {
  userId: string;
  bracket: BracketSlotResolved[];
}) {
  // Load all KO matches with their REAL results
  const koMatches = await prisma.match.findMany({
    where: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
  });

  // Determine real winners per stage
  const realWinners: Record<string, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(), // = both finalists
    third: new Set(),
    champion: new Set(),
  };

  // Winners of R32 → these reach R16
  for (const m of koMatches.filter((x) => x.stage === "r32")) {
    const w = getRealWinner(m);
    if (w) realWinners.r16.add(w);
  }
  // Winners of R16 → reach QF
  for (const m of koMatches.filter((x) => x.stage === "r16")) {
    const w = getRealWinner(m);
    if (w) realWinners.qf.add(w);
  }
  // Winners of QF → reach SF
  for (const m of koMatches.filter((x) => x.stage === "qf")) {
    const w = getRealWinner(m);
    if (w) realWinners.sf.add(w);
  }
  // Winners of SF → reach final (BOTH finalists)
  for (const m of koMatches.filter((x) => x.stage === "sf")) {
    if (m.homeTeamId) realWinners.final.add(m.homeTeamId!); // both teams ARE finalists
    if (m.awayTeamId) realWinners.final.add(m.awayTeamId!);
  }
  // 3rd place winner
  const thirdMatch = koMatches.find((x) => x.stage === "third_place");
  if (thirdMatch) {
    const w = getRealWinner(thirdMatch);
    if (w) realWinners.third.add(w);
  }
  // Champion
  const finalMatch = koMatches.find((x) => x.stage === "final");
  if (finalMatch) {
    const w = getRealWinner(finalMatch);
    if (w) realWinners.champion.add(w);
  }

  // Extract user's predicted teams per round from their bracket slots
  // (a team "reaches" a round if it's the predicted winner of a match in the PREVIOUS round)
  const userTeams: Record<string, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
    third: new Set(),
    champion: new Set(),
  };
  for (const slot of bracket) {
    if (!slot.predWinnerTeamId) continue;
    // The winner of this match advances to the next round
    if (slot.stage === "r32") userTeams.r16.add(slot.predWinnerTeamId);
    else if (slot.stage === "r16") userTeams.qf.add(slot.predWinnerTeamId);
    else if (slot.stage === "qf") userTeams.sf.add(slot.predWinnerTeamId);
    else if (slot.stage === "sf") {
      userTeams.final.add(slot.predWinnerTeamId);
      // also add the loser of SF to "third place candidates" — actually
      // third is the WINNER of the third-place match
    } else if (slot.stage === "final") userTeams.champion.add(slot.predWinnerTeamId);
    else if (slot.stage === "third_place") userTeams.third.add(slot.predWinnerTeamId);
  }
  // Both teams in user's final ARE the user's predicted finalists
  const userFinalSlot = bracket.find((s) => s.stage === "final");
  if (userFinalSlot) {
    if (userFinalSlot.homeTeamId) userTeams.final.add(userFinalSlot.homeTeamId);
    if (userFinalSlot.awayTeamId) userTeams.final.add(userFinalSlot.awayTeamId);
  }

  // Calculate breakdown
  const roundData = [
    { key: "r16", label: "Octavos (R16)", icon: "🥉" },
    { key: "qf", label: "Cuartos (QF)", icon: "🎯" },
    { key: "sf", label: "Semifinales (SF)", icon: "⚡" },
    { key: "final", label: "Finalistas", icon: "🏟️" },
    { key: "third", label: "Tercer lugar", icon: "🥉" },
    { key: "champion", label: "Campeón", icon: "🏆" },
  ];

  let totalBracket = 0;
  const breakdown = roundData.map(({ key, label, icon }) => {
    const round = BRACKET_ROUNDS.find((r) => r.key === key);
    if (!round) return null;
    const userSet = userTeams[key];
    const realSet = realWinners[key];
    const correctCount = realSet.size === 0
      ? null // round not yet started/complete
      : Array.from(userSet).filter((t) => realSet.has(t)).length;
    const points = correctCount === null ? 0 : correctCount * round.pointsPerCorrect;
    totalBracket += points;
    return {
      key,
      label,
      icon,
      correctCount,
      maxTeams: round.count,
      pointsPerCorrect: round.pointsPerCorrect,
      points,
    };
  }).filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: string;
    correctCount: number | null;
    maxTeams: number;
    pointsPerCorrect: number;
    points: number;
  }>;

  // Perfect round bonuses
  let perfectBonus = 0;
  const r16Data = breakdown.find((b) => b.key === "r16");
  if (r16Data && r16Data.correctCount === r16Data.maxTeams) perfectBonus += PERFECT_ROUND_BONUS.r16;
  const qfData = breakdown.find((b) => b.key === "qf");
  if (qfData && qfData.correctCount === qfData.maxTeams) perfectBonus += PERFECT_ROUND_BONUS.qf;
  const sfData = breakdown.find((b) => b.key === "sf");
  if (sfData && sfData.correctCount === sfData.maxTeams) perfectBonus += PERFECT_ROUND_BONUS.sf;
  totalBracket += perfectBonus;

  // KO match points (marcador 90', ET, penales bonuses) — already calculated in Prediction.pointsAwarded
  const koPreds = await prisma.prediction.findMany({
    where: {
      userId,
      match: { stage: { in: ["r32", "r16", "qf", "sf", "third_place", "final"] } },
    },
    select: { pointsAwarded: true },
  });
  const koMatchPoints = koPreds.reduce((acc, p) => acc + (p.pointsAwarded ?? 0), 0);

  const grandTotal = totalBracket + koMatchPoints;

  return (
    <div className="bg-white border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-sm">Puntos del bracket hasta ahora</h2>
        <span className="text-lg font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded">
          {grandTotal} pts
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {breakdown.map((b) => (
          <div
            key={b.key}
            className={`border rounded p-2 ${
              b.correctCount === null
                ? "bg-gray-50 border-gray-200"
                : b.points > 0
                ? "bg-green-50 border-green-200"
                : "bg-white border-gray-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {b.icon} {b.label}
              </span>
              {b.correctCount !== null && b.points > 0 && (
                <span className="text-green-700 font-bold">+{b.points}</span>
              )}
            </div>
            <div className="text-gray-500 mt-0.5">
              {b.correctCount === null ? (
                <em>Aún sin resultados</em>
              ) : (
                <>
                  {b.correctCount}/{b.maxTeams} acertados ({b.pointsPerCorrect} pt c/u)
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-600">Marcadores knockout (90' + bonus ET/Pen)</span>
          <span className="font-semibold">{koMatchPoints} pts</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Equipos correctos por ronda</span>
          <span className="font-semibold">{totalBracket - perfectBonus} pts</span>
        </div>
        {perfectBonus > 0 && (
          <div className="flex justify-between text-blue-700">
            <span>⭐ Bonus rondas perfectas</span>
            <span className="font-semibold">+{perfectBonus} pts</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-1 border-t mt-1">
          <span>TOTAL DEL BRACKET</span>
          <span className="text-green-700">{grandTotal} pts</span>
        </div>
      </div>
    </div>
  );
}
