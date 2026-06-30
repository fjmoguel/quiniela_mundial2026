import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { propagateBracket } from "@/lib/propagateBracket";

/**
 * Propagates real match results through the bracket.
 * - Assigns group winners/runner-ups and best 3rds to R32 slots
 * - Propagates KO winners to next round slots
 *
 * Open in browser: /api/admin/sync-bracket (admin only).
 */
async function handle() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const result = await propagateBracket();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("propagateBracket error", e);
    return NextResponse.json(
      { error: e.message ?? "Error interno", stack: e.stack },
      { status: 500 }
    );
  }
}

export async function GET() { return handle(); }
export async function POST() { return handle(); }
