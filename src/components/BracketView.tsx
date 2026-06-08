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

// Bracket layout constants
const CARD_H = 70;
const CARD_W = 210;
const COL_GAP = 40; // horizontal gap between rounds
const TOTAL_H = 16 * CARD_H + 15 * 10; // total height to fit 16 R32 cards

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
      setFeedback("Falta llenar tus picks de grupos primero");
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

  // Position of each card's center per round
  function getCenterY(round: "r32" | "r16" | "qf" | "sf" | "final", idx: number): number {
    const counts = { r32: 16, r16: 8, qf: 4, sf: 2, final: 1 };
    const n = counts[round];
    return (TOTAL_H * (idx + 0.5)) / n;
  }

  // Width of one round (card + connector area)
  const ROUND_W = CARD_W + COL_GAP;
  const totalWidth = ROUND_W * 5 + CARD_W + 60; // 5 rounds + final card + padding for 3rd place

  return (
    <div className="space-y-3">
      {feedback && (
        <div
          className={`sticky top-2 z-20 px-3 py-2 rounded text-sm ${
            feedback.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="overflow-x-auto bg-white border rounded-lg p-4">
        <div style={{ position: "relative", width: totalWidth, height: TOTAL_H + 40 }}>
          {/* Column headers */}
          {["Dieciseisavos", "Octavos", "Cuartos", "Semis", "Final"].map((title, i) => (
            <div
              key={title}
              style={{
                position: "absolute",
                left: i * ROUND_W,
                top: 0,
                width: CARD_W,
                textAlign: "center",
              }}
              className="text-xs font-semibold text-gray-600"
            >
              {title}
            </div>
          ))}

          {/* SVG layer for connector lines */}
          <svg
            style={{ position: "absolute", left: 0, top: 25, pointerEvents: "none" }}
            width={totalWidth}
            height={TOTAL_H}
          >
            {/* R32 → R16 connectors */}
            {Array.from({ length: 8 }).map((_, i) => {
              const y1 = getCenterY("r32", i * 2);
              const y2 = getCenterY("r32", i * 2 + 1);
              const yMid = getCenterY("r16", i);
              const x1 = CARD_W;
              const x2 = ROUND_W;
              return (
                <g key={`r32-r16-${i}`} stroke="#d1d5db" strokeWidth="1.5" fill="none">
                  <path d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${yMid} H ${x2}`} />
                  <path d={`M ${x1} ${y2} H ${(x1 + x2) / 2} V ${yMid}`} />
                </g>
              );
            })}
            {/* R16 → QF connectors */}
            {Array.from({ length: 4 }).map((_, i) => {
              const y1 = getCenterY("r16", i * 2);
              const y2 = getCenterY("r16", i * 2 + 1);
              const yMid = getCenterY("qf", i);
              const x1 = ROUND_W + CARD_W;
              const x2 = ROUND_W * 2;
              return (
                <g key={`r16-qf-${i}`} stroke="#d1d5db" strokeWidth="1.5" fill="none">
                  <path d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${yMid} H ${x2}`} />
                  <path d={`M ${x1} ${y2} H ${(x1 + x2) / 2} V ${yMid}`} />
                </g>
              );
            })}
            {/* QF → SF connectors */}
            {Array.from({ length: 2 }).map((_, i) => {
              const y1 = getCenterY("qf", i * 2);
              const y2 = getCenterY("qf", i * 2 + 1);
              const yMid = getCenterY("sf", i);
              const x1 = ROUND_W * 2 + CARD_W;
              const x2 = ROUND_W * 3;
              return (
                <g key={`qf-sf-${i}`} stroke="#d1d5db" strokeWidth="1.5" fill="none">
                  <path d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${yMid} H ${x2}`} />
                  <path d={`M ${x1} ${y2} H ${(x1 + x2) / 2} V ${yMid}`} />
                </g>
              );
            })}
            {/* SF → Final connectors */}
            {Array.from({ length: 1 }).map((_, i) => {
              const y1 = getCenterY("sf", 0);
              const y2 = getCenterY("sf", 1);
              const yMid = getCenterY("final", 0);
              const x1 = ROUND_W * 3 + CARD_W;
              const x2 = ROUND_W * 4;
              return (
                <g key={`sf-final-${i}`} stroke="#facc15" strokeWidth="2" fill="none">
                  <path d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${yMid} H ${x2}`} />
                  <path d={`M ${x1} ${y2} H ${(x1 + x2) / 2} V ${yMid}`} />
                </g>
              );
            })}
          </svg>

          {/* Cards */}
          {r32.map((m, i) => (
            <PositionedCard key={m.matchNum} slot={m} top={getCenterY("r32", i) - CARD_H / 2 + 25}
              left={0} locked={locked} editing={editingMatchNum === m.matchNum}
              onClick={() => setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p) => updateSlot(m.matchNum, p)} save={() => saveSlot(m)}
              saving={savingId === m.matchNum} />
          ))}
          {r16.map((m, i) => (
            <PositionedCard key={m.matchNum} slot={m} top={getCenterY("r16", i) - CARD_H / 2 + 25}
              left={ROUND_W} locked={locked} editing={editingMatchNum === m.matchNum}
              onClick={() => setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p) => updateSlot(m.matchNum, p)} save={() => saveSlot(m)}
              saving={savingId === m.matchNum} />
          ))}
          {qf.map((m, i) => (
            <PositionedCard key={m.matchNum} slot={m} top={getCenterY("qf", i) - CARD_H / 2 + 25}
              left={ROUND_W * 2} locked={locked} editing={editingMatchNum === m.matchNum}
              onClick={() => setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p) => updateSlot(m.matchNum, p)} save={() => saveSlot(m)}
              saving={savingId === m.matchNum} />
          ))}
          {sf.map((m, i) => (
            <PositionedCard key={m.matchNum} slot={m} top={getCenterY("sf", i) - CARD_H / 2 + 25}
              left={ROUND_W * 3} locked={locked} editing={editingMatchNum === m.matchNum}
              onClick={() => setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p) => updateSlot(m.matchNum, p)} save={() => saveSlot(m)}
              saving={savingId === m.matchNum} />
          ))}
          {finalSlot && (
            <PositionedCard slot={finalSlot} top={getCenterY("final", 0) - CARD_H / 2 + 25}
              left={ROUND_W * 4} locked={locked} editing={editingMatchNum === finalSlot.matchNum}
              onClick={() => setEditingMatchNum(finalSlot.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p) => updateSlot(finalSlot.matchNum, p)} save={() => saveSlot(finalSlot)}
              saving={savingId === finalSlot.matchNum}
              isFinal />
          )}
          {/* 3rd place — below final, separately */}
          {thirdSlot && (
            <div style={{ position: "absolute", left: ROUND_W * 4, top: TOTAL_H - CARD_H - 20 + 25, width: CARD_W }}>
              <div className="text-[11px] font-semibold text-center mb-1 text-amber-700">
                🥉 Tercer lugar
              </div>
              <PositionedCard slot={thirdSlot} top={0} left={0}
                locked={locked} editing={editingMatchNum === thirdSlot.matchNum}
                onClick={() => setEditingMatchNum(thirdSlot.matchNum)}
                onClose={() => setEditingMatchNum(null)}
                update={(p) => updateSlot(thirdSlot.matchNum, p)} save={() => saveSlot(thirdSlot)}
                saving={savingId === thirdSlot.matchNum} inline />
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 px-1">
        💡 Click en cualquier partido para meter marcador. El bracket se arma con tus picks
        de grupos.
      </p>
    </div>
  );
}

function PositionedCard(props: any) {
  const { slot, top, left, locked, editing, onClick, onClose, update, save, saving, isFinal, inline } = props;
  const style: any = inline ? {} : { position: "absolute", top, left, width: CARD_W };
  return (
    <div style={style}>
      <Card slot={slot} locked={locked} editing={editing}
        onClick={onClick} onClose={onClose}
        update={update} save={save} saving={saving} isFinal={isFinal} />
    </div>
  );
}

function Card({
  slot,
  locked,
  editing,
  onClick,
  onClose,
  update,
  save,
  saving,
  isFinal,
}: any) {
  const hasTeams = !!(slot.homeTeamId && slot.awayTeamId);
  const home = slot.homeTeam ?? { name: slot.homeLabel, flag: "" };
  const away = slot.awayTeam ?? { name: slot.awayLabel, flag: "" };
  const homeWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.homeTeamId;
  const awayWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.awayTeamId;
  const border = isFinal ? "border-yellow-400 border-2" : "border-gray-200";
  const bg = !hasTeams ? "bg-gray-50" : "bg-white";

  if (editing) {
    return (
      <div className={`border-2 border-blue-400 bg-blue-50 rounded p-2 text-xs`} style={{ height: CARD_H + 60 }}>
        <div className="text-[10px] text-gray-500 mb-1">Partido {slot.matchNum}</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-base w-5">{home.flag || "·"}</span>
            <span className="flex-1 truncate text-[11px]">{home.name}</span>
            <input type="number" min={0} max={20} value={slot.predHomeScore ?? ""}
              onChange={(e) => update({ predHomeScore: e.target.value === "" ? null : parseInt(e.target.value) })}
              className="w-9 px-1 py-0.5 border rounded text-center" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-base w-5">{away.flag || "·"}</span>
            <span className="flex-1 truncate text-[11px]">{away.name}</span>
            <input type="number" min={0} max={20} value={slot.predAwayScore ?? ""}
              onChange={(e) => update({ predAwayScore: e.target.value === "" ? null : parseInt(e.target.value) })}
              className="w-9 px-1 py-0.5 border rounded text-center" />
          </div>
        </div>
        <div className="flex gap-3 mt-1.5 text-[10px]">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={slot.predExtraTime}
              onChange={(e) => update({ predExtraTime: e.target.checked })} />
            ET +5
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={slot.predPenalties}
              onChange={(e) => update({ predPenalties: e.target.checked })} />
            Pen +8
          </label>
        </div>
        <div className="flex gap-1 mt-1.5">
          <button onClick={save} disabled={saving || locked}
            className="flex-1 px-2 py-1 bg-black text-white text-[11px] rounded disabled:opacity-50">
            {saving ? "..." : "Guardar"}
          </button>
          <button onClick={onClose} className="px-2 py-1 border text-[11px] rounded">
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={onClick} disabled={locked && !hasTeams}
      className={`w-full border ${border} ${bg} rounded p-1.5 text-xs text-left hover:border-blue-400 transition cursor-pointer disabled:cursor-default`}
      style={{ height: CARD_H }}>
      <div className="text-[9px] text-gray-400 leading-tight mb-0.5">Partido {slot.matchNum}</div>
      <div className={`flex items-center gap-1 ${homeWon ? "font-bold" : ""}`}>
        <span className="text-sm w-4 shrink-0">{home.flag}</span>
        <span className="flex-1 truncate text-[11px]">
          {hasTeams ? home.name : <span className="text-gray-400 italic">{home.name}</span>}
        </span>
        <span className="font-mono w-4 text-right text-[11px]">{slot.predHomeScore ?? "·"}</span>
      </div>
      <div className={`flex items-center gap-1 ${awayWon ? "font-bold" : ""}`}>
        <span className="text-sm w-4 shrink-0">{away.flag}</span>
        <span className="flex-1 truncate text-[11px]">
          {hasTeams ? away.name : <span className="text-gray-400 italic">{away.name}</span>}
        </span>
        <span className="font-mono w-4 text-right text-[11px]">{slot.predAwayScore ?? "·"}</span>
      </div>
      {(slot.predExtraTime || slot.predPenalties) && (
        <div className="text-[9px] text-blue-600 mt-0.5 leading-none">
          {slot.predExtraTime ? "ET " : ""}
          {slot.predPenalties ? "PEN" : ""}
        </div>
      )}
    </button>
  );
}
