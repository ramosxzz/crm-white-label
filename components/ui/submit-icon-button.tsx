"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitIconButton({
  children,
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="icon"
      variant="ghost"
      disabled={disabled || pending}
      className={cn("h-8 w-8", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
