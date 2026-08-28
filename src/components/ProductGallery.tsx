import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Professional product slideshow.
 *
 * Original manufacturer images only, always fully visible (object-contain, never
 * cropped): previous/next buttons, clickable thumbnails, a counter, keyboard
 * arrows on desktop, swipe on mobile, and a hover zoom that keeps the product's
 * real proportions (the frame never grows, nothing is cut off).
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const frameRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const total = images.length;
  const go = (next: number) => {
    if (total === 0) return;
    setIndex(((next % total) + total) % total);
    setZoom(false);
  };

  useEffect(() => {
    if (total <= 1) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (total === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-card text-brand/40">
        <PackageSearch className="h-14 w-14" />
      </div>
    );
  }

  const current = images[Math.min(index, total - 1)]!;

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-[oklch(1_0_0)]"
        onMouseMove={(event) => {
          const rect = frameRef.current?.getBoundingClientRect();
          if (!rect) return;
          setOrigin({
            x: ((event.clientX - rect.left) / rect.width) * 100,
            y: ((event.clientY - rect.top) / rect.height) * 100,
          });
        }}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => {
          setZoom(false);
          setOrigin({ x: 50, y: 50 });
        }}
        onTouchStart={(event) => {
          touchX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          const end = event.changedTouches[0]?.clientX ?? null;
          touchX.current = null;
          if (start === null || end === null) return;
          const delta = end - start;
          if (Math.abs(delta) < 40) return;
          go(delta < 0 ? index + 1 : index - 1);
        }}
      >
        <img
          src={current}
          alt={`${alt} — image ${index + 1} sur ${total}`}
          className="h-full w-full object-contain p-4 transition-transform duration-200 ease-out select-none"
          style={{
            transform: zoom ? "scale(1.8)" : "scale(1)",
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
          draggable={false}
        />

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Image précédente"
              onClick={() => go(index - 1)}
              className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2 text-foreground/70 shadow-[var(--shadow-card)] transition hover:text-brand"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Image suivante"
              onClick={() => go(index + 1)}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2 text-foreground/70 shadow-[var(--shadow-card)] transition hover:text-brand"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-semibold text-foreground/70">
              {index + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, i) => (
            <button
              key={image}
              type="button"
              onClick={() => go(i)}
              aria-label={`Voir l'image ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-16 w-16 overflow-hidden rounded-xl border bg-[oklch(1_0_0)] p-1 transition sm:h-20 sm:w-20",
                i === index ? "border-brand ring-1 ring-brand/40" : "border-border hover:border-brand/50",
              )}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
