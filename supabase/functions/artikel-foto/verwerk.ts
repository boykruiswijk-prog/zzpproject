import { initPhoton, PhotonImage, resize, crop, SamplingFilter } from "npm:@cf-wasm/photon@0.4.0/others";
import { fotoAfmetingen, perceptueleHash, sha256 } from "./regels.ts";
let ready: Promise<unknown> | undefined;
async function init() {
  ready ??= (async () => {
    const res = await fetch("https://cdn.jsdelivr.net/npm/@cf-wasm/photon@0.4.0/dist/lib/photon_rs_bg.wasm", { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error("Fotoconversie niet beschikbaar");
    return initPhoton({ module_or_path: new Uint8Array(await res.arrayBuffer()) });
  })();
  await ready;
}

export async function fotoHashes(bytes: Uint8Array) {
  // Existing trusted site images may slightly exceed the new-import limit.
  fotoAfmetingen(bytes, 16_000_000); await init();
  const image = PhotonImage.new_from_byteslice(bytes);
  try {
    const small = resize(image, 32, 32, SamplingFilter.Triangle);
    try { return { sha256: await sha256(bytes), phash: perceptueleHash(small.get_raw_pixels()) }; }
    finally { small.free(); }
  } finally { image.free(); }
}

export async function verwerkFoto(bytes: Uint8Array) {
  const dimensions = fotoAfmetingen(bytes); await init();
  const image = PhotonImage.new_from_byteslice(bytes);
  try {
    const small = resize(image, 32, 32, SamplingFilter.Triangle);
    let phash: string;
    try { phash = perceptueleHash(small.get_raw_pixels()); } finally { small.free(); }
    const height = Math.round(1600 * dimensions.height / dimensions.width);
    if (height > 3200) throw new Error("Foto moet liggend of vierkant zijn");
    const hero = resize(image, 1600, height, SamplingFilter.Lanczos3);
    let webp: Uint8Array;
    try { webp = hero.get_bytes_webp(); } finally { hero.free(); }
    const scale = Math.max(1200 / dimensions.width, 630 / dimensions.height);
    const cover = resize(image, Math.ceil(dimensions.width * scale), Math.ceil(dimensions.height * scale), SamplingFilter.Lanczos3);
    let og: Uint8Array;
    try {
      const x = Math.floor((cover.get_width() - 1200) / 2), y = Math.floor((cover.get_height() - 630) / 2);
      const clipped = crop(cover, x, y, x + 1200, y + 630);
      try { og = clipped.get_bytes_webp(); } finally { clipped.free(); }
    } finally { cover.free(); }
    return { webp, og, phash, sha256: await sha256(webp), bron_sha256: await sha256(bytes), width: 1600, height };
  } finally { image.free(); }
}