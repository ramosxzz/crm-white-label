import { Skeleton } from "@/components/ui/skeleton";

export default function EstoqueLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-60" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b pb-3">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
