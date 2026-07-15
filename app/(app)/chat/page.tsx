import { MessageCircle } from "lucide-react";

export default function ChatPage() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center bg-muted/10 px-6 md:flex">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
          <MessageCircle className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight">Suas conversas</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Selecione um contato na lista ao lado para ver o histórico e responder pelo WhatsApp integrado.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Mensagens novas aparecem automaticamente — não é preciso atualizar a página.
        </p>
      </div>
    </div>
  );
}
