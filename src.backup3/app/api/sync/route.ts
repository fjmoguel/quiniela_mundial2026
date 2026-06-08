import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncAll } from "@/lib/sync";

// POST /api/sync — admin-only manual trigger
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  try {
    const result = await syncAll();
    return NextResponse.json(result);
  } catch (e: any) {
    console.error("sync error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
