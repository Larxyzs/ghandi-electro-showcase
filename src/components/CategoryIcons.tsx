/**
 * Ghandi's own category icons: thin blue line drawings of each appliance, seen from the front.
 * Drawn for this shop (48×48 grid, round ends, the line keeps the same thickness at every size).
 */
import type { ReactNode } from "react";

export type CategoryIcon = (props: { className?: string; strokeWidth?: number }) => ReactNode;

function make(body: ReactNode): CategoryIcon {
  const Icon: CategoryIcon = ({ className, strokeWidth = 1.5 }) => (
    <svg
      viewBox="0 0 48 48"
      className={className ? `cat-icon ${className}` : "cat-icon"}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
  return Icon;
}


// soft blue fill for glass, screens and doors (the "second tone" of the drawings)
const F = { fill: "currentColor", fillOpacity: 0.13, stroke: "none" } as const;
const feet = (a: number, b: number, y = 44) => <path d={`M${a} ${y}v1.6M${b} ${y}v1.6`} />;

// ---------- cold ----------
export const FridgeBottom = make(<>
  <rect x="14" y="28" width="20" height="16" rx="2" {...F} />
  <rect x="14" y="3" width="20" height="41" rx="3" />
  <path d="M14 27.5h20M30.5 10v9M30.5 31v6" />
  <path d="M17 7h5" opacity=".6" />
  {feet(16.5, 31.5)}
</>);
export const FridgeTop = make(<>
  <rect x="14" y="3" width="20" height="13" rx="2" {...F} />
  <rect x="14" y="3" width="20" height="41" rx="3" />
  <path d="M14 16h20M30.5 7v5M30.5 20v11" />
  {feet(16.5, 31.5)}
</>);
export const SideBySide = make(<>
  <rect x="11" y="10" width="9" height="7" rx="1.5" {...F} />
  <rect x="7" y="3" width="34" height="41" rx="3" />
  <rect x="11" y="10" width="9" height="7" rx="1.5" />
  <path d="M24 3v41M21.5 22v10M26.5 22v10M14 13.5v1.5M17 13.5v1.5" />
  {feet(9.5, 38.5)}
</>);
export const MultiDoor = make(<>
  <rect x="7" y="27" width="34" height="17" rx="2" {...F} />
  <rect x="7" y="3" width="34" height="41" rx="3" />
  <path d="M24 3v24M7 27h34M7 35.5h34M21.5 12v9M26.5 12v9M19 31.2h10M19 39.7h10" />
  {feet(9.5, 38.5)}
</>);
export const FridgeOne = make(<>
  <rect x="17.5" y="6.5" width="13" height="7" rx="1.5" {...F} />
  <rect x="15" y="3" width="18" height="41" rx="3" />
  <rect x="17.5" y="6.5" width="13" height="7" rx="1.5" strokeDasharray="1.5 1.8" />
  <path d="M29.5 18v11" />
  {feet(17.5, 30.5)}
</>);
export const MiniBar = make(<>
  <rect x="16" y="19" width="16" height="20" rx="1.5" {...F} />
  <rect x="13" y="16" width="22" height="26" rx="3" />
  <path d="M30.5 22v8M8 16h32" />
  <path d="M17 24h8M17 29h8M17 34h8" opacity=".55" />
  {feet(15.5, 32.5, 42)}
</>);
export const FridgeBuiltIn = make(<>
  <rect x="14" y="26" width="20" height="15" rx="1.5" {...F} />
  <path d="M7 3v42M41 3v42M7 3h34" strokeDasharray="2 2.4" />
  <rect x="13" y="6" width="22" height="36" rx="2.5" />
  <path d="M13 25.5h22M30 10v8M30 29.5v6" />
</>);
export const FreezerUpright = make(<>
  <rect x="17" y="6" width="14" height="36" rx="1.5" {...F} />
  <rect x="15" y="3" width="18" height="41" rx="3" />
  <path d="M15 13.5h18M15 23.5h18M15 33.5h18M21 8.5h6M21 18.5h6M21 28.5h6M21 38.5h6" />
  {feet(17.5, 30.5)}
</>);
export const FreezerChest = make(<>
  <rect x="6" y="25" width="36" height="14" rx="2" {...F} />
  <rect x="4" y="19" width="40" height="22" rx="3" />
  <path d="M4 25h40M20 30.5h8M7 41v2M41 41v2" />
  <path d="M24 5v10M19.7 7.5l8.6 5M28.3 7.5l-8.6 5M22.5 5.8L24 7.3l1.5-1.5M22.5 14.2L24 12.7l1.5 1.5" />
</>);

// ---------- laundry ----------
const washerTop = <>
  <rect x="10" y="3" width="28" height="41" rx="3" />
  <path d="M10 11.5h28M14 7.3h6" />
  <rect x="23" y="5.5" width="6" height="3.6" rx="1" {...F} />
  <rect x="23" y="5.5" width="6" height="3.6" rx="1" />
  <circle cx="33.5" cy="7.3" r="1.8" />
  {feet(13, 35)}
</>;
const drum = <>
  <circle cx="24" cy="28" r="10.5" {...F} />
  <circle cx="24" cy="28" r="10.5" />
  <circle cx="24" cy="28" r="7" />
  <path d="M34.5 25v6" />
</>;
export const WasherFront = make(<>
  {washerTop}
  {drum}
  <path d="M20.5 24.5a5 5 0 0 1 4-1.4" opacity=".6" />
</>);
export const WasherTop = make(<>
  <rect x="10" y="12" width="28" height="32" rx="3" />
  <path d="M10 12V6a3 3 0 0 1 3-3h22a3 3 0 0 1 3 3v6" />
  <ellipse cx="24" cy="19" rx="10" ry="3.5" {...F} />
  <ellipse cx="24" cy="19" rx="10" ry="3.5" />
  <path d="M14 7.5h6M30 7.5h4M18 29h12" />
  {feet(13, 35)}
</>);
export const WasherDryer = make(<>
  {washerTop}
  {drum}
  <path d="M19.5 27c1.5-1.8 3 1.8 4.5 0s3 1.8 4.5 0M19.5 31c1.5-1.8 3 1.8 4.5 0s3 1.8 4.5 0" />
</>);
export const Dryer = make(<>
  {washerTop}
  <circle cx="24" cy="28" r="10.5" {...F} />
  <circle cx="24" cy="28" r="10.5" />
  <path d="M20 32.5c-1.6-2 1.6-3.2 0-5.2M24 33.5c-1.6-2 1.6-3.2 0-5.2s1.6-3.2 0-5.2M28 32.5c-1.6-2 1.6-3.2 0-5.2" />
  <path d="M34.5 25v6" />
</>);

// ---------- washing up ----------
export const Dishwasher = make(<>
  <rect x="12" y="14" width="24" height="25" rx="1.5" {...F} />
  <rect x="10" y="3" width="28" height="41" rx="3" />
  <path d="M10 10.5h28M17 15h14M10 40h28" />
  <circle cx="15" cy="6.8" r="1" /><circle cx="18.6" cy="6.8" r="1" />
  <rect x="26" y="5.2" width="8" height="3.2" rx="1" />
  <path d="M18 25l2 2 4-4" opacity=".6" />
</>);
export const DishwasherBuiltIn = make(<>
  <rect x="11" y="12" width="26" height="28" rx="1.5" {...F} />
  <path d="M5 4h38M5 44h38" strokeDasharray="2 2.4" />
  <rect x="10" y="7" width="28" height="34" rx="2" />
  <path d="M10 11.5h28M17 16h14" />
  <circle cx="14.5" cy="9.3" r=".7" /><circle cx="17.5" cy="9.3" r=".7" />
</>);
export const Sink = make(<>
  <rect x="8" y="21" width="16" height="15" rx="3" {...F} />
  <rect x="4" y="17" width="40" height="23" rx="3.5" />
  <rect x="8" y="21" width="16" height="15" rx="3" />
  <path d="M28 22h12M28 26h12M28 30h12M28 34h12" opacity=".55" />
  <circle cx="16" cy="28.5" r="1.4" />
  <path d="M19 17V10a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1.5M27 11.5h4" />
</>);

// ---------- cooking ----------
export const Oven = make(<>
  <rect x="12" y="21" width="24" height="16" rx="2" {...F} />
  <rect x="6" y="5" width="36" height="37" rx="3" />
  <path d="M6 14h36M12.5 18h23" />
  <circle cx="11.5" cy="9.5" r="1.8" /><circle cx="36.5" cy="9.5" r="1.8" />
  <rect x="19.5" y="7.8" width="9" height="3.4" rx="1" />
  <rect x="12" y="21" width="24" height="16" rx="2" />
  <path d="M15 28h18" opacity=".55" />
</>);
export const Microwave = make(<>
  <rect x="9" y="15.5" width="23" height="17" rx="2" {...F} />
  <rect x="5" y="11.5" width="38" height="25" rx="3" />
  <rect x="9" y="15.5" width="23" height="17" rx="2" />
  <ellipse cx="20.5" cy="29" rx="7" ry="1.6" opacity=".6" />
  <rect x="35" y="15.5" width="5" height="3" rx=".8" />
  <circle cx="37.5" cy="25" r="2" />
  <path d="M36 30h3" />
  <path d="M8 36.5v2M40 36.5v2" />
</>);
export const MicrowaveBuiltIn = make(<>
  <rect x="11" y="17" width="19" height="14" rx="1.5" {...F} />
  <rect x="4" y="9" width="40" height="30" rx="1.5" strokeDasharray="2 2.4" />
  <rect x="8" y="13.5" width="32" height="21" rx="2.5" />
  <rect x="11" y="17" width="19" height="14" rx="1.5" />
  <circle cx="35" cy="24" r="1.8" />
</>);
const plate = <rect x="4" y="10" width="40" height="28" rx="3.5" {...F} />;
const gas = (x: number, y: number, r: number) => <>
  <circle cx={x} cy={y} r={r} />
  <circle cx={x} cy={y} r={r * 0.4} />
  <path d={`M${x - r - 1.5} ${y}h3M${x + r - 1.5} ${y}h3M${x} ${y - r - 1.5}v3M${x} ${y + r - 1.5}v3`} />
</>;
export const HobGas = make(<>
  {plate}
  <rect x="4" y="10" width="40" height="28" rx="3.5" />
  {gas(15, 19.5, 4)}{gas(33, 19.5, 4)}{gas(15, 30.5, 3.2)}{gas(33, 30.5, 4.6)}
</>);
export const HobElectric = make(<>
  {plate}
  <rect x="4" y="10" width="40" height="28" rx="3.5" />
  <circle cx="15" cy="20" r="5" /><circle cx="15" cy="20" r="2.6" opacity=".55" />
  <circle cx="33" cy="20" r="4" />
  <circle cx="15" cy="31.5" r="3.5" />
  <circle cx="32.5" cy="30.5" r="5" /><circle cx="32.5" cy="30.5" r="2.6" opacity=".55" />
  <path d="M21 35.5h6M23 13h2" />
</>);
export const HobMixed = make(<>
  {plate}
  <rect x="4" y="10" width="40" height="28" rx="3.5" />
  {gas(14.5, 19.5, 4)}{gas(14.5, 30.5, 3.4)}
  <path d="M24 13v22" strokeDasharray="1.5 2" />
  <circle cx="33.5" cy="19.5" r="4.5" /><circle cx="33.5" cy="30.5" r="4" />
</>);
const hoodLight = <path d="M16 38.5v3.5M24 38.5v3.5M32 38.5v3.5" strokeDasharray="1 2" opacity=".7" />;
export const Hood = make(<>
  <path d="M10 31.5h28l-10-9h-8z" {...F} />
  <path d="M20 3h8v19.5h-8zM20 22.5l-10 9h28l-10-9" />
  <rect x="10" y="31.5" width="28" height="4" rx="1.2" />
  <circle cx="15" cy="33.5" r=".6" /><circle cx="33" cy="33.5" r=".6" />
  {hoodLight}
</>);
export const HoodIsland = make(<>
  <path d="M10 31.5h28l-12-9h-4z" {...F} />
  <path d="M22 1v21.5M26 1v21.5M22 22.5l-12 9h28l-12-9" />
  <rect x="10" y="31.5" width="28" height="4" rx="1.2" />
  <circle cx="15" cy="33.5" r=".6" /><circle cx="33" cy="33.5" r=".6" />
  {hoodLight}
</>);
export const HoodVisor = make(<>
  <path d="M8 22l4 8h24l4-8z" {...F} />
  <rect x="8" y="13" width="32" height="9" rx="1.5" />
  <path d="M8 22l4 8h24l4-8M20 26h8" />
  <path d="M5 13h38" opacity=".55" />
  <path d="M16 34v3.5M24 34v3.5M32 34v3.5" strokeDasharray="1 2" opacity=".7" />
</>);
export const Cooker = make(<>
  <rect x="13" y="26" width="22" height="13" rx="1.5" {...F} />
  <rect x="9" y="12" width="30" height="32" rx="3" />
  <path d="M9 19.5h30M13 23h22" />
  <circle cx="13.5" cy="15.8" r="1.2" /><circle cx="18" cy="15.8" r="1.2" /><circle cx="30" cy="15.8" r="1.2" /><circle cx="34.5" cy="15.8" r="1.2" />
  <rect x="13" y="26" width="22" height="13" rx="1.5" />
  <path d="M13 9.5c0-1.6 6-1.6 6 0M29 9.5c0-1.6 6-1.6 6 0M9 12h30" />
  {feet(11.5, 36.5)}
</>);

// ---------- image & sound ----------
const tvScreen = <rect x="5" y="9" width="38" height="25" rx="1.5" {...F} />;
const tvBody = <>
  <rect x="3" y="7" width="42" height="29" rx="2.5" />
  <path d="M33 13l5 0M36 13l-5 5" opacity="0" />
  <path d="M17 41.5l3-5.5M31 41.5l-3-5.5M13 41.5h22" />
</>;
const glare = <path d="M34 12l-6 6M38 12l-10 10" opacity=".45" />;
export const Tv = make(<>{tvScreen}{tvBody}{glare}</>);
const label2 = (t: string) => (
  <text x="24" y="24.5" textAnchor="middle" fontSize={t.length > 3 ? 7.5 : 9} fontWeight="800" letterSpacing=".3" fill="currentColor" stroke="none" fontFamily="Inter, Arial, sans-serif">
    {t}
  </text>
);
const tvWith = (t: string) => make(<>{tvScreen}{tvBody}{label2(t)}</>);
export const Tv4k = tvWith("4K");
export const TvQled = tvWith("QLED");
export const TvOled = tvWith("OLED");
export const TvNano = tvWith("NANO");
export const TvFhd = tvWith("FHD");
export const TvRgb = tvWith("RGB");
export const TvNeo = tvWith("NEO");
export const TvSet = make(<>
  <rect x="21" y="23" width="23" height="15" rx="1" {...F} />
  <rect x="3" y="6" width="30" height="20" rx="2" />
  <path d="M18 26v3.5M12 30.5h12" />
  <rect x="19" y="21" width="27" height="19" rx="2" />
  <path d="M32.5 40v2.5M27 44h11" />
</>);
export const Soundbar = make(<>
  <rect x="3" y="19" width="42" height="10" rx="5" {...F} />
  <rect x="3" y="19" width="42" height="10" rx="5" />
  <circle cx="11" cy="24" r="2" /><circle cx="37" cy="24" r="2" /><path d="M19 24h10" />
  <path d="M9 35c3.5 2.5 6.5 2.5 10 0M29 35c3.5 2.5 6.5 2.5 10 0" />
</>);

// ---------- comfort ----------
export const AcWall = make(<>
  <rect x="4" y="10" width="40" height="16" rx="4.5" {...F} />
  <rect x="4" y="10" width="40" height="16" rx="4.5" />
  <path d="M8 21.5h32M8 24h32" opacity=".6" />
  <circle cx="37.5" cy="15" r=".9" />
  <path d="M13 31c-1.6 2 1.6 3.5 0 5.6s1.6 3.5 0 5.6M24 31c-1.6 2 1.6 3.5 0 5.6s1.6 3.5 0 5.6M35 31c-1.6 2 1.6 3.5 0 5.6s1.6 3.5 0 5.6" />
</>);
export const AcFloor = make(<>
  <rect x="17" y="6" width="14" height="15" rx="2" {...F} />
  <rect x="15" y="3" width="18" height="41" rx="3.5" />
  <path d="M19 9h10M19 12h10M19 15h10M19 18h10M21 26h6" />
  <circle cx="24" cy="31" r="1" />
  {feet(18, 30)}
</>);
export const AcPortable = make(<>
  <rect x="16" y="11" width="14" height="10" rx="1.5" {...F} />
  <rect x="13" y="7" width="20" height="33" rx="3.5" />
  <path d="M18 13h10M18 16h10M18 19h10M20 27h6" />
  <circle cx="17" cy="42.3" r="1.7" /><circle cx="29" cy="42.3" r="1.7" />
  <path d="M33 26h3a5 5 0 0 1 5 5v10" />
</>);
const blade = "M24 15c-1.5-4.5 1-8.5 3.6-7.6 2.4.9 1.1 5.2-3.6 7.6z";
export const Fan = make(<>
  <circle cx="24" cy="17" r="12.5" {...F} />
  <circle cx="24" cy="17" r="12.5" />
  <circle cx="24" cy="17" r="2" />
  <path d={blade} />
  <path d={blade} transform="rotate(120 24 17)" />
  <path d={blade} transform="rotate(240 24 17)" />
  <path d="M24 29.5v11.5M15 43.5h18" />
</>);
export const WaterHeater = make(<>
  <rect x="15" y="3" width="18" height="35" rx="9" {...F} />
  <rect x="15" y="3" width="18" height="35" rx="9" />
  <circle cx="24" cy="15" r="3.4" />
  <path d="M24 12.8v2.2l1.4 1.4M19 30h10M20 38v6M28 38v6" />
</>);
export const WaterHeaterGas = make(<>
  <rect x="14" y="3" width="20" height="35" rx="3" {...F} />
  <rect x="14" y="3" width="20" height="35" rx="3" />
  <path d="M24 30c-3.2-2-2.2-5.4 0-8.4.5 2.1 2.8 3.2 2.8 5.6A2.8 2.8 0 0 1 24 30z" />
  <path d="M18 9h12M18 12.5h7M20 38v6M28 38v6" />
</>);
export const Heater = make(<>
  <rect x="6" y="14" width="34" height="22" rx="2" {...F} />
  <path d="M8 11v28M14 11v28M20 11v28M26 11v28M32 11v28M38 11v28" />
  <path d="M5 15h36M5 35h36M38 25h4.5M8 39v4M38 39v4" />
</>);

// ---------- families ----------
export const BigAppliances = make(<>
  <rect x="4" y="25" width="17" height="19" rx="2" {...F} />
  <circle cx="34.5" cy="31" r="7" {...F} />
  <rect x="4" y="4" width="17" height="40" rx="2.5" />
  <path d="M4 25h17M17.5 10v7M17.5 29v6" />
  <rect x="25" y="12" width="19" height="32" rx="2.5" />
  <path d="M25 18h19M28 15h4" />
  <circle cx="34.5" cy="31" r="7" /><circle cx="34.5" cy="31" r="4.5" />
</>);
export const Comfort = AcWall;
export const Appliance = make(<>
  <rect x="15" y="20" width="18" height="16" rx="2" {...F} />
  <rect x="9" y="6" width="30" height="36" rx="3" />
  <path d="M9 14h30M14 10h6M33 10h1" />
  <rect x="15" y="20" width="18" height="16" rx="2" />
</>);

/** Most precise first: a sub-category name finds its own drawing, a family finds a wider one. */
const RULES: [RegExp, CategoryIcon][] = [
  [/table top|mini bar|petit refrig/, MiniBar],
  [/side by side|americain/, SideBySide],
  [/multi.?portes|4 portes|french/, MultiDoor],
  [/congelateur en haut|2 portes|deux portes/, FridgeTop],
  [/congelateur en bas|combine/, FridgeBottom],
  [/refrigerateur 1 porte|une porte/, FridgeOne],
  [/refrigerateur encastrable/, FridgeBuiltIn],
  [/congelateur coffre|coffre|horizontal/, FreezerChest],
  [/congelateur/, FreezerUpright],
  [/refrig|frigo/, FridgeBottom],
  [/sechante|lavante/, WasherDryer],
  [/seche.?linge/, Dryer],
  [/ouverture en haut|\btop\b/, WasherTop],
  [/machine a laver|lave.?linge|linge/, WasherFront],
  [/lave.?vaisselle encastrable/, DishwasherBuiltIn],
  [/vaisselle/, Dishwasher],
  [/evier/, Sink],
  [/plaque.*mixte/, HobMixed],
  [/plaque.*(electrique|vitro|induction)/, HobElectric],
  [/plaque|table de cuisson/, HobGas],
  [/hotte ilot/, HoodIsland],
  [/hotte visiere/, HoodVisor],
  [/hotte/, Hood],
  [/micro.?ondes? encastrable/, MicrowaveBuiltIn],
  [/micro.?onde/, Microwave],
  [/cuisiniere/, Cooker],
  [/four/, Oven],
  [/barre de son|\bson\b|audio|enceinte/, Soundbar],
  [/oled/, TvOled],
  [/neo qled/, TvNeo],
  [/qled|qned|mini led/, TvQled],
  [/nanocell/, TvNano],
  [/full hd|fhd/, TvFhd],
  [/microrgb|rgb/, TvRgb],
  [/4k|uhd/, Tv4k],
  [/televisions/, TvSet],
  [/televis|\btv\b|ecran/, Tv],
  [/climatiseur mobile|mobile/, AcPortable],
  [/climatiseur armoire/, AcFloor],
  [/climat/, AcWall],
  [/ventil/, Fan],
  [/chauffe.?eau a gaz/, WaterHeaterGas],
  [/chauffe.?eau/, WaterHeater],
  [/chauffage|radiateur/, Heater],
  [/confort/, Comfort],
  [/gros electro/, BigAppliances],
];

export function categoryIcon(name: string): CategoryIcon {
  const n = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return RULES.find(([re]) => re.test(n))?.[1] ?? Appliance;
}

/** Every drawing with its name, for checking them side by side. */
export const ALL_ICONS: Record<string, CategoryIcon> = {
  FridgeBottom, FridgeTop, SideBySide, MultiDoor, FridgeOne, MiniBar, FridgeBuiltIn, FreezerUpright, FreezerChest,
  WasherFront, WasherTop, WasherDryer, Dryer, Dishwasher, DishwasherBuiltIn, Sink, Oven, Microwave, MicrowaveBuiltIn,
  HobGas, HobElectric, HobMixed, Hood, HoodIsland, HoodVisor, Cooker, Tv, Tv4k, TvQled, TvOled, TvNano, TvFhd, TvRgb,
  TvNeo, TvSet, Soundbar, AcWall, AcFloor, AcPortable, Fan, WaterHeater, WaterHeaterGas, Heater, BigAppliances, Appliance,
};
