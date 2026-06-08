"use client";
import { useState } from "react";

type Team = { id: string; name: string; flag: string };
type Match = {
  id: string;
  stage: string;
  groupLetter: string | null;
  matchday: number | null;
  kickoff: string;
  label: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  group: "Grupos",
  r32: "16avos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semis",
  third_place: "3er lugar",
  final: "Final",
};

export default function AdminResults({
  matches,
  allTeams,
}: {
  matches: Match[];
  allTeams: Team[];
}) {
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const filtered = matches.filter((m) => filter === "all" || m.stage === filter);

  async function save(matchId: string, payload: any) {
    setSavingId(matchId);
    setFeedback(null);
    try {
      const r = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, ...payload }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setFeedback("✓ Guardado y puntos recalculados");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function runSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      let msg = `✓ Sync OK · ${data.resultsApplied} resultados · ${data.fixturesUpdated} fechas · ${data.knockoutTeamsAssigned} equipos asignados`;
      if (data.errors?.length) msg += ` · Errores: ${data.errors.length}`;
      setFeedback(msg);
      setTimeout(() => location.reload(), 1500);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm">
          <strong>Sync automático:</strong> cada 30 min jala resultados de openfootball y API-Football.
          Tus resultados manuales nunca se sobreescriben.
        </div>
        <button
          onClick={runSync}
          disabled={syncing}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:opacity-85 disabled:opacity-50 whitespace-nowrap"
        >
          {syncing ? "Sincronizando..." : "Sync ahora"}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {["all", "group", "r32", "r16", "qf", "sf", "third_place", "final"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap ${
              filter === s ? "bg-black text-white border-black" : "bg-white"
            }`}
          >
            {s === "all" ? "Todos" : STAGE_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          className={`text-sm px-3 py-2 rounded ${
            feedback.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        {filtered.map((m) => (
          <AdminRow
            key={m.id}
            match={m}
            allTeams={allTeams}
            onSave={(p) => save(m.id, p)}
            saving={savingId === m.id}
          />
        ))}
      </div>
    </div>
  );
}

function AdminRow({
  match,
  allTeams,
  onSave,
  saving,
}: {
  match: Match;
  allTeams: Team[];
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const [home, setHome] = useState<string>(match.homeScore?.toString() ?? "");
  const [away, setAway] = useState<string>(match.awayScore?.toString() ?? "");
  const [et, setEt] = useState(match.wentToExtraTime);
  const [pen, setPen] = useState(match.wentToPenalties);
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeam?.id ?? "");
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeam?.id ?? "");

  const needsTeams = !match.homeTeam || !match.awayTeam;

  function handleSave() {
    const payload: any = {
      homeScore: home === "" ? null : parseInt(home),
      awayScore: away === "" ? null : parseInt(away),
      wentToExtraTime: et,
      wentToPenalties: pen,
    };
    if (needsTeams) {
      payload.homeTeamId = homeTeamId;
      payload.awayTeamId = awayTeamId;
    }
    onSave(payload);
  }

  return (
    <div className="px-4 py-3 border-b last:border-b-0 text-sm">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        <span>
          {match.stage === "group"
            ? `Grupo ${match.groupLetter} · J${match.matchday}`
            : match.label}
        </span>
        <span>
          {new Date(match.kickoff).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {needsTeams ? (
          <>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">— Local —</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag} {t.name}
                </option>
              ))}
            </select>
            <span>vs</span>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">— Visitante —</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag} {t.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="flex items-center gap-2 min-w-[280px]">
            <span className="text-lg">{match.homeTeam!.flag}</span>
            <span className="font-medium">{match.homeTeam!.name}</span>
            <span className="text-gray-400">vs</span>
            <span className="font-medium">{match.awayTeam!.name}</span>
            <span className="text-lg">{match.awayTeam!.flag}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={20}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="w-14 border rounded px-2 py-1 text-center font-semibold"
            placeholder="—"
          />
          <span>–</span>
          <input
            type="number"
            min={0}
            max={20}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="w-14 border rounded px-2 py-1 text-center font-semibold"
            placeholder="—"
          />
        </div>

        {match.stage !== "group" && (
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={et} onChange={(e) => setEt(e.target.checked)} />
              ET
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={pen} onChange={(e) => setPen(e.target.checked)} />
              PEN
            </label>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto px-3 py-1 bg-black text-white rounded text-sm hover:opacity-85 disabled:opacity-50"
        >
          {saving ? "..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
