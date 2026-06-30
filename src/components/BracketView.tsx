"use client";
import { useEffect, useRef, useState } from "react";

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
  predHomeScoreET: number | null;
  predAwayScoreET: number | null;
  predHomePens: number | null;
  predAwayPens: number | null;
  predExtraTime: boolean;
  predPenalties: boolean;
  predWinnerTeamId: string | null;
  matchId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
};

export type RealMatchData = {
  matchNum: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreET: number | null;
  awayScoreET: number | null;
  homePens: number | null;
  awayPens: number | null;
  wentToExtraTime: boolean;
  wentToPenalties: boolean;
  realWinnerTeamId: string | null;
};

const CARD_H = 70;
const CARD_W = 220;
const COL_GAP = 50;
const TOTAL_H = 16 * CARD_H + 15 * 10;
const DEBOUNCE_MS = 700;

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export default function BracketView({
  bracket,
  locked,
  realByMatchNum,
}: {
  bracket: BracketSlot[];
  locked: boolean;
  realByMatchNum?: Record<number, RealMatchData>;
}) {
  const [slots, setSlots] = useState<BracketSlot[]>(bracket);
  const [editingMatchNum, setEditingMatchNum] = useState<number | null>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mine" | "real">("mine");

  const hasRealData = !!realByMatchNum && Object.keys(realByMatchNum).length > 0;

  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const pendingRef = useRef<Map<number, BracketSlot>>(new Map());

  useEffect(() => {
    setSlots(bracket);
  }, [bracket]);

  function updateSlot(matchNum: number, patch: Partial<BracketSlot>) {
    setSlots((prev) => {
      const next = prev.map((s) => (s.matchNum === matchNum ? { ...s, ...patch } : s));
      const updated = next.find((s) => s.matchNum === matchNum);
      if (updated && updated.matchId && updated.predHomeScore != null && updated.predAwayScore != null) {
        pendingRef.current.set(matchNum, updated);
        setStatus("pending");
        const existing = timersRef.current.get(matchNum);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => flushSave(matchNum), DEBOUNCE_MS);
        timersRef.current.set(matchNum, t);
      }
      return next;
    });
  }

  async function flushSave(matchNum: number) {
    const slot = pendingRef.current.get(matchNum);
    if (!slot || !slot.matchId) return;
    pendingRef.current.delete(matchNum);
    timersRef.current.delete(matchNum);
    setStatus("saving");
    try {
      const r = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: slot.matchId,
          predHomeScore: slot.predHomeScore,
          predAwayScore: slot.predAwayScore,
          predHomeScoreET: slot.predHomeScoreET,
          predAwayScoreET: slot.predAwayScoreET,
          predHomePens: slot.predHomePens,
          predAwayPens: slot.predAwayPens,
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

  // When toggle is "real", replace slot data with real match data
  const displaySlots: BracketSlot[] = (viewMode === "real" && hasRealData)
    ? slots.map((s) => {
        const real = realByMatchNum![s.matchNum];
        if (!real) return s;
        return {
          ...s,
          homeTeamId: real.homeTeamId,
          awayTeamId: real.awayTeamId,
          homeTeam: real.homeTeam,
          awayTeam: real.awayTeam,
          predHomeScore: real.homeScore,
          predAwayScore: real.awayScore,
          predHomeScoreET: real.homeScoreET,
          predAwayScoreET: real.awayScoreET,
          predHomePens: real.homePens,
          predAwayPens: real.awayPens,
          predExtraTime: real.wentToExtraTime,
          predPenalties: real.wentToPenalties,
          predWinnerTeamId: real.realWinnerTeamId,
        };
      })
    : slots;

  const R32_ORDER = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
  const R16_ORDER = [89, 90, 93, 94, 91, 92, 95, 96];
  const QF_ORDER = [97, 98, 99, 100];
  const SF_ORDER = [101, 102];

  function orderBy(stage: string, order: number[]) {
    const byNum = new Map(displaySlots.filter((s) => s.stage === stage).map((s) => [s.matchNum, s]));
    return order.map((n) => byNum.get(n)).filter(Boolean) as BracketSlot[];
  }

  const r32 = orderBy("r32", R32_ORDER);
  const r16 = orderBy("r16", R16_ORDER);
  const qf = orderBy("qf", QF_ORDER);
  const sf = orderBy("sf", SF_ORDER);
  const finalSlot = displaySlots.find((s) => s.stage === "final");
  const thirdSlot = displaySlots.find((s) => s.stage === "third_place");

  function getCenterY(round: "r32" | "r16" | "qf" | "sf" | "final", idx: number): number {
    const counts = { r32: 16, r16: 8, qf: 4, sf: 2, final: 1 };
    const n = counts[round];
    return (TOTAL_H * (idx + 0.5)) / n;
  }

  const ROUND_W = CARD_W + COL_GAP;
  const totalWidth = ROUND_W * 5 + CARD_W + 60;

  const showingMine = viewMode === "mine";
  const cardMode = showingMine ? "mine" : "real";

  return (
    <div className="space-y-3 relative">
      <SaveIndicator status={status} errorMsg={errorMsg} />

      {/* Toggle Mi bracket / Real — only when real data available */}
      {hasRealData && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode("mine")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 ${
                viewMode === "mine"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              📋 Mi bracket
            </button>
            <button
              onClick={() => setViewMode("real")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 ${
                viewMode === "real"
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              📊 Real
            </button>
          </div>
          {viewMode === "mine" && (
            <span className="text-xs text-gray-500">
              · <span className="text-green-700 font-semibold">verde</span> = aciertos
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto bg-white border rounded-lg p-4">
        <div
          style={{ position: "relative", width: totalWidth, height: TOTAL_H + 40 }}
          className={`transition-opacity duration-200 ${viewMode === "real" ? "opacity-95" : "opacity-100"}`}
        >
          {["Dieciseisavos", "Octavos", "Cuartos", "Semis", "Final"].map((title, i) => (
            <div
              key={title}
              style={{ position: "absolute", left: i * ROUND_W, top: 0, width: CARD_W, textAlign: "center" }}
              className="text-xs font-semibold text-gray-600"
            >
              {title}
            </div>
          ))}

          <svg
            style={{ position: "absolute", left: 0, top: 25, pointerEvents: "none" }}
            width={totalWidth}
            height={TOTAL_H}
          >
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
            {(() => {
              const y1 = getCenterY("sf", 0);
              const y2 = getCenterY("sf", 1);
              const yMid = getCenterY("final", 0);
              const x1 = ROUND_W * 3 + CARD_W;
              const x2 = ROUND_W * 4;
              return (
                <g stroke="#facc15" strokeWidth="2" fill="none">
                  <path d={`M ${x1} ${y1} H ${(x1 + x2) / 2} V ${yMid} H ${x2}`} />
                  <path d={`M ${x1} ${y2} H ${(x1 + x2) / 2} V ${yMid}`} />
                </g>
              );
            })()}
          </svg>

          {r32.map((m, i) => (
            <Positioned key={m.matchNum} slot={m} top={getCenterY("r32", i) - CARD_H / 2 + 25} left={0}
              locked={locked || !showingMine} editing={editingMatchNum === m.matchNum}
              onClick={() => showingMine && setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p: any) => updateSlot(m.matchNum, p)}
              real={realByMatchNum?.[m.matchNum]} mode={cardMode} />
          ))}
          {r16.map((m, i) => (
            <Positioned key={m.matchNum} slot={m} top={getCenterY("r16", i) - CARD_H / 2 + 25} left={ROUND_W}
              locked={locked || !showingMine} editing={editingMatchNum === m.matchNum}
              onClick={() => showingMine && setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p: any) => updateSlot(m.matchNum, p)}
              real={realByMatchNum?.[m.matchNum]} mode={cardMode} />
          ))}
          {qf.map((m, i) => (
            <Positioned key={m.matchNum} slot={m} top={getCenterY("qf", i) - CARD_H / 2 + 25} left={ROUND_W * 2}
              locked={locked || !showingMine} editing={editingMatchNum === m.matchNum}
              onClick={() => showingMine && setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p: any) => updateSlot(m.matchNum, p)}
              real={realByMatchNum?.[m.matchNum]} mode={cardMode} />
          ))}
          {sf.map((m, i) => (
            <Positioned key={m.matchNum} slot={m} top={getCenterY("sf", i) - CARD_H / 2 + 25} left={ROUND_W * 3}
              locked={locked || !showingMine} editing={editingMatchNum === m.matchNum}
              onClick={() => showingMine && setEditingMatchNum(m.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p: any) => updateSlot(m.matchNum, p)}
              real={realByMatchNum?.[m.matchNum]} mode={cardMode} />
          ))}
          {finalSlot && (
            <Positioned slot={finalSlot} top={getCenterY("final", 0) - CARD_H / 2 + 25} left={ROUND_W * 4}
              locked={locked || !showingMine} editing={editingMatchNum === finalSlot.matchNum}
              onClick={() => showingMine && setEditingMatchNum(finalSlot.matchNum)}
              onClose={() => setEditingMatchNum(null)}
              update={(p: any) => updateSlot(finalSlot.matchNum, p)} isFinal
              real={realByMatchNum?.[finalSlot.matchNum]} mode={cardMode} />
          )}
          {thirdSlot && (
            <div style={{ position: "absolute", left: ROUND_W * 4, top: TOTAL_H - CARD_H + 25, width: CARD_W }}>
              <div className="text-[11px] font-semibold text-center mb-1 text-amber-700">
                🥉 Tercer lugar
              </div>
              <Card slot={thirdSlot} locked={locked || !showingMine} editing={editingMatchNum === thirdSlot.matchNum}
                onClick={() => showingMine && setEditingMatchNum(thirdSlot.matchNum)}
                onClose={() => setEditingMatchNum(null)}
                update={(p: any) => updateSlot(thirdSlot.matchNum, p)}
                real={realByMatchNum?.[thirdSlot.matchNum]} mode={cardMode} />
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 px-1 space-y-1">
        <p>💡 Click en cualquier partido para meter marcadores. Los cambios se <strong>guardan automáticamente</strong>.</p>
        <p>📝 Llena <strong>tiempo regular</strong> (siempre). Solo llena <strong>ET</strong> si crees que va a tiempo extra, y <strong>Pen</strong> si crees que va a penales.</p>
        {hasRealData && showingMine && (
          <p>🎨 <span className="bg-green-200 px-1 rounded">verde fuerte</span> = marcador exacto · <span className="bg-green-50 px-1 rounded border border-green-200">verde claro</span> = ganador correcto · <span className="bg-amber-50 px-1 rounded border border-amber-200">amarillo</span> = teams correctos pero resultado mal · <span className="text-green-700 font-semibold">nombre en verde</span> = ese equipo sí está en el partido real</p>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ status, errorMsg }: { status: SaveStatus; errorMsg: string | null }) {
  if (status === "idle") return null;
  let bg = "bg-gray-100 text-gray-700";
  let text = "";
  if (status === "pending") { bg = "bg-gray-100 text-gray-600"; text = "● Cambios sin guardar..."; }
  else if (status === "saving") { bg = "bg-blue-50 text-blue-700"; text = "⟳ Guardando..."; }
  else if (status === "saved") { bg = "bg-green-50 text-green-700"; text = "✓ Guardado"; }
  else if (status === "error") { bg = "bg-red-50 text-red-700"; text = `✕ Error: ${errorMsg ?? "no se pudo guardar"}`; }
  return (
    <div className={`fixed top-20 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-medium shadow-md ${bg}`}>
      {text}
    </div>
  );
}

function Positioned(props: any) {
  const { slot, top, left, editing, ...rest } = props;
  return (
    <div style={{ position: "absolute", top, left, width: CARD_W, zIndex: editing ? 20 : 1 }}>
      <Card slot={slot} editing={editing} {...rest} />
    </div>
  );
}

function comparePrediction(slot: BracketSlot, real: RealMatchData | undefined): {
  bothTeamsMatch: boolean;
  homeTeamInReal: boolean;
  awayTeamInReal: boolean;
  exactScore: boolean;
  correctResult: boolean;
} {
  if (!real || !real.homeTeamId || !real.awayTeamId) {
    return { bothTeamsMatch: false, homeTeamInReal: false, awayTeamInReal: false, exactScore: false, correctResult: false };
  }
  const predHome = slot.homeTeamId;
  const predAway = slot.awayTeamId;
  const realHome = real.homeTeamId;
  const realAway = real.awayTeamId;

  const homeTeamInReal = !!predHome && (predHome === realHome || predHome === realAway);
  const awayTeamInReal = !!predAway && (predAway === realHome || predAway === realAway);
  const bothTeamsMatch = homeTeamInReal && awayTeamInReal;

  if (!bothTeamsMatch || real.homeScore == null || real.awayScore == null) {
    return { bothTeamsMatch, homeTeamInReal, awayTeamInReal, exactScore: false, correctResult: false };
  }

  const sameOrder = predHome === realHome && predAway === realAway;
  const pH = sameOrder ? slot.predHomeScore : slot.predAwayScore;
  const pA = sameOrder ? slot.predAwayScore : slot.predHomeScore;

  const exactScore = pH === real.homeScore && pA === real.awayScore;
  const correctResult =
    pH != null && pA != null &&
    Math.sign(pH - pA) === Math.sign(real.homeScore - real.awayScore);

  return { bothTeamsMatch, homeTeamInReal, awayTeamInReal, exactScore, correctResult };
}

function Card({
  slot,
  locked,
  editing,
  onClick,
  onClose,
  update,
  isFinal,
  real,
  mode,
}: any) {
  const hasTeams = !!(slot.homeTeamId && slot.awayTeamId);
  const home = slot.homeTeam ?? { name: slot.homeLabel, flag: "" };
  const away = slot.awayTeam ?? { name: slot.awayLabel, flag: "" };
  const homeWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.homeTeamId;
  const awayWon = slot.predWinnerTeamId && slot.predWinnerTeamId === slot.awayTeamId;

  const showCompare = mode === "mine" && real;
  const cmp = showCompare ? comparePrediction(slot, real) : null;

  let cardBg = !hasTeams ? "bg-gray-50" : "bg-white";
  let cardBorder = isFinal ? "border-yellow-400 border-2" : "border-gray-200";
  if (cmp && cmp.bothTeamsMatch) {
    if (cmp.exactScore) {
      cardBg = "bg-green-200";
      cardBorder = isFinal ? "border-yellow-400 border-2" : "border-green-400 border";
    } else if (cmp.correctResult) {
      cardBg = "bg-green-50";
      cardBorder = isFinal ? "border-yellow-400 border-2" : "border-green-300 border";
    } else {
      cardBg = "bg-amber-50";
      cardBorder = isFinal ? "border-yellow-400 border-2" : "border-amber-300 border";
    }
  }

  const homeNameColor = cmp && cmp.homeTeamInReal ? "text-green-700 font-semibold" : "";
  const awayNameColor = cmp && cmp.awayTeamInReal ? "text-green-700 font-semibold" : "";

  if (editing) {
    return (
      <div className="border-2 border-blue-400 bg-blue-50 rounded p-2 text-xs shadow-xl" style={{ width: CARD_W + 20, marginLeft: -10 }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-gray-500 font-medium">Partido {slot.matchNum}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="flex items-center gap-1 mb-2 text-[11px]">
          <span className="text-sm w-5">{home.flag || "·"}</span>
          <span className="flex-1 truncate font-medium">{home.name}</span>
        </div>
        <div className="flex items-center gap-1 mb-2 text-[11px]">
          <span className="text-sm w-5">{away.flag || "·"}</span>
          <span className="flex-1 truncate font-medium">{away.name}</span>
        </div>

        <table className="w-full text-[10px] mb-2">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left font-normal">90'</th>
              <th className="text-left font-normal">ET</th>
              <th className="text-left font-normal">Pen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <input type="number" min={0} max={20} value={slot.predHomeScore ?? ""}
                  onChange={(e) => update({ predHomeScore: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
              <td>
                <input type="number" min={0} max={20} value={slot.predHomeScoreET ?? ""}
                  onChange={(e) => update({ predHomeScoreET: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
              <td>
                <input type="number" min={0} max={20} value={slot.predHomePens ?? ""}
                  onChange={(e) => update({ predHomePens: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
            </tr>
            <tr>
              <td>
                <input type="number" min={0} max={20} value={slot.predAwayScore ?? ""}
                  onChange={(e) => update({ predAwayScore: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
              <td>
                <input type="number" min={0} max={20} value={slot.predAwayScoreET ?? ""}
                  onChange={(e) => update({ predAwayScoreET: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
              <td>
                <input type="number" min={0} max={20} value={slot.predAwayPens ?? ""}
                  onChange={(e) => update({ predAwayPens: e.target.value === "" ? null : parseInt(e.target.value) })}
                  placeholder="-" disabled={locked}
                  className="w-12 px-1 py-0.5 border rounded text-center disabled:bg-gray-100" />
              </td>
            </tr>
          </tbody>
        </table>

        <div className="text-[9px] text-gray-500">
          90' = tiempo regular · ET = tras tiempo extra · Pen = penales
        </div>
      </div>
    );
  }

  return (
    <button onClick={onClick} disabled={locked && !hasTeams}
      className={`w-full border ${cardBorder} ${cardBg} rounded p-1.5 text-xs text-left hover:border-blue-400 transition cursor-pointer disabled:cursor-default`}
      style={{ height: CARD_H }}>
      <div className="text-[9px] text-gray-400 leading-tight mb-0.5">Partido {slot.matchNum}</div>
      <div className={`flex items-center gap-1 ${homeWon ? "font-bold" : ""}`}>
        <span className="text-sm w-4 shrink-0">{home.flag}</span>
        <span className={`flex-1 truncate text-[11px] ${homeNameColor}`}>
          {hasTeams ? home.name : <span className="text-gray-400 italic">{home.name}</span>}
        </span>
        <span className="font-mono w-4 text-right text-[11px]">{slot.predHomeScore ?? "·"}</span>
      </div>
      <div className={`flex items-center gap-1 ${awayWon ? "font-bold" : ""}`}>
        <span className="text-sm w-4 shrink-0">{away.flag}</span>
        <span className={`flex-1 truncate text-[11px] ${awayNameColor}`}>
          {hasTeams ? away.name : <span className="text-gray-400 italic">{away.name}</span>}
        </span>
        <span className="font-mono w-4 text-right text-[11px]">{slot.predAwayScore ?? "·"}</span>
      </div>
      {(slot.predExtraTime || slot.predPenalties) && (
        <div className="text-[9px] text-blue-600 mt-0.5 leading-none">
          {slot.predExtraTime && slot.predHomeScoreET != null
            ? `ET ${slot.predHomeScoreET}-${slot.predAwayScoreET}`
            : ""}
          {slot.predExtraTime && slot.predPenalties ? " · " : ""}
          {slot.predPenalties && slot.predHomePens != null
            ? `Pen ${slot.predHomePens}-${slot.predAwayPens}`
            : ""}
        </div>
      )}
    </button>
  );
}
