import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PackageSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Professional product slideshow.
 *
 * Original manufacturer images only, always fully visible (object-contain, never
 * cropped): previous/next buttons, clickable thumbnails, a counter, keyboard
 * arrows on desktop, swipe on mobile, and a hover zoom that keeps the product's
 * real proportions (the frame never grows, nothing is cut off).
 * Clicking the image opens a fullscreen viewer with large arrows.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const touchMoved = useRef(false);

  const total = images.length;
  const go = (next: number) => {
    if (total === 0) return;
    setIndex(((next % total) + total) % total);
    setZoom(false);
  };

  useEffect(() => {
    if (total <= 1 && !lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  if (total === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-card text-text-3">
        <PackageSearch className="h-14 w-14" />
      </div>
    );
  }

  const current = images[Math.min(index, total - 1)]!;

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row-reverse">
        <div
          ref={frameRef}
          className="group relative aspect-square min-w-0 flex-1 overflow-hidden rounded-lg bg-card"
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
            touchMoved.current = false;
          }}
          onTouchEnd={(event) => {
            const start = touchX.current;
            const end = event.changedTouches[0]?.clientX ?? null;
            touchX.current = null;
            if (start === null || end === null) return;
            const delta = end - start;
            if (Math.abs(delta) < 40) return;
            touchMoved.current = true;
            go(delta < 0 ? index + 1 : index - 1);
          }}
        >
          <img
            src={current}
            alt={`${alt} — image ${index + 1} sur ${total}`}
            onClick={() => {
              if (!touchMoved.current) setLightbox(true);
            }}
            className="h-full w-full cursor-zoom-in object-contain p-4 transition-transform duration-200 ease-out select-none"
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
          <div className="flex gap-2 overflow-x-auto md:max-h-[520px] md:w-20 md:shrink-0 md:flex-col md:overflow-x-visible md:overflow-y-auto">
            {images.map((image, i) => (
              <button
                key={image}
                type="button"
                onClick={() => go(i)}
                aria-label={`Voir l'image ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-card p-1 transition md:h-20 md:w-20",
                  i === index ? "border-brand ring-1 ring-brand/40" : "border-border hover:border-brand/50",
                )}
              >
                <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 p-4 sm:p-10"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Aperçu de ${alt}`}
        >
          <img
            src={current}
            alt={`${alt} — image ${index + 1} sur ${total}`}
            className="max-h-full max-w-full object-contain select-none"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
          {total > 1 && (
            <>
              <button
                type="button"
                aria-label="Image précédente"
                onClick={(e) => {
                  e.stopPropagation();
                  go(index - 1);
                }}
                className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full bg-background/15 p-3 text-background transition hover:bg-background/25"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                aria-label="Image suivante"
                onClick={(e) => {
                  e.stopPropagation();
                  go(index + 1);
                }}
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full bg-background/15 p-3 text-background transition hover:bg-background/25"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-background/15 px-3 py-1 text-xs font-semibold text-background">
                {index + 1} / {total}
              </span>
            </>
          )}
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setLightbox(false)}
            className="absolute end-3 top-3 rounded-full bg-background/15 p-3 text-background transition hover:bg-background/25"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
