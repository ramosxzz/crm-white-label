"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reseta o progresso quando a rota muda
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Escuta cliques em links para iniciar a barra instantaneamente
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || target.target === "_blank") {
        return;
      }

      // Se for link interno e apontar para página diferente da atual
      if (href.startsWith("/") && href !== pathname) {
        setLoading(true);
        setProgress(30);

        setTimeout(() => {
          setProgress((prev) => (prev < 70 ? 70 : prev));
        }, 150);

        setTimeout(() => {
          setProgress((prev) => (prev < 90 ? 90 : prev));
        }, 400);
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed left-0 top-0 z-[99999] h-[3px] w-full bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-brand shadow-[0_0_8px_hsl(var(--brand))] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
