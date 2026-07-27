"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | null = null;

    const checkForUpdate = () => {
      registration?.update().catch(() => null);
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        checkForUpdate();
      } catch {
        // PWA continua funcionando como site normal se o navegador bloquear o service worker.
      }
    };

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    // Empresas deixam o PWA aberto o dia inteiro sem fechar. Um so check no
    // load nunca detecta deploys que aconteceram depois - da o erro de
    // Server Action de versao antiga. Reforca o check quando a aba volta a
    // ficar visivel/focada/online, alem de um poll periodico como rede de
    // seguranca.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const pollId = window.setInterval(checkForUpdate, 5 * 60 * 1000);

    window.addEventListener("load", register, { once: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.clearInterval(pollId);
    };
  }, []);

  return null;
}
