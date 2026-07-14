"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID;

function loadFacebookSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (window.FB) return resolve();
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
      resolve();
    };
    if (document.getElementById("facebook-jssdk")) return;
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}

export function WhatsAppEmbeddedSignupButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string; businessId?: string }>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINANCIAL_DATA_STATE_CHANGE") return;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          signupData.current = {
            wabaId: data.data.waba_id ?? signupData.current.wabaId,
            phoneNumberId: data.data.phone_number_id ?? signupData.current.phoneNumberId,
            businessId: data.data.business_id ?? signupData.current.businessId,
          };
        }
      } catch {
        // mensagens nao relacionadas ao embedded signup, ignora
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleClick() {
    setError(null);
    if (!APP_ID || !CONFIG_ID) {
      setError("Configuracao do Meta App incompleta. Contate o suporte.");
      return;
    }
    setLoading(true);
    try {
      await loadFacebookSdk();
      window.FB!.login(
        async (response) => {
          const code = response.authResponse?.code;
          if (!code) {
            setLoading(false);
            if (response.status !== "unknown") {
              setError("Login cancelado ou nao autorizado.");
            }
            return;
          }
          try {
            const res = await fetch("/api/auth/whatsapp/embedded-signup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, ...signupData.current }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Falha ao concluir conexao");
            router.refresh();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setLoading(false);
          }
        },
        {
          config_id: CONFIG_ID,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
        },
      );
    } catch {
      setLoading(false);
      setError("Nao foi possivel carregar o SDK da Meta.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <Button variant="brand" size="lg" className="shrink-0" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        Conectar WhatsApp com Facebook
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
