import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const adminKey = String(body.adminKey ?? "");

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ error: "Usuario debe tener 3–20 caracteres" }, { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Usuario solo puede tener letras, números y guiones bajos" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Contraseña mínimo 6 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Ese usuario ya existe" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const isAdmin =
      Boolean(process.env.ADMIN_SIGNUP_KEY) && adminKey === process.env.ADMIN_SIGNUP_KEY;

    const user = await prisma.user.create({
      data: { username, passwordHash, isAdmin },
    });

    await createSessionCookie(user.id);

    return NextResponse.json({
      user: { id: user.id, username: user.username, isAdmin: user.isAdmin },
    });
  } catch (e: any) {
    console.error("signup error", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
