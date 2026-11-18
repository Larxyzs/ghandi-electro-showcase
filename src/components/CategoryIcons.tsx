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

const label = (t: string) => (
  <text x="24" y="21" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, Arial, sans-serif">
    {t}
  </text>
);

// ---------- cold ----------
export const FridgeBottom = make(<>
  <rect x="14" y="4" width="20" height="40" rx="2.5" />
  <path d="M14 27h20M30 11v8M30 31v6M16 44v1.5M32 44v1.5" />
</>);
export const FridgeTop = make(<>
  <rect x="14" y="4" width="20" height="40" rx="2.5" />
  <path d="M14 16h20M30 8v5M30 20v10M16 44v1.5M32 44v1.5" />
</>);
export const SideBySide = make(<>
  <rect x="8" y="4" width="32" height="40" rx="2.5" />
  <path d="M24 4v40M21 15v10M27 15v10M12 9h6M10 44v1.5M38 44v1.5" />
</>);
export const MultiDoor = make(<>
  <rect x="8" y="4" width="32" height="40" rx="2.5" />
  <path d="M24 4v23M8 27h32M8 35.5h32M22 12v8M26 12v8M20 31h8M20 39.5h8" />
</>);
export const FridgeOne = make(<>
  <rect x="15" y="4" width="18" height="40" rx="2.5" />
  <path d="M30 12v12M18 9h9M16 44v1.5M32 44v1.5" />
</>);
export const MiniBar = make(<>
  <rect x="13" y="16" width="22" height="26" rx="2.5" />
  <path d="M31 22v8M16 21h8M15 42v2M33 42v2M9 16h30" />
</>);
export const FridgeBuiltIn = make(<>
  <rect x="9" y="3" width="30" height="42" rx="1.5" strokeDasharray="2 2.5" />
  <rect x="14" y="7" width="20" height="34" rx="2" />
  <path d="M14 26h20M30 12v7M30 30v6" />
</>);
export const FreezerUpright = make(<>
  <rect x="15" y="4" width="18" height="40" rx="2.5" />
  <path d="M15 14h18M15 24h18M15 34h18M21 9h6M21 19h6M21 29h6M21 39h6" />
</>);
export const FreezerChest = make(<>
  <rect x="5" y="18" width="38" height="22" rx="2.5" />
  <path d="M5 24h38M20 29h8M7 40v2M41 40v2" />
  <path d="M24 8v7M21 9.5l6 4M27 9.5l-6 4" />
</>);

// ---------- laundry ----------
const washerBody = <>
  <rect x="10" y="4" width="28" height="40" rx="2.5" />
  <path d="M10 12h28" />
  <circle cx="32" cy="8" r="1.6" />
  <path d="M14 8h7" />
</>;
export const WasherFront = make(<>
  {washerBody}
  <circle cx="24" cy="28" r="10" />
  <circle cx="24" cy="28" r="6.5" />
</>);
export const WasherTop = make(<>
  <rect x="10" y="10" width="28" height="34" rx="2.5" />
  <path d="M10 4h28v6H10z" />
  <ellipse cx="24" cy="18" rx="9" ry="3" />
  <path d="M14 7h6M31 7h3M17 28h14" />
</>);
export const WasherDryer = make(<>
  {washerBody}
  <circle cx="24" cy="28" r="10" />
  <path d="M19 27c1.7-2 3.3 2 5 0s3.3 2 5 0M19 31c1.7-2 3.3 2 5 0s3.3 2 5 0" />
</>);
export const Dryer = make(<>
  {washerBody}
  <circle cx="24" cy="28" r="10" />
  <path d="M20 32c-1.5-2 1.5-3 0-5M24 33c-1.5-2 1.5-3 0-5s1.5-3 0-5M28 32c-1.5-2 1.5-3 0-5" />
</>);

// ---------- washing up ----------
export const Dishwasher = make(<>
  <rect x="10" y="4" width="28" height="40" rx="2.5" />
  <path d="M10 11h28M17 15h14M10 40h28" />
  <circle cx="15" cy="7.5" r="1" /><circle cx="19" cy="7.5" r="1" /><path d="M27 7.5h7" />
</>);
export const DishwasherBuiltIn = make(<>
  <path d="M6 4h36M6 44h36" strokeDasharray="2 2.5" />
  <rect x="10" y="7" width="28" height="34" rx="1.5" />
  <path d="M10 12h28M17 16h14" />
  <circle cx="15" cy="9.5" r=".8" /><circle cx="18.5" cy="9.5" r=".8" />
</>);
export const Sink = make(<>
  <rect x="4" y="16" width="40" height="24" rx="3" />
  <rect x="8" y="20" width="15" height="16" rx="2.5" />
  <rect x="26" y="22" width="14" height="12" rx="2.5" strokeDasharray="1.5 2" />
  <circle cx="15.5" cy="28" r="1.4" />
  <path d="M20 16V9a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v2" />
</>);

// ---------- cooking ----------
export const Oven = make(<>
  <rect x="7" y="6" width="34" height="36" rx="2.5" />
  <path d="M7 14h34M13 18h22" />
  <circle cx="12" cy="10" r="1.6" /><circle cx="36" cy="10" r="1.6" /><path d="M20 10h8" />
  <rect x="12" y="21" width="24" height="16" rx="2" />
</>);
export const Microwave = make(<>
  <rect x="5" y="12" width="38" height="25" rx="2.5" />
  <rect x="9" y="16" width="23" height="17" rx="2" />
  <path d="M36 16h4M36 20h4" />
  <circle cx="38" cy="28" r="2" />
  <path d="M8 37v2M40 37v2" />
</>);
export const MicrowaveBuiltIn = make(<>
  <rect x="5" y="9" width="38" height="30" rx="1.5" strokeDasharray="2 2.5" />
  <rect x="8" y="14" width="32" height="20" rx="2" />
  <rect x="11" y="17" width="19" height="14" rx="1.5" />
  <circle cx="35" cy="24" r="1.8" />
</>);
export const HobGas = make(<>
  <rect x="5" y="10" width="38" height="28" rx="3" />
  <circle cx="16" cy="19" r="4.5" /><circle cx="16" cy="19" r="1.5" />
  <circle cx="32" cy="19" r="4.5" /><circle cx="32" cy="19" r="1.5" />
  <circle cx="16" cy="30" r="3.5" /><circle cx="16" cy="30" r="1" />
  <circle cx="32" cy="30" r="5" /><circle cx="32" cy="30" r="2" />
</>);
export const HobElectric = make(<>
  <rect x="5" y="10" width="38" height="28" rx="3" />
  <circle cx="16" cy="20" r="5" /><circle cx="32" cy="20" r="4" />
  <circle cx="16" cy="31" r="3.5" /><circle cx="32" cy="30.5" r="5" />
  <path d="M10 35.5h3M21 35.5h6" />
</>);
export const HobMixed = make(<>
  <rect x="5" y="10" width="38" height="28" rx="3" />
  <circle cx="16" cy="19" r="4.5" /><circle cx="16" cy="19" r="1.5" />
  <circle cx="16" cy="30" r="3.5" /><circle cx="16" cy="30" r="1" />
  <path d="M24 12v24" strokeDasharray="1.5 2" />
  <circle cx="33" cy="19.5" r="4.5" /><circle cx="33" cy="30.5" r="4" />
</>);
export const Hood = make(<>
  <path d="M20 4h8v18h-8zM20 22l-10 9h28l-10-9" />
  <rect x="10" y="31" width="28" height="4" rx="1" />
  <path d="M17 39v3M24 39v3M31 39v3" strokeDasharray="1 2" />
</>);
export const HoodIsland = make(<>
  <path d="M22 2v20M26 2v20M22 22l-12 9h28l-12-9" />
  <rect x="10" y="31" width="28" height="4" rx="1" />
  <circle cx="17" cy="33" r=".7" /><circle cx="31" cy="33" r=".7" />
  <path d="M17 39v3M24 39v3M31 39v3" strokeDasharray="1 2" />
</>);
export const HoodVisor = make(<>
  <path d="M8 14h32v8H8zM8 22l4 8h24l4-8" />
  <path d="M20 26h8M17 35v3M24 35v3M31 35v3" />
</>);
export const Cooker = make(<>
  <rect x="9" y="12" width="30" height="32" rx="2.5" />
  <path d="M9 19h30M13 23h22M11 44v1.5M37 44v1.5" />
  <rect x="13" y="26" width="22" height="13" rx="1.5" />
  <circle cx="13" cy="15.5" r="1.2" /><circle cx="18" cy="15.5" r="1.2" /><circle cx="30" cy="15.5" r="1.2" /><circle cx="35" cy="15.5" r="1.2" />
  <path d="M14 9h6M28 9h6" />
</>);

// ---------- image & sound ----------
const tvBody = <>
  <rect x="4" y="8" width="40" height="27" rx="2" />
  <path d="M24 35v4M16 41h16" />
</>;
export const Tv = make(tvBody);
const tvWith = (t: string) => make(<>{tvBody}{label(t)}</>);
export const Tv4k = tvWith("4K");
export const TvQled = tvWith("QLED");
export const TvOled = tvWith("OLED");
export const TvNano = tvWith("NANO");
export const TvFhd = tvWith("FHD");
export const TvRgb = tvWith("RGB");
export const TvNeo = tvWith("NEO");
export const TvSet = make(<>
  <rect x="3" y="7" width="30" height="20" rx="2" />
  <path d="M18 27v3M12 32h12" />
  <rect x="20" y="22" width="25" height="17" rx="2" />
  <path d="M32.5 39v2.5M28 43h9" />
</>);
export const Soundbar = make(<>
  <rect x="3" y="20" width="42" height="9" rx="4.5" />
  <circle cx="11" cy="24.5" r="1.5" /><circle cx="37" cy="24.5" r="1.5" /><path d="M19 24.5h10" />
  <path d="M10 34c3 2 5 2 8 0M30 34c3 2 5 2 8 0" />
</>);

// ---------- comfort ----------
export const AcWall = make(<>
  <rect x="4" y="11" width="40" height="15" rx="4" />
  <path d="M8 21.5h32M35 15.5h4" />
  <path d="M14 31c-1.5 2 1.5 3.5 0 5.5M24 31c-1.5 2 1.5 3.5 0 5.5M34 31c-1.5 2 1.5 3.5 0 5.5" />
</>);
export const AcFloor = make(<>
  <rect x="15" y="4" width="18" height="40" rx="3" />
  <path d="M19 9h10M19 12h10M19 15h10M19 18h10M21 25h6M17 44v1.5M31 44v1.5" />
</>);
export const AcPortable = make(<>
  <rect x="14" y="8" width="18" height="32" rx="3" />
  <path d="M18 13h10M18 16h10M18 19h10" />
  <circle cx="17.5" cy="42" r="1.6" /><circle cx="28.5" cy="42" r="1.6" />
  <path d="M32 26c6 0 8 2 8 7v8" />
</>);
const blade = "M24 15c-1.5-4.5 1-8.5 3.6-7.6 2.4.9 1.1 5.2-3.6 7.6z";
export const Fan = make(<>
  <circle cx="24" cy="17" r="12" />
  <circle cx="24" cy="17" r="2" />
  <path d={blade} />
  <path d={blade} transform="rotate(120 24 17)" />
  <path d={blade} transform="rotate(240 24 17)" />
  <path d="M24 29v12M16 43h16" />
</>);
export const WaterHeater = make(<>
  <rect x="15" y="4" width="18" height="34" rx="9" />
  <circle cx="24" cy="15" r="3" />
  <path d="M24 13v2l1.2 1.2M20 38v6M28 38v6M18 30h12" />
</>);
export const WaterHeaterGas = make(<>
  <rect x="14" y="4" width="20" height="34" rx="3" />
  <path d="M24 29c-3-2-2-5 0-8 .4 2 2.5 3 2.5 5.3A2.5 2.5 0 0 1 24 29z" />
  <path d="M18 10h12M20 38v6M28 38v6" />
</>);
export const Heater = make(<>
  <path d="M8 12v26M14 12v26M20 12v26M26 12v26M32 12v26M38 12v26" />
  <path d="M6 16h34M6 34h34M38 25h4M8 38v4M38 38v4" />
</>);

// ---------- families ----------
export const BigAppliances = make(<>
  <rect x="4" y="4" width="17" height="40" rx="2" />
  <path d="M4 26h17M18 10v7M18 30v6" />
  <rect x="25" y="12" width="19" height="32" rx="2" />
  <path d="M25 18h19" />
  <circle cx="34.5" cy="31" r="7" /><circle cx="34.5" cy="31" r="4.5" />
</>);
export const Comfort = AcWall;
export const Appliance = make(<>
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
