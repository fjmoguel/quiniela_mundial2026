"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NavBar({ user }: { user: { username: string; isAdmin: boolean } | null }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <header className="border-b bg-white">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-lg">
          🏆 Quiniela 2026
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm flex-wrap">
          <Link href="/dashboard" className="px-2 py-1 hover:bg-gray-100 rounded">Inicio</Link>
          <Link href="/predicciones" className="px-2 py-1 hover:bg-gray-100 rounded">Predicciones</Link>
          <Link href="/mis-grupos" className="px-2 py-1 hover:bg-gray-100 rounded">Grupos</Link>
          <Link href="/mi-bracket" className="px-2 py-1 hover:bg-gray-100 rounded">Bracket</Link>
          <Link href="/leaderboard" className="px-2 py-1 hover:bg-gray-100 rounded">Tabla</Link>
          {user.isAdmin && (
            <Link href="/admin" className="px-2 py-1 bg-amber-100 hover:bg-amber-200 rounded">
              Admin
            </Link>
          )}
          <span className="hidden sm:inline text-gray-500 ml-2">@{user.username}</span>
          <button
            onClick={handleLogout}
            className="ml-2 text-gray-500 hover:text-gray-900 underline"
          >
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
