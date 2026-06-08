"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, adminKey: adminKey || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error");
      router.push("/dashboard");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-semibold mb-1">🏆 Crear cuenta</h1>
      <p className="text-gray-600 mb-6 text-sm">Únete a la quiniela del Mundial 2026</p>
      <form onSubmit={onSubmit} className="space-y-3 bg-white border rounded-lg p-5">
        <div>
          <label className="block text-sm mb-1">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="paco_2026"
            autoComplete="username"
            required
          />
          <p className="text-xs text-gray-500 mt-1">3–20 chars · letras, números, guión bajo</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>
        {showAdmin ? (
          <div>
            <label className="block text-sm mb-1">Admin key (opcional)</label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdmin(true)}
            className="text-xs text-gray-500 underline"
          >
            ¿Tienes admin key?
          </button>
        )}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded hover:opacity-85 disabled:opacity-50"
        >
          {loading ? "..." : "Crear cuenta"}
        </button>
        <p className="text-sm text-center text-gray-600 pt-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-brand underline">
            Iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
