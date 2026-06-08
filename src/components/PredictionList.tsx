"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import LocalDate from "./LocalDate";

type Team = { id: string; name: string; flag: string; groupLetter: string };
type Match = {
  id: string;
  stage: string;
  groupLetter: string | null;
  matchday: number | null;
  kickoff: string;
  label: string | null;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  venue?: string | null;
};

type Pred = {
  predHomeScore: number | null;
  predAwayScore: number | null;
  pointsAwarded: number;
};

const DEBOUNCE_MS = 700;
type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export default function PredictionList({
  matches,
  myPreds,
  locked,
}: {
  matches: Match[];
  myPreds: Record<string, Pred>;
  locked: boolean;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [preds, setPreds] = useState<Record<string, Pred>>(myPreds);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingRef = useRef<Map<string, Pred>>(new Map());

  function updatePred(matchId: string, patch: Partial<Pred>) {
    setPreds((prev) => {
      const current = prev[matchId] ?? { predHomeScore: null, predAwayScore: null, pointsAwarded: 0 };
      const next = { ...current, ...patch };
      const newPreds = { ...prev, [matchId]: next };

      // queue auto-save
      if (next.predHomeScore != null && next.predAwayScore != null) {
        pendingRef.current.set(matchId, next);
        setStatus("pending");
        const existing = timersRef.current.get(matchId);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => flushSave(matchId), DEBOUNCE_MS);
        timersRef.current.set(matchId, t);
      }
      return newPreds;
    });
  }

  async function flushSave(matchId: string) {
    const pred = pendingRef.current.get(matchId);
    if (!pred) return;
    pendingRef.current.delete(matchId);
    timersRef.current.delete(matchId);
    setStatus("saving");
    try {
      const r = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          predHomeScore: pred.predHomeScore,
          predAwayScore: pred.predAwayScore,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setStatus("saved");
      setErrorMsg(null);
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message ?? "Error al guardar");
    }
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Group matches by date for cleaner display
  const groupedByDate = useMemo(() => {
    const filtered = filter === "all" ? matches : matches.filter((m) => m.groupLetter === filter);
    const byDate: Record<string, Match[]> = {};
    for (const m of filtered) {
      const dateKey = new Date(m.kickoff).toISOString().split("T")[0];
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(m);
    }
    // sort each day's matches by time
    for (const key of Object.keys(byDate)) {
      byDate[key].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    }
    return byDate;
  }, [matches, filter]);

  const sortedDates = Object.keys(groupedByDate).sort();
  const completedCount = Object.values(preds).filter(
    (p) => p.predHomeScore != null && p.predAwayScore != null
  ).length;

  const groupLetters = Array.from(
    new Set(matches.filter((m) => m.groupLetter).map((m) => m.groupLetter!))
  ).sort();

  return (
    <div className="space-y-4 relative">
      <SaveIndicator status={status} errorMsg={errorMsg} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          {completedCount}/{matches.length} predichos
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-2 py-1 text-xs rounded ${
              filter === "all" ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          {groupLetters.map((g) => (
            <button
              key={g}
              onClick={() => setFilter(g)}
              className={`px-2 py-1 text-xs rounded ${
                filter === g ? "bg-black text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Grupo {g}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {sortedDates.map((dateKey) => (
          <div key={dateKey} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-600">
              <LocalDate iso={groupedByDate[dateKey][0].kickoff} format="date" />
            </div>
            <div className="divide-y">
              {groupedByDate[dateKey].map((m) => {
                const p = preds[m.id] ?? { predHomeScore: null, predAwayScore: null, pointsAwarded: 0 };
                const isHomeWinner =
                  p.predHomeScore != null && p.predAwayScore != null && p.predHomeScore > p.predAwayScore;
                const isAwayWinner =
                  p.predHomeScore != null && p.predAwayScore != null && p.predAwayScore > p.predHomeScore;
                return (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs text-gray-500">
                        Grupo {m.groupLetter} · J{m.matchday} ·{" "}
                        <LocalDate iso={m.kickoff} format="time" />
                      </div>
                      {p.pointsAwarded > 0 && (
                        <div className="text-xs font-medium text-green-700">
                          +{p.pointsAwarded} pts
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                      <div className={`text-right text-sm ${isHomeWinner ? "font-bold" : ""}`}>
                        <span className="mr-1">{m.homeTeam.flag}</span>
                        {m.homeTeam.name}
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={p.predHomeScore ?? ""}
                          onChange={(e) =>
                            updatePred(m.id, {
                              predHomeScore: e.target.value === "" ? null : parseInt(e.target.value),
                            })
                          }
                          placeholder="-"
                          disabled={locked}
                          className="w-12 text-center border rounded px-1 py-1 font-semibold disabled:bg-gray-100"
                        />
                        <span className="text-gray-400">–</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={p.predAwayScore ?? ""}
                          onChange={(e) =>
                            updatePred(m.id, {
                              predAwayScore: e.target.value === "" ? null : parseInt(e.target.value),
                            })
                          }
                          placeholder="-"
                          disabled={locked}
                          className="w-12 text-center border rounded px-1 py-1 font-semibold disabled:bg-gray-100"
                        />
                      </div>

                      <div className={`text-left text-sm ${isAwayWinner ? "font-bold" : ""}`}>
                        <span className="mr-1">{m.awayTeam.flag}</span>
                        {m.awayTeam.name}
                      </div>
                    </div>

                    {m.venue && (
                      <div className="text-xs text-gray-400 text-center mt-1">{m.venue}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveIndicator({ status, errorMsg }: { status: SaveStatus; errorMsg: string | null }) {
  if (status === "idle") return null;
  let bg = "bg-gray-100 text-gray-700";
  let text = "";
  if (status === "pending") {
    bg = "bg-gray-100 text-gray-600";
    text = "● Cambios sin guardar...";
  } else if (status === "saving") {
    bg = "bg-blue-50 text-blue-700";
    text = "⟳ Guardando...";
  } else if (status === "saved") {
    bg = "bg-green-50 text-green-700";
    text = "✓ Guardado";
  } else if (status === "error") {
    bg = "bg-red-50 text-red-700";
    text = `✕ Error: ${errorMsg ?? "no se pudo guardar"}`;
  }
  return (
    <div className={`fixed top-20 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-medium shadow-md ${bg}`}>
      {text}
    </div>
  );
}
