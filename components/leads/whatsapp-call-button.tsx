"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WhatsAppCallButton({ phone, iconOnly = false }: { phone: string; iconOnly?: boolean }) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const href = `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
  return (
    <Button asChild variant="outline" size={iconOnly ? "icon" : "default"} title="Ligar pelo WhatsApp">
      <a href={href} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4" />
        {!iconOnly && "WhatsApp"}
      </a>
    </Button>
  );
}
