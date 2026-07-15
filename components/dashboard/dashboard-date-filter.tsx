"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardDateFilter({
  selectedDate,
  todayStr,
}: {
  selectedDate: string;
  todayStr: string;
}) {
  const router = useRouter();
  const isToday = selectedDate === todayStr;

  function goTo(date: string) {
    if (!date || date === todayStr) {
      router.push("/dashboard");
    } else {
      router.push(`/dashboard?date=${date}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="relative inline-flex items-center">
        <CalendarDays className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="date"
          value={selectedDate}
          max={todayStr}
          onChange={(e) => goTo(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/40"
        />
      </label>
      {!isToday && (
        <Button variant="outline" size="sm" onClick={() => goTo(todayStr)}>
          Hoje
        </Button>
      )}
    </div>
  );
}
