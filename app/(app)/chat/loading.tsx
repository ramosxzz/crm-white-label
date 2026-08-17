import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden border-t">
      {/* Sidebar de conversas */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r bg-card">
        {/* Barra de busca */}
        <div className="border-b p-3">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Lista de conversas */}
        <div className="flex-1 divide-y overflow-y-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área da thread de mensagens */}
      <div className="flex flex-1 flex-col bg-background">
        {/* Header do Chat */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 space-y-4 p-4 overflow-y-auto">
          <div className="flex items-start gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-16 w-64 rounded-2xl rounded-tl-none" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>

          <div className="flex items-start justify-end gap-2.5">
            <div className="flex flex-col items-end space-y-1">
              <Skeleton className="h-20 w-72 rounded-2xl rounded-tr-none" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-10 w-48 rounded-2xl rounded-tl-none" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>

        {/* Input / Composer */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
