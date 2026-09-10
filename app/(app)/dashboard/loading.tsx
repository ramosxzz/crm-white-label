import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header de boas-vindas */}
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Precisa da sua atencao */}
      <div className="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Ops row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>

      {/* Pipeline */}
      <div className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-40 shrink-0 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Atividade comercial */}
      <div className="space-y-4 rounded-lg border bg-card p-5 shadow-sm">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    </div>
  );
}
