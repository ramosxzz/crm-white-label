import Link from "next/link";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export function MonthCalendar({
  month,
  selectedDay,
  today,
  daysWithAppointments,
}: {
  month: string;
  selectedDay: string;
  today: string;
  daysWithAppointments: Set<string>;
}) {
  const [year, monthIndex] = month.split("-").map(Number);
  const firstOfMonth = new Date(year, monthIndex - 1, 1);
  const firstWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(monthIndex).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((label) => (
        <div key={label} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      ))}
      {cells.map((dayStr, idx) => {
        if (!dayStr) return <div key={`empty-${idx}`} />;
        const dayNumber = Number(dayStr.slice(-2));
        const isSelected = dayStr === selectedDay;
        const isToday = dayStr === today;
        const hasAppointments = daysWithAppointments.has(dayStr);
        return (
          <Link
            key={dayStr}
            href={`/agenda?day=${dayStr}`}
            className={cn(
              "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors",
              isSelected
                ? "bg-brand text-brand-foreground font-semibold"
                : isToday
                  ? "bg-brand/10 text-foreground font-semibold"
                  : "text-foreground hover:bg-brand/10",
            )}
          >
            {dayNumber}
            {hasAppointments && (
              <span
                className={cn(
                  "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                  isSelected ? "bg-brand-foreground" : "bg-brand",
                )}
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
