export const FOTO_HOSTS = ["cdn.higgsfield.ai", "static-public-media.higgsfield.ai", "static.higgsfield.ai", "d8j0ntlcm91z4.cloudfront.net"] as const;
export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_PIXELS = 12_000_000;
export const PHASH_AFSTAND = 8;
export const FOTO_VANAF = "2026-10-27T00:00:00+01:00";

export function fotoUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !FOTO_HOSTS.some(host => host === url.hostname)) throw new Error("Foto-URL moet HTTPS op een toegestane Higgsfield-host zijn");
  return url;
}

export async function downloadFoto(url: URL, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes((response.headers.get("content-type") ?? "").split(";")[0].trim())) {
    await response.body?.cancel();
    throw new Error("Foto niet bereikbaar of geen JPEG, PNG of WebP");
  }
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel(); throw new Error("Foto groter dan 15 MB");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Lege foto");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new Error("Foto groter dan 15 MB");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  if (!length) throw new Error("Lege foto");
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

/** Read dimensions before decoding to reject compressed pixel bombs. */
export function fotoAfmetingen(bytes: Uint8Array, maxPixels = MAX_PIXELS): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, n: number) => String.fromCharCode(...bytes.slice(start, start + n));
  let width = 0, height = 0;
  if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === "PNG") {
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    const kind = text(12, 4);
    if (kind === "VP8X") {
      if (bytes[20] & 2) throw new Error("Geanimeerde foto niet toegestaan");
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (kind === "VP8 ") {
      width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
    } else if (kind === "VP8L") {
      const bits = view.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
    }
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i + 8 < bytes.length) {
      if (bytes[i] !== 255) break;
      const marker = bytes[i + 1]; i += 2;
      if (marker === 216 || marker === 1) continue;
      if (marker === 218 || marker === 217) break;
      const size = view.getUint16(i);
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        height = view.getUint16(i + 3); width = view.getUint16(i + 5); break;
      }
      if (size < 2) break; i += size;
    }
  }
  if (!width || !height || width * height > maxPixels || width > 8000 || height > 8000) throw new Error("Ongeldige foto of meer dan 12 miljoen pixels");
  return { width, height };
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, "0")).join("");
}

/** 64-bit DCT pHash, same normalization for legacy and new photos. */
export function perceptueleHash(rgba: Uint8Array): string {
  if (rgba.length !== 32 * 32 * 4) throw new Error("pHash vereist 32x32 pixels");
  const gray = Array.from({ length: 1024 }, (_, i) => (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000);
  const coefficients: number[] = [];
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let sum = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) sum += gray[y * 32 + x] * Math.cos((2 * x + 1) * u * Math.PI / 64) * Math.cos((2 * y + 1) * v * Math.PI / 64);
    coefficients.push(sum);
  }
  const sorted = coefficients.slice(1).sort((a, b) => a - b); const median = sorted[31];
  let hash = 0n;
  for (const [i, value] of coefficients.entries()) hash = (hash << 1n) | BigInt(i > 0 && value > median ? 1 : 0);
  return hash.toString(16).padStart(16, "0");
}

export function hashAfstand(a: string, b: string): number {
  let bits = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), count = 0;
  while (bits) { count++; bits &= bits - 1n; } return count;
}

export function fotoPublicatieGeldig(article: { published_at?: string | null; image_url?: string | null }, geregistreerd: boolean): boolean {
  if (article.published_at && Date.parse(article.published_at) < Date.parse(FOTO_VANAF)) return true;
  return geregistreerd && Boolean(article.image_url?.includes("/article-images/fotos/") && !article.image_url?.endsWith("-og.webp"));
}