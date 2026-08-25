/**
 * Client-only image normalization helpers.
 * Never import server code here; never call at module scope (SSR-safe only
 * because these functions are only invoked from browser event handlers).
 */

export const NORMALIZED_SIZE = 1200;
const PADDING_RATIO = 0.04;
const JPEG_QUALITY = 0.88;

export type NormalizedImage = {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  changed: boolean;
};

export type NormalizeOptions = {
  size?: number;
  quality?: number;
};

function assertBrowser() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Traitement d'image indisponible côté serveur.");
  }
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger cette image."));
    img.src = src;
  });
}

function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire ce fichier."));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      loadImageFromUrl(dataUrl)
        .then((img) => resolve({ img, dataUrl }))
        .catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

/** Returns the intrinsic pixel size of a File, URL, or data URL, or null on failure. */
export async function readImageSize(
  source: File | string,
): Promise<{ width: number; height: number } | null> {
  try {
    assertBrowser();
    if (typeof source === "string") {
      const img = await loadImageFromUrl(source);
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    const { img } = await loadImageFromFile(source);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Rough byte size of a data URL (base64 payload). */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** Multi-step downscale with high-quality smoothing to avoid aliasing on big reductions. */
function drawScaled(
  img: HTMLImageElement,
  destCanvas: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
) {
  const ctx = destCanvas.getContext("2d");
  if (!ctx) throw new Error("Traitement d'image indisponible.");

  let srcCanvas: HTMLCanvasElement | HTMLImageElement = img;
  let curW = img.naturalWidth;
  let curH = img.naturalHeight;

  // Halve repeatedly until close to target size for better quality.
  while (curW / 2 > destW && curH / 2 > destH) {
    const nextW = Math.max(1, Math.round(curW / 2));
    const nextH = Math.max(1, Math.round(curH / 2));
    const step = document.createElement("canvas");
    step.width = nextW;
    step.height = nextH;
    const stepCtx = step.getContext("2d");
    if (!stepCtx) break;
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = "high";
    stepCtx.drawImage(srcCanvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
    srcCanvas = step;
    curW = nextW;
    curH = nextH;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, curW, curH, destX, destY, destW, destH);
}

/**
 * Normalizes a product image: fits it (contain, no crop/stretch) on a white
 * square canvas of `size`x`size` with padding, exported as JPEG.
 */
export async function normalizeImage(
  source: File | string,
  opts: NormalizeOptions = {},
): Promise<NormalizedImage> {
  assertBrowser();
  const size = opts.size ?? NORMALIZED_SIZE;
  const quality = opts.quality ?? JPEG_QUALITY;

  let img: HTMLImageElement;
  let name: string;

  try {
    if (typeof source === "string") {
      img = await loadImageFromUrl(source);
      name = source.split("/").pop()?.split("?")[0] || "image.jpg";
    } else {
      const loaded = await loadImageFromFile(source);
      img = loaded.img;
      name = source.name;
    }
  } catch {
    throw new Error("Impossible de charger cette image.");
  }

  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) {
    throw new Error("Image invalide ou vide.");
  }

  const alreadyNormalized =
    width === size &&
    height === size &&
    typeof source === "string" &&
    source.startsWith("data:image/jpeg");

  if (alreadyNormalized) {
    return { dataUrl: source, name, width, height, changed: false };
  }

  const usableSize = Math.round(size * (1 - PADDING_RATIO * 2));
  const finalScale = Math.min(usableSize / width, usableSize / height);
  const targetW = Math.max(1, Math.round(width * finalScale));
  const targetH = Math.max(1, Math.round(height * finalScale));
  const destX = Math.round((size - targetW) / 2);
  const destY = Math.round((size - targetH) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Traitement d'image indisponible.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  try {
    drawScaled(img, canvas, destX, destY, targetW, targetH);
  } catch {
    throw new Error("Échec du traitement de l'image.");
  }

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  } catch {
    throw new Error("Cette image ne peut pas être exportée (origine externe protégée).");
  }

  const cleanName = name.replace(/\.(png|webp|gif|bmp|jpeg)$/i, ".jpg");

  return { dataUrl, name: cleanName || "image.jpg", width: size, height: size, changed: true };
}
