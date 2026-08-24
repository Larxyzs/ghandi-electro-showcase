import { Reveal } from "@/components/Reveal";
import type { MarketingSection, Product, ProductSpec } from "@/lib/catalog-types";

function SpecTable({ specs, title }: { specs: ProductSpec[]; title?: string }) {
  if (specs.length === 0) return null;
  return (
    <Reveal className="reveal">
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-10">
        <h3 className="font-display text-xl font-semibold">{title ?? "Spécifications"}</h3>
        <dl className="mt-6 grid gap-x-10 gap-y-0 sm:grid-cols-2">
          {specs.map((spec, i) => (
            <div
              key={`${spec.label}-${i}`}
              className="flex items-baseline justify-between gap-6 border-b border-border/70 py-3 text-sm"
            >
              <dt className="text-foreground/60">{spec.label}</dt>
              <dd className="text-end font-medium">{spec.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Reveal>
  );
}

function Figure({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04] ${className ?? ""}`}
    />
  );
}

/**
 * Renders the premium, Samsung-style marketing blocks stored on a product.
 * Blocks are authored by Cindy (AI research) or the admin — never invented here.
 */
export function ProductStory({ product }: { product: Product }) {
  const sections = product.marketing_sections ?? [];
  const specs = product.specifications ?? [];

  if (sections.length === 0 && specs.length === 0 && (product.gallery ?? []).length === 0)
    return null;

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-4 pb-24 sm:px-6">
      {(product.gallery ?? []).length > 0 && (
        <Reveal className="reveal">
          <div className="grid gap-4 sm:grid-cols-3">
            {(product.gallery ?? []).slice(0, 6).map((img, i) => (
              <div
                key={`${img}-${i}`}
                className="aspect-square overflow-hidden rounded-3xl border border-border bg-card"
              >
                <Figure src={img} alt={`${product.name} — vue ${i + 1}`} />
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {sections.map((section: MarketingSection, index) => {
        const key = `${section.type}-${index}`;
        switch (section.type) {
          case "full_image":
            return (
              <Reveal key={key} className="reveal-zoom">
                <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="aspect-[16/8]">
                    <Figure src={section.image} alt={section.title ?? product.name} />
                  </div>
                  {(section.title || section.body) && (
                    <div className="p-6 sm:p-10">
                      {section.title && (
                        <h3 className="font-display text-2xl font-semibold">{section.title}</h3>
                      )}
                      {section.body && (
                        <p className="mt-3 leading-relaxed text-foreground/70">{section.body}</p>
                      )}
                    </div>
                  )}
                </div>
              </Reveal>
            );
          case "image_text":
            return (
              <Reveal key={key} className={section.reverse ? "reveal-right" : "reveal-left"}>
                <div
                  className={`grid items-center gap-8 overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-2 ${
                    section.reverse ? "lg:[&>*:first-child]:order-2" : ""
                  }`}
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl">
                    <Figure src={section.image} alt={section.title} />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-semibold">{section.title}</h3>
                    <p className="mt-3 leading-relaxed text-foreground/70">{section.body}</p>
                  </div>
                </div>
              </Reveal>
            );
          case "feature":
            return (
              <Reveal key={key} className="reveal">
                <div className="rounded-3xl border border-border bg-card p-6 sm:p-10">
                  <h3 className="font-display text-2xl font-semibold">{section.title}</h3>
                  <p className="mt-3 leading-relaxed text-foreground/70">{section.body}</p>
                </div>
              </Reveal>
            );
          case "two_images":
          case "three_images": {
            const images = section.images ?? [];
            return (
              <Reveal key={key} className="reveal">
                <div
                  className={`grid gap-4 ${section.type === "two_images" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                >
                  {images.map((img, i) => (
                    <div
                      key={`${img}-${i}`}
                      className="aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-card"
                    >
                      <Figure src={img} alt={section.title ?? product.name} />
                    </div>
                  ))}
                </div>
              </Reveal>
            );
          }
          case "overlay":
            return (
              <Reveal key={key} className="reveal-zoom">
                <div className="relative overflow-hidden rounded-3xl border border-border">
                  <div className="aspect-[16/9]">
                    <Figure src={section.image} alt={section.title} />
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[oklch(0.15_0.03_260/0.85)] to-transparent p-6 sm:p-10">
                    <h3 className="font-display text-2xl font-semibold text-[oklch(1_0_0)]">
                      {section.title}
                    </h3>
                    <p className="mt-2 max-w-xl leading-relaxed text-[oklch(1_0_0/0.82)]">
                      {section.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          case "video":
            return (
              <Reveal key={key} className="reveal">
                <div className="overflow-hidden rounded-3xl border border-border bg-card">
                  <div className="aspect-video">
                    <iframe
                      src={section.url}
                      title={section.title ?? product.name}
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </Reveal>
            );
          case "specs":
            return (
              <SpecTable
                key={key}
                specs={specs}
                {...(section.title ? { title: section.title } : {})}
              />
            );
          default:
            return null;
        }
      })}

      {!sections.some((s) => s.type === "specs") && <SpecTable specs={specs} />}
    </section>
  );
}
