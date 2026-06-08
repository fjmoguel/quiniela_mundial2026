"use client";
import { useState } from "react";

type Team = { id: string; name: string; flag: string; groupLetter: string };

const ROUNDS = [
  { key: "r16", label: "Octavos", count: 16, pts: 2, desc: "16 equipos que avanzan a octavos" },
  { key: "qf", label: "Cuartos", count: 8, pts: 4, desc: "8 equipos en cuartos" },
  { key: "sf", label: "Semifinales", count: 4, pts: 8, desc: "4 semifinalistas" },
  { key: "final", label: "Finalistas", count: 2, pts: 15, desc: "Los 2 finalistas" },
  { key: "third", label: "Tercer lugar", count: 1, pts: 15, desc: "Ganador del partido por el 3° lugar" },
  { key: "champion", label: "Campeón ⭐", count: 1, pts: 50, desc: "¡EL CAMPEÓN!" },
];

export default function BracketForm({
  teams,
  initialPicks,
  suggested,
  locked,
}: {
  teams: Team[];
  initialPicks: Record<string, string[]>;
  suggested: Record<string, string[]>;
  locked: boolean;
}) {
  const [picks, setPicks] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const r of ROUNDS) {
      out[r.key] = initialPicks[r.key] ?? [];
    }
    return out;
  });
  const [savingRound, setSavingRound] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function toggle(round: string, teamId: string, maxCount: number) {
    if (locked) return;
    setPicks((prev) => {
      const cur = prev[round] ?? [];
      if (cur.includes(teamId)) {
        return { ...prev, [round]: cur.filter((id) => id !== teamId) };
      }
      if (cur.length >= maxCount) {
        setFeedback(`Ya tienes ${maxCount} equipos seleccionados para esta ronda. Quita uno primero.`);
        setTimeout(() => setFeedback(null), 3000);
        return prev;
      }
      return { ...prev, [round]: [...cur, teamId] };
    });
  }

  function useSuggested(round: string) {
    if (locked) return;
    const sugg = suggested[round] ?? [];
    setPicks((prev) => ({ ...prev, [round]: sugg }));
  }

  async function saveRound(round: string) {
    setSavingRound(round);
    setFeedback(null);
    try {
      const r = await fetch("/api/bracket-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round, teamIds: picks[round] ?? [] }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setFeedback(`✓ Guardado: ${data.count} equipos`);
      setTimeout(() => setFeedback(null), 2500);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    } finally {
      setSavingRound(null);
    }
  }

  // Group teams by group letter for nicer display
  const teamsByGroup: Record<string, Team[]> = {};
  for (const t of teams) {
    if (!teamsByGroup[t.groupLetter]) teamsByGroup[t.groupLetter] = [];
    teamsByGroup[t.groupLetter].push(t);
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`text-sm px-3 py-2 rounded ${
            feedback.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          } sticky top-2 z-10`}
        >
          {feedback}
        </div>
      )}

      {ROUNDS.map((round) => {
        const sel = picks[round.key] ?? [];
        const complete = sel.length === round.count;
        return (
          <section key={round.key} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-medium">{round.label}</h2>
                <p className="text-xs text-gray-500">
                  {round.desc} · {round.pts} pts por equipo correcto · {sel.length}/{round.count}
                </p>
              </div>
              <div className="flex gap-2">
                {!locked && (
                  <button
                    onClick={() => useSuggested(round.key)}
                    className="px-3 py-1 text-xs border rounded hover:bg-gray-100"
                  >
                    Usar sugeridos
                  </button>
                )}
                <button
                  onClick={() => saveRound(round.key)}
                  disabled={savingRound === round.key || locked}
                  className="px-3 py-1 text-sm bg-black text-white rounded hover:opacity-85 disabled:opacity-50"
                >
                  {savingRound === round.key ? "..." : "Guardar"}
                </button>
              </div>
            </div>

            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {teams.map((t) => {
                const picked = sel.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggle(round.key, t.id, round.count)}
                    disabled={locked}
                    className={`text-left px-2 py-1.5 rounded text-sm border transition flex items-center gap-1.5 ${
                      picked
                        ? "bg-green-100 border-green-400 text-green-900"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    } disabled:opacity-60`}
                  >
                    <span>{t.flag}</span>
                    <span className="truncate">{t.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{t.groupLetter}</span>
                  </button>
                );
              })}
            </div>

            {complete && (
              <div className="px-4 py-2 bg-green-50 border-t text-xs text-green-700">
                ✓ Tienes {round.count}/{round.count} para {round.label.toLowerCase()}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
