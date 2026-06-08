import { NextRequest, NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

// GET /api/cron/sync — called automatically by Vercel Cron
// Vercel injects "Authorization: Bearer <CRON_SECRET>" if CRON_SECRET is set
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncAll();
    return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
  } catch (e: any) {
    console.error("cron sync error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
