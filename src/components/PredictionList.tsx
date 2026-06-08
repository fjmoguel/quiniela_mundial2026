"use client";
import { useMemo, useState } from "react";

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
};

type Pred = {
  predHomeScore: number;
  predAwayScore: number;
  predExtraTime: boolean;
  predPenalties: boolean;
  pointsAwarded: number;
};

const STAGE_LABELS: Record<string, string> = {
  group: "Fase de grupos",
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinal",
  third_place: "Tercer lugar",
  final: "Final",
};

function isLocked(kickoffISO: string): boolean {
  const cutoff = new Date(new Date(kickoffISO).getTime() - 15 * 60 * 1000);
  return new Date() >= cutoff;
}

export default function PredictionList({
  matches,
  myPreds,
}: {
  matches: Match[];
  myPreds: Record<string, Pred>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [preds, setPreds] = useState<Record<string, Pred>>(myPreds);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return matches;
    if (filter === "pending") return matches.filter((m) => !preds[m.id] && !isLocked(m.kickoff));
    if (filter === "done") return matches.filter((m) => preds[m.id]);
    return matches.filter((m) => m.stage === filter);
  }, [matches, filter, preds]);

  async function savePrediction(matchId: string, p: Pred) {
    setSavingId(matchId);
    setError(null);
    try {
      const r = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, ...p }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setPreds((prev) => ({ ...prev, [matchId]: { ...p, pointsAwarded: 0 } }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  const stages = ["all", "pending", "done", "group", "r32", "r16", "qf", "sf", "final"];

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm rounded">
          {error}
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {stages.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border whitespace-nowrap ${
              filter === s
                ? "bg-black text-white border-black"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {s === "all" ? "Todos" : s === "pending" ? "Pendientes" : s === "done" ? "Hechas" : STAGE_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-500 text-sm">No hay partidos.</p>
        ) : (
          filtered.map((m) => (
            <PredictionRow
              key={m.id}
              match={m}
              pred={preds[m.id]}
              onSave={(p) => savePrediction(m.id, p)}
              saving={savingId === m.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PredictionRow({
  match,
  pred,
  onSave,
  saving,
}: {
  match: Match;
  pred: Pred | undefined;
  onSave: (p: Pred) => void;
  saving: boolean;
}) {
  const [home, setHome] = useState<number>(pred?.predHomeScore ?? 0);
  const [away, setAway] = useState<number>(pred?.predAwayScore ?? 0);
  const [et, setEt] = useState<boolean>(pred?.predExtraTime ?? false);
  const [pen, setPen] = useState<boolean>(pred?.predPenalties ?? false);
  const locked = isLocked(match.kickoff);
  const isKO = match.stage !== "group";
  const hasResult = match.homeScore != null && match.awayScore != null;

  function adjust(side: "home" | "away", delta: number) {
    if (side === "home") setHome((v) => Math.max(0, Math.min(20, v + delta)));
    else setAway((v) => Math.max(0, Math.min(20, v + delta)));
  }

  const stageBadge =
    match.stage === "group"
      ? `Grupo ${match.groupLetter} · J${match.matchday}`
      : STAGE_LABELS[match.stage] ?? match.stage;

  return (
    <div className={`px-4 py-4 border-b last:border-b-0 ${locked ? "bg-gray-50" : ""}`}>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span className="font-medium">{stageBadge}</span>
        <span>
          {new Date(match.kickoff).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {locked && <span className="ml-2 text-red-500">🔒 Cerrado</span>}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
        {/* Home */}
        <div className="text-right">
          <div className="text-2xl">{match.homeTeam.flag}</div>
          <div className="text-sm font-medium">{match.homeTeam.name}</div>
        </div>

        {/* Score controls */}
        <div className="flex items-center gap-2">
          <ScoreControl value={home} onChange={setHome} onAdjust={(d) => adjust("home", d)} disabled={locked} />
          <span className="text-gray-400">–</span>
          <ScoreControl value={away} onChange={setAway} onAdjust={(d) => adjust("away", d)} disabled={locked} />
        </div>

        {/* Away */}
        <div className="text-left">
          <div className="text-2xl">{match.awayTeam.flag}</div>
          <div className="text-sm font-medium">{match.awayTeam.name}</div>
        </div>
      </div>

      {/* KO extras */}
      {isKO && (
        <div className="flex justify-center gap-4 mt-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={et}
              onChange={(e) => setEt(e.target.checked)}
              disabled={locked}
            />
            Tiempo extra
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={pen}
              onChange={(e) => setPen(e.target.checked)}
              disabled={locked}
            />
            Penales
          </label>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-gray-500">
          {hasResult && (
            <span>
              Resultado real:{" "}
              <span className="font-semibold text-gray-900">
                {match.homeScore} – {match.awayScore}
              </span>
              {pred && (
                <span className="ml-2">
                  · Tus puntos: <span className="font-semibold">{pred.pointsAwarded}</span>
                </span>
              )}
            </span>
          )}
          {!hasResult && pred && (
            <span className="text-green-600">
              ✓ Guardado: {pred.predHomeScore}–{pred.predAwayScore}
            </span>
          )}
        </div>
        {!locked && (
          <button
            onClick={() => onSave({ predHomeScore: home, predAwayScore: away, predExtraTime: et, predPenalties: pen, pointsAwarded: 0 })}
            disabled={saving}
            className="px-3 py-1.5 bg-black text-white text-sm rounded hover:opacity-85 disabled:opacity-50"
          >
            {saving ? "..." : pred ? "Actualizar" : "Guardar"}
          </button>
        )}
      </div>
    </div>
  );
}

function ScoreControl({
  value,
  onChange,
  onAdjust,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  onAdjust: (delta: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onAdjust(-1)}
        disabled={disabled || value <= 0}
        className="w-7 h-7 border rounded hover:bg-gray-100 disabled:opacity-30"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        max={20}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(20, parseInt(e.target.value || "0"))))}
        disabled={disabled}
        className="w-12 text-center border rounded px-1 py-1 text-lg font-semibold"
      />
      <button
        type="button"
        onClick={() => onAdjust(1)}
        disabled={disabled || value >= 20}
        className="w-7 h-7 border rounded hover:bg-gray-100 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
