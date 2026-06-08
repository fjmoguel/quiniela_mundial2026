"use client";
import { useState } from "react";

type Team = { id: string; name: string; flag: string };

type BracketSlot = {
  matchNum: number;
  stage: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeLabel: string;
  awayLabel: string;
  predHomeScore: number | null;
  predAwayScore: number | null;
  predExtraTime: boolean;
  predPenalties: boolean;
  predWinnerTeamId: string | null;
  matchId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
};

const STAGE_LABELS: Record<string, string> = {
  r32: "🔵 Dieciseisavos (R32)",
  r16: "🟢 Octavos",
  qf: "🟡 Cuartos",
  sf: "🟠 Semifinales",
  third_place: "🥉 Tercer lugar",
  final: "🏆 FINAL",
};

export default function BracketView({
  bracket,
  locked,
}: {
  bracket: BracketSlot[];
  locked: boolean;
}) {
  const [slots, setSlots] = useState<BracketSlot[]>(bracket);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function saveSlot(slot: BracketSlot) {
    if (!slot.matchId) {
      setFeedback("Error: este partido aún no tiene equipos asignados");
      return;
    }
    if (slot.predHomeScore == null || slot.predAwayScore == null) {
      setFeedback("Pon un marcador antes de guardar");
      return;
    }
    setSavingId(slot.matchNum);
    setFeedback(null);
    try {
      const r = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: slot.matchId,
          predHomeScore: slot.predHomeScore,
          predAwayScore: slot.predAwayScore,
          predExtraTime: slot.predExtraTime,
          predPenalties: slot.predPenalties,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      setFeedback(`✓ Guardado partido ${slot.matchNum}`);
      setTimeout(() => setFeedback(null), 2500);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    } finally {
      setSavingId(null);
    }
  }

  function updateSlot(matchNum: number, patch: Partial<BracketSlot>) {
    setSlots((prev) =>
      prev.map((s) => (s.matchNum === matchNum ? { ...s, ...patch } : s))
    );
  }

  const byStage: Record<string, BracketSlot[]> = {};
  for (const s of slots) {
    if (!byStage[s.stage]) byStage[s.stage] = [];
    byStage[s.stage].push(s);
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          className={`sticky top-2 z-10 px-3 py-2 rounded text-sm ${
            feedback.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {feedback}
        </div>
      )}

      {["r32", "r16", "qf", "sf", "third_place", "final"].map((stage) =>
        byStage[stage] ? (
          <section key={stage} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b font-medium">
              {STAGE_LABELS[stage]}{" "}
              <span className="text-xs text-gray-500 ml-2">
                ({byStage[stage].length} partidos)
              </span>
            </div>
            <div>
              {byStage[stage].map((slot) => (
                <SlotRow
                  key={slot.matchNum}
                  slot={slot}
                  locked={locked}
                  saving={savingId === slot.matchNum}
                  onUpdate={(p) => updateSlot(slot.matchNum, p)}
                  onSave={() => saveSlot(slot)}
                />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function SlotRow({
  slot,
  locked,
  saving,
  onUpdate,
  onSave,
}: {
  slot: BracketSlot;
  locked: boolean;
  saving: boolean;
  onUpdate: (p: Partial<BracketSlot>) => void;
  onSave: () => void;
}) {
  const hasTeams = slot.homeTeamId && slot.awayTeamId;
  const showHome = slot.homeTeam ?? { name: slot.homeLabel, flag: "❓" };
  const showAway = slot.awayTeam ?? { name: slot.awayLabel, flag: "❓" };

  return (
    <div className={`px-4 py-3 border-b last:border-b-0 text-sm ${!hasTeams ? "bg-gray-50" : ""}`}>
      <div className="text-xs text-gray-500 mb-2">Partido {slot.matchNum}</div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div className="text-right">
          <div className="text-xl">{showHome.flag}</div>
          <div className="text-xs font-medium">{showHome.name}</div>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={20}
            value={slot.predHomeScore ?? ""}
            placeholder="-"
            onChange={(e) =>
              onUpdate({
                predHomeScore: e.target.value === "" ? null : parseInt(e.target.value),
              })
            }
            disabled={locked || !hasTeams}
            className="w-10 text-center border rounded px-1 py-1 font-semibold disabled:bg-gray-100"
          />
          <span className="text-gray-400">–</span>
          <input
            type="number"
            min={0}
            max={20}
            value={slot.predAwayScore ?? ""}
            placeholder="-"
            onChange={(e) =>
              onUpdate({
                predAwayScore: e.target.value === "" ? null : parseInt(e.target.value),
              })
            }
            disabled={locked || !hasTeams}
            className="w-10 text-center border rounded px-1 py-1 font-semibold disabled:bg-gray-100"
          />
        </div>

        <div className="text-left">
          <div className="text-xl">{showAway.flag}</div>
          <div className="text-xs font-medium">{showAway.name}</div>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-2 text-xs text-gray-600">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={slot.predExtraTime}
            onChange={(e) => onUpdate({ predExtraTime: e.target.checked })}
            disabled={locked || !hasTeams}
          />
          ¿Tiempo extra? (+5 pts)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={slot.predPenalties}
            onChange={(e) => onUpdate({ predPenalties: e.target.checked })}
            disabled={locked || !hasTeams}
          />
          ¿Penales? (+8 pts)
        </label>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="text-gray-500">
          {!hasTeams ? (
            <span>⏳ Esperando tus picks de grupos para asignar equipos</span>
          ) : slot.predWinnerTeamId ? (
            <span className="text-green-700">
              Avanza:{" "}
              <strong>
                {slot.predWinnerTeamId === slot.homeTeamId ? showHome.name : showAway.name}
              </strong>
            </span>
          ) : (
            <span className="text-gray-400">Mete marcador para definir ganador</span>
          )}
        </div>
        {hasTeams && !locked && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-2 py-1 bg-black text-white rounded text-xs hover:opacity-85 disabled:opacity-50"
          >
            {saving ? "..." : "Guardar"}
          </button>
        )}
      </div>
    </div>
  );
}
