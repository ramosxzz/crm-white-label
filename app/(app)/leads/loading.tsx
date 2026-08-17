import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header com título e ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-10 min-w-[240px] flex-1 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Tabela de Leads */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="col-span-3 h-4" />
            <Skeleton className="col-span-2 h-4" />
            <Skeleton className="col-span-2 h-4" />
            <Skeleton className="col-span-2 h-4" />
            <Skeleton className="col-span-2 h-4" />
            <Skeleton className="col-span-1 h-4" />
          </div>
        </div>

        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-4 p-4">
              <div className="col-span-3 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="col-span-1 flex justify-end">
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
