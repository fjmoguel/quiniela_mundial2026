"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import LocalDate from "./LocalDate";

type Team = { id: string; name: string; flag: string };
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
};
type Pred = {
  predHomeScore: number;
  predAwayScore: number;
  predExtraTime: boolean;
  predPenalties: boolean;
  pointsAwarded: number;
};

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

// LocalStorage keys for persistent UI state
const LS_ONLY_TODAY = "quiniela:onlyToday";
const LS_FILTER = "quiniela:groupFilter";

export default function PredictionList({
  matches,
  myPreds: initial,
  locked,
}: {
  matches: Match[];
  myPreds: Record<string, Pred>;
  locked: boolean;
}) {
  // Start with defaults to avoid SSR hydration mismatch.
  // Then hydrate from localStorage in useEffect so the state survives
  // user switches (which re-mount this component via `key={userId}`).
  const [filter, setFilter] = useState<string>("all");
  const [onlyToday, setOnlyToday] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  const [myPreds, setMyPreds] = useState<Record<string, Pred>>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Hydrate from localStorage on mount (client-only, after SSR)
  useEffect(() => {
    try {
      const savedToday = localStorage.getItem(LS_ONLY_TODAY);
      if (savedToday === "true") setOnlyToday(true);
      const savedFilter = localStorage.getItem(LS_FILTER);
      if (savedFilter && (savedFilter === "all" || GROUPS.includes(savedFilter))) {
        setFilter(savedFilter);
      }
    } catch {
      // localStorage not available, ignore
    }
    setHydrated(true);
  }, []);

  // Persist to localStorage when changed (only after hydration to avoid overwriting)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_ONLY_TODAY, String(onlyToday));
    } catch {}
  }, [onlyToday, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_FILTER, filter);
    } catch {}
  }, [filter, hydrated]);

  const todayDateKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const groupedByDate = useMemo(() => {
    let filtered = filter === "all" ? matches : matches.filter((m) => m.groupLetter === filter);
    if (onlyToday) {
      filtered = filtered.filter((m) => {
        const d = new Date(m.kickoff);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return key === todayDateKey;
      });
    }
    const byDate: Record<string, Match[]> = {};
    for (const m of filtered) {
      const d = new Date(m.kickoff);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(m);
    }
    for (const key of Object.keys(byDate)) {
      byDate[key].sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    }
    return byDate;
  }, [matches, filter, onlyToday, todayDateKey]);

  function update(matchId: string, partial: Partial<Pred>) {
    if (locked) return;
    setMyPreds((curr) => {
      const next = {
        ...curr,
        [matchId]: {
          predHomeScore: 0,
          predAwayScore: 0,
          predExtraTime: false,
          predPenalties: false,
          pointsAwarded: 0,
          ...curr[matchId],
          ...partial,
        },
      };
      if (saveTimer.current[matchId]) clearTimeout(saveTimer.current[matchId]);
      saveTimer.current[matchId] = setTimeout(() => save(matchId, next[matchId]), 700);
      return next;
    });
  }

  async function save(matchId: string, pred: Pred) {
    setSaveState("saving");
    try {
      const r = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          predHomeScore: pred.predHomeScore,
          predAwayScore: pred.predAwayScore,
          predExtraTime: pred.predExtraTime,
          predPenalties: pred.predPenalties,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Error guardando");
      }
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setSaveState("error");
      console.error(e);
    }
  }

  const predCount = Object.keys(myPreds).length;
  const showingDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-3 relative">
      {saveState !== "idle" && (
        <div className="fixed top-20 right-4 z-50 bg-white border shadow-md rounded px-3 py-1.5 text-xs">
          {saveState === "saving" && <span className="text-gray-600">⟳ Guardando...</span>}
          {saveState === "saved" && <span className="text-green-600">✓ Guardado</span>}
          {saveState === "error" && <span className="text-red-600">✗ Error al guardar</span>}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          {predCount}/72 predichos
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <span className="font-medium">Solo hoy</span>
            <span
              onClick={() => setOnlyToday(!onlyToday)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${onlyToday ? "bg-green-600" : "bg-gray-300"}`}
              role="switch"
              aria-checked={onlyToday}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${onlyToday ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </span>
          </label>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setFilter("all")}
              className={`px-2 py-1 text-xs rounded ${filter === "all" ? "bg-black text-white" : "bg-gray-100"}`}
            >
              Todos
            </button>
            {GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`px-2 py-1 text-xs rounded ${filter === g ? "bg-black text-white" : "bg-gray-100"}`}
              >
                Grupo {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {onlyToday && showingDates.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-3 rounded text-sm text-center">
          ⚽ No hay partidos hoy{filter !== "all" ? ` para el Grupo ${filter}` : ""}.{" "}
          <button onClick={() => setOnlyToday(false)} className="underline font-medium">
            Ver todos los días
          </button>
        </div>
      )}

      <div className="space-y-3">
        {showingDates.map((dateKey) => {
          const dayMatches = groupedByDate[dateKey];
          return (
            <div key={dateKey} className="bg-white border rounded-lg overflow-hidden">
              <div className={`px-3 py-2 border-b text-sm font-medium ${dateKey === todayDateKey ? "bg-green-50 text-green-800 border-green-200" : "bg-gray-50"}`}>
                <LocalDate iso={dayMatches[0].kickoff} format="date" />
                {dateKey === todayDateKey && (
                  <span className="ml-2 text-xs bg-green-200 text-green-900 px-1.5 py-0.5 rounded font-semibold">
                    HOY
                  </span>
                )}
              </div>
              <div className="divide-y">
                {dayMatches.map((m) => {
                  const pred = myPreds[m.id];
                  return (
                    <div key={m.id} className="px-3 py-2 space-y-1.5">
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>
                          {m.groupLetter ? `Grupo ${m.groupLetter} · J${m.matchday}` : m.label}{" "}
                          · <LocalDate iso={m.kickoff} format="time" />
                        </span>
                        {pred?.pointsAwarded > 0 && (
                          <span className="text-green-700 font-semibold">+{pred.pointsAwarded} pts</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-right text-sm">
                          {m.homeTeam.flag} <strong>{m.homeTeam.name}</strong>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={pred?.predHomeScore ?? ""}
                          onChange={(e) =>
                            update(m.id, { predHomeScore: parseInt(e.target.value) || 0 })
                          }
                          disabled={locked}
                          className="w-12 border rounded px-1 py-0.5 text-center disabled:bg-gray-100"
                        />
                        <span>–</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={pred?.predAwayScore ?? ""}
                          onChange={(e) =>
                            update(m.id, { predAwayScore: parseInt(e.target.value) || 0 })
                          }
                          disabled={locked}
                          className="w-12 border rounded px-1 py-0.5 text-center disabled:bg-gray-100"
                        />
                        <div className="flex-1 text-left text-sm">
                          {m.awayTeam.flag} <strong>{m.awayTeam.name}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
