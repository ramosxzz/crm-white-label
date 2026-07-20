"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton({ title = "Atualizar" }: { title?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    startTransition(() => {
      router.refresh();
    });
    setTimeout(() => setSpinning(false), 600);
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={handleClick} disabled={isPending} title={title}>
      <RefreshCw className={cn("h-4 w-4", (spinning || isPending) && "animate-spin")} />
    </Button>
  );
}
