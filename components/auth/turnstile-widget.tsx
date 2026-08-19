"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** So renderiza se NEXT_PUBLIC_TURNSTILE_SITE_KEY estiver configurada -
 * sem a chave, o componente nao aparece e o login segue sem captcha. */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    function render() {
      if (window.turnstile && containerRef.current) {
        window.turnstile.render(containerRef.current, { sitekey: siteKey!, callback: onVerify });
      }
    }

    if (window.turnstile) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [siteKey, onVerify]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}
