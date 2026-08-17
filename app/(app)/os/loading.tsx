import { Skeleton } from "@/components/ui/skeleton";

export default function ServiceOrdersLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Skeleton className="h-10 min-w-[200px] flex-1 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded" />
                  <Skeleton className="h-5 w-40" />
                </div>
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
