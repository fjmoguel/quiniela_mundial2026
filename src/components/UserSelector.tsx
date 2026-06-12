"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type User = { id: string; username: string };

export default function UserSelector({
  users,
  currentViewedUserId,
  currentUserId,
}: {
  users: User[];
  currentViewedUserId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId === currentUserId) {
      params.delete("u");
    } else {
      params.set("u", selectedId);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    // Force the server component to re-fetch with the new searchParams.
    // Without this, Next.js sometimes serves cached data and shows stale predictions.
    router.refresh();
  }

  const sorted = [...users].sort((a, b) => {
    // Pin current user at top
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.username.localeCompare(b.username);
  });

  const viewingOther = currentViewedUserId !== currentUserId;
  const viewedUser = users.find((u) => u.id === currentViewedUserId);

  return (
    <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
      <span className="text-gray-600">Viendo:</span>
      <select
        value={currentViewedUserId}
        onChange={onChange}
        className="border rounded px-2 py-1 bg-white font-medium"
      >
        {sorted.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === currentUserId ? `Yo (@${u.username})` : `@${u.username}`}
          </option>
        ))}
      </select>
      {viewingOther && (
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          🔒 Solo lectura — viendo predicciones de @{viewedUser?.username}
        </span>
      )}
    </div>
  );
}
