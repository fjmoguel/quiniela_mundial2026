"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Row = {
  teamId: string;
  pts: number;
  gd: number;
  gf: number;
};

type Team = { id: string; name: string; flag: string };

/**
 * Allows user to manually reorder teams that are tied in (pts, GD, GF).
 * Only renders if at least 2 teams in this group share identical stats.
 */
export default function TiebreakerControl({
  groupLetter,
  rows,
  teamById,
  locked,
}: {
  groupLetter: string;
  rows: Row[];
  teamById: Record<string, Team>;
  locked: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<Row[]>(rows);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Detect tied groups (consecutive teams with identical pts/gd/gf)
  // Returns array of [startIdx, endIdx] ranges that are tied together
  function findTiedRanges(arr: Row[]): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    let i = 0;
    while (i < arr.length) {
      let j = i;
      while (
        j + 1 < arr.length &&
        arr[j + 1].pts === arr[i].pts &&
        arr[j + 1].gd === arr[i].gd &&
        arr[j + 1].gf === arr[i].gf
      ) {
        j++;
      }
      if (j > i) ranges.push([i, j]);
      i = j + 1;
    }
    return ranges;
  }

  const tiedRanges = findTiedRanges(order);
  if (tiedRanges.length === 0) return null;

  function moveUp(idx: number) {
    if (idx === 0) return;
    // Only allow swap if the team above is in the same tied range
    const above = order[idx - 1];
    const current = order[idx];
    if (above.pts !== current.pts || above.gd !== current.gd || above.gf !== current.gf) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
    save(next);
  }

  function moveDown(idx: number) {
    if (idx === order.length - 1) return;
    const below = order[idx + 1];
    const current = order[idx];
    if (below.pts !== current.pts || below.gd !== current.gd || below.gf !== current.gf) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
    save(next);
  }

  async function save(newOrder: Row[]) {
    setFeedback("⟳ Guardando...");
    try {
      const r = await fetch("/api/group-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupLetter,
          orderedTeamIds: newOrder.map((r) => r.teamId),
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Error");
      }
      setFeedback("✓ Guardado");
      startTransition(() => router.refresh());
      setTimeout(() => setFeedback(null), 1500);
    } catch (e: any) {
      setFeedback("Error: " + e.message);
    }
  }

  if (locked) return null;

  return (
    <div className="bg-amber-50 border-t border-amber-200 px-3 py-2 text-xs">
      <div className="text-amber-800 mb-1">
        ⚠️ Empate en puntos/DG/GF. Reordena con las flechas si crees que el orden debería ser distinto:
      </div>
      <div className="space-y-1">
        {order.map((r, idx) => {
          const team = teamById[r.teamId];
          const inTied = tiedRanges.some(([s, e]) => idx >= s && idx <= e);
          if (!inTied) return null;
          const canUp = idx > 0 && order[idx - 1].pts === r.pts && order[idx - 1].gd === r.gd && order[idx - 1].gf === r.gf;
          const canDown = idx < order.length - 1 && order[idx + 1].pts === r.pts && order[idx + 1].gd === r.gd && order[idx + 1].gf === r.gf;
          return (
            <div key={r.teamId} className="flex items-center gap-2 bg-white border rounded px-2 py-1">
              <span className="text-gray-500 w-4 text-xs">{idx + 1}°</span>
              <span>{team?.flag}</span>
              <span className="flex-1">{team?.name}</span>
              <button
                onClick={() => moveUp(idx)}
                disabled={!canUp}
                className="px-1.5 py-0.5 border rounded text-xs disabled:opacity-30 hover:bg-gray-50"
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                onClick={() => moveDown(idx)}
                disabled={!canDown}
                className="px-1.5 py-0.5 border rounded text-xs disabled:opacity-30 hover:bg-gray-50"
                aria-label="Bajar"
              >
                ↓
              </button>
            </div>
          );
        })}
      </div>
      {feedback && <div className="mt-1 text-amber-700">{feedback}</div>}
    </div>
  );
}
