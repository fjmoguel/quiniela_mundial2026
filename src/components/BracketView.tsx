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

export default function BracketView({
  bracket,
  locked,
}: {
  bracket: BracketSlot[];
  locked: boolean;
}) {
  const [slots, setSlots] = useState<BracketSlot[]>(bracket);
  const [editingMatchNum, setEditingMatchNum] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function updateSlot(matchNum: number, patch: Partial<BracketSlot>) {
    setSlots((prev) => prev.map((s) => (s.matchNum === matchNum ? { ...s, ...patch } : s)));
  }

  async function saveSlot(slot: BracketSlot) {
    if (!slot.matchId) {
      setFeedback("Este partido aún no tiene equipos (faltan picks de grupos)");
      return;
    }
    if (slot.predHomeScore == null || slot.predAwayScore == null) {
      setFeedback("Mete un marcador");
      return;
    }
    setSavingId(slot.matchNum);
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
      setTimeout(() => setFeedback(null), 2000);
      setEditingMatchNum(null);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    } finally {
      setSavingId(null);
    }
  }

  const r32 = slots.filter((s) => s.stage === "r32").sort((a, b) => a.matchNum - b.matchNum);
  const r16 = slots.filter((s) => s.stage === "r16").sort((a, b) => a.matchNum - b.matchNum);
  const qf = slots.filter((s) => s.stage === "qf").sort((a, b) => a.matchNum - b.matchNum);
  const sf = slots.filter((s) => s.stage === "sf").sort((a, b) => a.matchNum - b.matchNum);
  const finalSlot = slots.find((s) => s.stage === "final");
  const thirdSlot = slots.find((s) => s.stage === "third_place");

  const MATCH_H = 80; // height of each match card

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`sticky top-2 z-20 px-3 py-2 rounded text-sm ${
            feedback.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto bg-white border rounded-lg p-4">
        <div className="flex gap-3 min-w-[1800px]">
          {/* R32 column - 16 matches stacked */}
          <BracketColumn title="Dieciseisavos" matches={r32} matchH={MATCH_H} spacing={10} locked={locked}
            editingMatchNum={editingMatchNum} setEditingMatchNum={setEditingMatchNum}
            updateSlot={updateSlot} saveSlot={saveSlot} savingId={savingId} />

          <Connectors count={16} matchH={MATCH_H} spacing={10} />

          {/* R16 - 8 matches */}
          <BracketColumn title="Octavos" matches={r16} matchH={MATCH_H} spacing={MATCH_H + 30} locked={locked}
            editingMatchNum={editingMatchNum} setEditingMatchNum={setEditingMatchNum}
            updateSlot={updateSlot} saveSlot={saveSlot} savingId={savingId} />

          <Connectors count={8} matchH={MATCH_H} spacing={MATCH_H + 30} />

          {/* QF - 4 matches */}
          <BracketColumn title="Cuartos" matches={qf} matchH={MATCH_H} spacing={MATCH_H * 3 + 50} locked={locked}
            editingMatchNum={editingMatchNum} setEditingMatchNum={setEditingMatchNum}
            updateSlot={updateSlot} saveSlot={saveSlot} savingId={savingId} />

          <Connectors count={4} matchH={MATCH_H} spacing={MATCH_H * 3 + 50} />

          {/* SF - 2 matches */}
          <BracketColumn title="Semis" matches={sf} matchH={MATCH_H} spacing={MATCH_H * 7 + 90} locked={locked}
            editingMatchNum={editingMatchNum} setEditingMatchNum={setEditingMatchNum}
            updateSlot={updateSlot} saveSlot={saveSlot} savingId={savingId} />

          <Connectors count={2} matchH={MATCH_H} spacing={MATCH_H * 7 + 90} />

          {/* Final + 3rd place */}
          <div className="flex flex-col gap-3" style={{ width: 170 }}>
            <div className="text-xs font-semibold text-center pb-1 text-yellow-700">🏆 FINAL</div>
            <div style={{ marginTop: MATCH_H * 7 + 50 }}>
              {finalSlot && (
                <MatchCard slot={finalSlot} locked={locked} matchH={MATCH_H}
                  isEditing={editingMatchNum === finalSlot.matchNum}
                  onClick={() => setEditingMatchNum(finalSlot.matchNum)}
                  onClose={() => setEditingMatchNum(null)}
                  updateSlot={(p) => updateSlot(finalSlot.matchNum, p)}
                  onSave={() => saveSlot(finalSlot)}
                  saving={savingId === finalSlot.matchNum} />
              )}
            </div>
            <div className="text-xs font-semibold text-center pt-3 text-amber-700">🥉 3er lugar</div>
            {thirdSlot && (
              <MatchCard slot={thirdSlot} locked={locked} matchH={MATCH_H}
                isEditing={editingMatchNum === thirdSlot.matchNum}
                onClick={() => setEditingMatchNum(thirdSlot.matchNum)}
                onClose={() => setEditingMatchNum(null)}
                updateSlot={(p) => updateSlot(thirdSlot.matchNum, p)}
                onSave={() => saveSlot(thirdSlot)}
                saving={savingId === thirdSlot.matchNum} />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 px-1">
        💡 Haz click en cualquier partido para meter marcador. El bracket se arma con tus
        picks de grupos.
      </p>
    </div>
  );
}

function BracketColumn({
  title,
  matches,
  matchH,
  spacing,
  locked,
  editingMatchNum,
  setEditingMatchNum,
  updateSlot,
  saveSlot,
  savingId,
}: {
  title: string;
  matches: BracketSlot[];
  matchH: number;
  spacing: number;
  locked: boolean;
  editingMatchNum: number | null;
  setEditingMatchNum: (n: number | null) => void;
  updateSlot: (n: number, p: Partial<BracketSlot>) => void;
  saveSlot: (s: BracketSlot) => void;
  savingId: number | null;
}) {
  return (
    <div className="flex flex-col" style={{ width: 170, gap: spacing - matchH }}>
      <div className="text-xs font-semibold text-center text-gray-600 pb-1 sticky top-0 bg-white">
        {title}
      </div>
      {matches.map((m) => (
        <MatchCard
          key={m.matchNum}
          slot={m}
          locked={locked}
          matchH={matchH}
          isEditing={editingMatchNum === m.matchNum}
          onClick={() => setEditingMatchNum(m.matchNum)}
          onClose={() => setEditingMatchNum(null)}
          updateSlot={(p) => updateSlot(m.matchNum, p)}
          onSave={() => saveSlot(m)}
          saving={savingId === m.matchNum}
        />
      ))}
    </div>
  );
}

function Connectors({
  count,
  matchH,
  spacing,
}: {
  count: number;
  matchH: number;
  spacing: number;
}) {
  // Draw SVG lines connecting pairs of matches to the next round
  const totalHeight = count * spacing + 30;
  const lines = [];
  for (let i = 0; i < count / 2; i++) {
    const y1 = 30 + i * 2 * spacing + matchH / 2;
    const y2 = 30 + (i * 2 + 1) * spacing + matchH / 2;
    const yMid = (y1 + y2) / 2;
    lines.push(
      <g key={i}>
        <line x1="0" y1={y1} x2="10" y2={y1} stroke="#d1d5db" strokeWidth="1.5" />
        <line x1="0" y1={y2} x2="10" y2={y2} stroke="#d1d5db" strokeWidth="1.5" />
        <line x1="10" y1={y1} x2="10" y2={y2} stroke="#d1d5db" strokeWidth="1.5" />
        <line x1="10" y1={yMid} x2="20" y2={yMid} stroke="#d1d5db" strokeWidth="1.5" />
      </g>
    );
  }
  return (
    <svg width="20" height={totalHeight} style={{ minWidth: 20 }}>
      {lines}
    </svg>
  );
}

function MatchCard({
  slot,
  locked,
  matchH,
  isEditing,
  onClick,
  onClose,
  updateSlot,
  onSave,
  saving,
}: {
  slot: BracketSlot;
  locked: boolean;
  matchH: number;
  isEditing: boolean;
  onClick: () => void;
  onClose: () => void;
  updateSlot: (p: Partial<BracketSlot>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const hasTeams = !!(slot.homeTeamId && slot.awayTeamId);
  const home = slot.homeTeam ?? { name: slot.homeLabel, flag: "❓" };
  const away = slot.awayTeam ?? { name: slot.awayLabel, flag: "❓" };
  const homeWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.homeTeamId;
  const awayWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.awayTeamId;

  if (isEditing) {
    return (
      <div className="border-2 border-blue-400 bg-blue-50 rounded p-2 text-xs" style={{ width: 170 }}>
        <div className="text-[10px] text-gray-500 mb-1">Partido {slot.matchNum}</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-base w-5">{home.flag}</span>
            <span className="flex-1 truncate">{home.name}</span>
            <input type="number" min={0} max={20} value={slot.predHomeScore ?? ""}
              onChange={(e) => updateSlot({ predHomeScore: e.target.value === "" ? null : parseInt(e.target.value) })}
              className="w-8 px-1 py-0.5 border rounded text-center" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-base w-5">{away.flag}</span>
            <span className="flex-1 truncate">{away.name}</span>
            <input type="number" min={0} max={20} value={slot.predAwayScore ?? ""}
              onChange={(e) => updateSlot({ predAwayScore: e.target.value === "" ? null : parseInt(e.target.value) })}
              className="w-8 px-1 py-0.5 border rounded text-center" />
          </div>
        </div>
        <div className="flex gap-2 mt-1 text-[10px]">
          <label className="flex items-center gap-0.5">
            <input type="checkbox" checked={slot.predExtraTime}
              onChange={(e) => updateSlot({ predExtraTime: e.target.checked })} />
            ET
          </label>
          <label className="flex items-center gap-0.5">
            <input type="checkbox" checked={slot.predPenalties}
              onChange={(e) => updateSlot({ predPenalties: e.target.checked })} />
            Pen
          </label>
        </div>
        <div className="flex gap-1 mt-1">
          <button onClick={onSave} disabled={saving || locked}
            className="flex-1 px-2 py-0.5 bg-black text-white text-[10px] rounded disabled:opacity-50">
            {saving ? "..." : "OK"}
          </button>
          <button onClick={onClose}
            className="px-2 py-0.5 border text-[10px] rounded">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={locked && !hasTeams}
      className={`border rounded p-1.5 text-xs text-left hover:border-blue-400 transition ${
        !hasTeams ? "bg-gray-50 border-gray-200" : "bg-white"
      }`}
      style={{ width: 170, height: matchH }}
    >
      <div className="text-[9px] text-gray-400 mb-0.5">Partido {slot.matchNum}</div>
      <div className={`flex items-center gap-1 ${homeWon ? "font-bold" : ""}`}>
        <span className="text-base w-5">{home.flag}</span>
        <span className="flex-1 truncate">{home.name}</span>
        <span className="font-mono w-4 text-right">{slot.predHomeScore ?? "-"}</span>
      </div>
      <div className={`flex items-center gap-1 ${awayWon ? "font-bold" : ""}`}>
        <span className="text-base w-5">{away.flag}</span>
        <span className="flex-1 truncate">{away.name}</span>
        <span className="font-mono w-4 text-right">{slot.predAwayScore ?? "-"}</span>
      </div>
      {(slot.predExtraTime || slot.predPenalties) && (
        <div className="text-[9px] text-blue-600 mt-0.5">
          {slot.predExtraTime ? "ET " : ""}
          {slot.predPenalties ? "PEN" : ""}
        </div>
      )}
    </button>
  );
}
