import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function ScrollProgress() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  return (
    <div className="fixed inset-x-0 top-0 z-100 h-[3px] bg-transparent" aria-hidden="true">
      <div
        className="h-full transition-[width] duration-75 ease-out"
        style={{ width: `${progress * 100}%`, background: "var(--gradient-brand)" }}
      />
    </div>
  );
}