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
const FACEBOOK_SDK_ID = "facebook-jssdk";
const FACEBOOK_SDK_URL = "https://connect.facebook.net/pt_BR/sdk.js";
const FACEBOOK_SDK_TIMEOUT_MS = 15_000;

let facebookSdkPromise: Promise<void> | null = null;

function loadFacebookSdk(): Promise<void> {
  if (window.FB?.login) return Promise.resolve();
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      fail(new Error("O SDK da Meta demorou para responder. Desative bloqueadores e tente novamente."));
    }, FACEBOOK_SDK_TIMEOUT_MS);

    function finish() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      facebookSdkPromise = null;
      reject(error);
    }

    function initialize() {
      if (!window.FB?.login) {
        fail(new Error("O navegador bloqueou o SDK da Meta. Libere scripts e pop-ups do Facebook."));
        return;
      }

      try {
        window.FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: "v23.0" });
        finish();
      } catch {
        fail(new Error("Nao foi possivel inicializar o SDK da Meta."));
      }
    }

    window.fbAsyncInit = initialize;

    const existingScript = document.getElementById(FACEBOOK_SDK_ID);
    if (existingScript) existingScript.remove();

    const script = document.createElement("script");
    script.id = FACEBOOK_SDK_ID;
    script.src = FACEBOOK_SDK_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!settled) initialize();
    };
    script.onerror = () => {
      fail(new Error("Nao foi possivel baixar o SDK da Meta. Verifique a conexao e os bloqueadores."));
    };
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
}

export function WhatsAppEmbeddedSignupButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string; businessId?: string }>({});

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      let hostname: string;
      try {
        hostname = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) return;
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
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o SDK da Meta.");
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
