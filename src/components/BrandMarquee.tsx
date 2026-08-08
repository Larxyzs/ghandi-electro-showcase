import { BRANDS } from "@/lib/brands";

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-[50px] pe-[50px]" aria-hidden={hidden}>
      {BRANDS.map((brand) => (
        <img
          key={brand.name}
          src={brand.logo}
          alt={hidden ? "" : brand.name}
          loading="lazy"
          className="h-[50px] w-auto shrink-0 object-contain"
        />
      ))}
    </div>
  );
}

export function BrandMarquee() {
  return (
    <div className="marquee-mask overflow-hidden py-2">
      <div className="marquee-track hover:[animation-play-state:paused]">
        <Group />
        <Group hidden />
      </div>
    </div>
  );
}
