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

const SDK_BLOCKED_MESSAGE =
  "O navegador bloqueou o carregamento da Meta. Abra esta mesma pagina no Chrome ou Edge e tente novamente.";

function loadFacebookSdk(): Promise<void> {
  if (window.FB?.login) return Promise.resolve();
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    let settled = false;
    let watchdogFrame: number | null = null;
    const startedAt = Date.now();

    const timeout = window.setTimeout(() => {
      fail(new Error(SDK_BLOCKED_MESSAGE));
    }, FACEBOOK_SDK_TIMEOUT_MS);

    // Alguns navegadores incorporados suspendem timers enquanto um script de
    // terceiro esta pendente. O watchdog visual evita que o botao gire para sempre.
    function watchSdkLoad() {
      if (settled) return;
      if (Date.now() - startedAt >= FACEBOOK_SDK_TIMEOUT_MS) {
        fail(new Error(SDK_BLOCKED_MESSAGE));
        return;
      }
      watchdogFrame = window.requestAnimationFrame(watchSdkLoad);
    }

    watchdogFrame = window.requestAnimationFrame(watchSdkLoad);

    function cleanup() {
      window.clearTimeout(timeout);
      if (watchdogFrame !== null) window.cancelAnimationFrame(watchdogFrame);
    }

    function finish() {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
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
      fail(new Error(SDK_BLOCKED_MESSAGE));
    };
    document.body.appendChild(script);
  });

  return facebookSdkPromise;
}

export function WhatsAppEmbeddedSignupButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string; businessId?: string }>({});
  const loginTimeout = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    if (!APP_ID || !CONFIG_ID) {
      setError("Configuracao do Meta App incompleta. Contate o suporte.");
    } else {
      // O SDK precisa estar pronto antes do clique. Se aguardarmos o download
      // dentro do onClick, o navegador deixa de considerar FB.login uma acao
      // direta do usuario e pode bloquear o popup do Cadastro Incorporado.
      void loadFacebookSdk()
        .then(() => {
          if (!active) return;
          setSdkReady(true);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setSdkReady(false);
          setError(err instanceof Error ? err.message : SDK_BLOCKED_MESSAGE);
        });
    }

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
    return () => {
      active = false;
      window.removeEventListener("message", handleMessage);
      if (loginTimeout.current !== null) window.clearTimeout(loginTimeout.current);
    };
  }, []);

  function handleClick() {
    setError(null);
    if (!APP_ID || !CONFIG_ID) {
      setError("Configuracao do Meta App incompleta. Contate o suporte.");
      return;
    }

    if (!sdkReady || !window.FB?.login) {
      setError("A conexao com a Meta ainda esta sendo preparada. Aguarde alguns segundos e tente novamente.");
      return;
    }

    setLoading(true);
    try {
      // Nunca deixa o botao girando indefinidamente caso o navegador bloqueie
      // o popup ou a Meta nao devolva o callback de cancelamento.
      if (loginTimeout.current !== null) window.clearTimeout(loginTimeout.current);
      loginTimeout.current = window.setTimeout(() => {
        setLoading(false);
        setError("A janela da Meta nao respondeu. Libere pop-ups para este site e tente novamente.");
        loginTimeout.current = null;
      }, 90_000);

      window.FB.login(
        async (response) => {
          if (loginTimeout.current !== null) {
            window.clearTimeout(loginTimeout.current);
            loginTimeout.current = null;
          }
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
      if (loginTimeout.current !== null) {
        window.clearTimeout(loginTimeout.current);
        loginTimeout.current = null;
      }
      setLoading(false);
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o SDK da Meta.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <Button variant="brand" size="lg" className="shrink-0" onClick={handleClick} disabled={loading || !sdkReady}>
        {loading || !sdkReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        {sdkReady ? "Conectar WhatsApp com Facebook" : "Preparando conexao com a Meta"}
      </Button>
      {error && (
        <div className="max-w-md space-y-1 text-sm text-destructive">
          <p>{error}</p>
          {error === SDK_BLOCKED_MESSAGE && (
            <p className="text-muted-foreground">
              Endereco: https://crm.solairew.com.br/integrations/whatsapp
            </p>
          )}
        </div>
      )}
    </div>
  );
}
