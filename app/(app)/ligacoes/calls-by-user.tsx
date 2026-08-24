import Link from "next/link";
import { Headphones, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type UserCallStats = {
  userId: string;
  name: string;
  total: number;
  answered: number;
  answerRate: number;
  avgDurationSeconds: number;
  talkSeconds: number;
  recordings: number;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Quanto cada pessoa ligou no periodo. O dono da ligacao vem do
 * `metadata.user_id` que a gente grava ao disparar a chamada - nao depende
 * de casar ramal/e-mail com a Api4com.
 */
export function CallsByUser({
  stats,
  activeUserId,
  buildHref,
}: {
  stats: UserCallStats[];
  activeUserId: string;
  buildHref: (userId: string) => string;
}) {
  if (stats.length === 0) return null;

  const best = Math.max(...stats.map((s) => s.total));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Por vendedor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {stats.map((row) => {
          const active = activeUserId === row.userId;
          return (
            <Link
              key={row.userId}
              href={buildHref(active ? "" : row.userId)}
              className={cn(
                "block rounded-lg border px-3 py-2.5 transition-colors",
                active ? "border-brand bg-brand/5" : "border-border/60 hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{row.name}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{row.total}</span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${best > 0 ? (row.total / best) * 100 : 0}%` }}
                />
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" />
                  {row.answered} atendidas · {row.answerRate}%
                </span>
                <span>média {formatDuration(row.avgDurationSeconds)}</span>
                <span>total {formatDuration(row.talkSeconds)}</span>
                {row.recordings > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Headphones className="h-3 w-3" />
                    {row.recordings} gravação(ões)
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        <p className="pt-1 text-[11px] text-muted-foreground">
          Clique num vendedor pra filtrar a lista e ouvir as gravações dele.
        </p>
      </CardContent>
    </Card>
  );
}
