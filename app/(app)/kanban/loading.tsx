import { Skeleton } from "@/components/ui/skeleton";

export default function KanbanLoading() {
  return (
    <div className="flex h-full flex-col space-y-4 p-6">
      {/* Header do Funil e Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Colunas do Kanban */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, colIndex) => (
          <div
            key={colIndex}
            className="flex w-80 flex-shrink-0 flex-col rounded-lg border bg-card/60 p-3"
          >
            {/* Header da coluna */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>

            {/* Cards da coluna */}
            <div className="flex flex-col space-y-3">
              {Array.from({ length: 3 + (colIndex % 2) }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
