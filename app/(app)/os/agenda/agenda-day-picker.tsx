"use client";

import { useRouter } from "next/navigation";

export function AgendaDayPicker({ day }: { day: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={day}
      onChange={(e) => {
        if (e.target.value) router.push(`/os/agenda?day=${e.target.value}`);
      }}
      className="h-9 rounded-md border border-border/70 bg-background px-2 text-sm"
    />
  );
}
