import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CommercialActivityChart } from "@/app/(app)/dashboard/charts";

export function CommercialActivity({
  leadsTrend,
  wonTrend,
}: {
  leadsTrend: { date: string; label: string; count: number }[];
  wonTrend: { date: string; label: string; count: number }[];
}) {
  const hasData = leadsTrend.some((d) => d.count > 0) || wonTrend.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade comercial</CardTitle>
        <CardDescription>Leads recebidos x vendas fechadas, últimos 7 dias</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <CommercialActivityChart leadsTrend={leadsTrend} wonTrend={wonTrend} />
        ) : (
          <EmptyState message="Sem movimento nos últimos 7 dias." />
        )}
      </CardContent>
    </Card>
  );
}
