import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recalcKoPointsForAllUsers } from "@/lib/recalcKoPoints";

/**
 * Recalculates all KO match points with the corrected logic.
 * Verifies that the user's predicted teams match the real teams
 * before awarding any points.
 *
 * Open in browser: /api/admin/recalc-ko-points
 * Admin only.
 */

async function handle() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const result = await recalcKoPointsForAllUsers();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("recalc-ko-points error", e);
    return NextResponse.json(
      { error: e.message ?? "Error interno", stack: e.stack },
      { status: 500 }
    );
  }
}

export async function GET() { return handle(); }
export async function POST() { return handle(); }
