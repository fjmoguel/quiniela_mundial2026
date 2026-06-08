"use client";
import { useEffect, useState } from "react";

export default function LocalDate({
  iso,
  format = "short",
}: {
  iso: string | Date;
  format?: "short" | "full" | "date" | "time";
}) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions =
      format === "short"
        ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
        : format === "full"
        ? { dateStyle: "full", timeStyle: "short" }
        : format === "date"
        ? { day: "numeric", month: "short", year: "numeric" }
        : { hour: "2-digit", minute: "2-digit" };
    setText(d.toLocaleString(undefined, opts));
  }, [iso, format]);

  // Server-side render: ISO date as fallback to avoid hydration mismatch
  if (!text) return <span suppressHydrationWarning>—</span>;
  return <span suppressHydrationWarning>{text}</span>;
}
