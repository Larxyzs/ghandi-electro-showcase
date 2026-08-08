import { BRANDS } from "@/lib/brands";

export function BrandMarquee() {
  const loop = [...BRANDS, ...BRANDS];
  return (
    <div className="marquee-mask overflow-hidden py-2">
      <div className="marquee-track gap-[50px] hover:[animation-play-state:paused]">
        {loop.map((brand, i) => (
          <img
            key={`${brand.name}-${i}`}
            src={brand.logo}
            alt={brand.name}
            loading="lazy"
            className="h-[50px] w-auto shrink-0 object-contain"
            style={{ marginInlineEnd: "0px" }}
          />
        ))}
      </div>
    </div>
  );
}
