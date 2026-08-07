import { useCallback, useEffect, useRef, useState } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function ZoomImage({ src, alt, hint }: { src: string; alt: string; hint?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const stateRef = useRef({ zoom: 1 });
  stateRef.current.zoom = zoom;

  const pointOrigin = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }, []);

  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, stateRef.current.zoom * Math.exp(-dy * 0.0015)),
    );
    pointOrigin(e.clientX, e.clientY);
    setZoom(next);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleWheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        onMouseMove={(e) => {
          if (stateRef.current.zoom > 1) pointOrigin(e.clientX, e.clientY);
        }}
        onMouseLeave={() => {
          setZoom(1);
          setOrigin({ x: 50, y: 50 });
        }}
        className="relative aspect-square cursor-zoom-in touch-none overflow-hidden rounded-[2rem] border border-border bg-brand-soft/40"
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
          draggable={false}
        />
        {zoom > 1 && (
          <span className="absolute bottom-3 end-3 rounded-full bg-foreground/70 px-3 py-1 text-xs font-semibold text-background">
            {Math.round(zoom * 100)}%
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-foreground/55">{hint}</p>}
    </div>
  );
}