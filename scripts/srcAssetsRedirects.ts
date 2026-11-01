import fs from "node:fs";
import path from "node:path";
import { zoekLegacyDoel } from "../src/config/legacyRedirects";

export function srcAssetBestanden(root: string): string[] {
  const directory = path.join(root, "src/assets");
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [path.relative(root, file).split(path.sep).join("/")] : [];
  });
  return walk(directory);
}

export function srcAssetStubDoelen(bron: string, gebouwd: string) {
  return ["", "en/", "de/", "fr/"].map(prefix => {
    const from = `${prefix}${bron}`;
    return { from, to: zoekLegacyDoel(`/${from}`) ?? gebouwd };
  });
}

export function srcAssetStubHtml(to: string): string {
  const escaped = to.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const literal = JSON.stringify(to).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${escaped}"><script>window.location.replace(${literal});</script></head><body></body></html>`;
}

/** Real directories work for extension paths too, without relying on SPA fallback. */
interface AssetEmitter {
  emitFile(asset: { type: "asset"; name?: string; originalFileName?: string; fileName?: string; source: string | Uint8Array }): string;
  getFileName(ref: string): string;
}

export function srcAssetsRedirectPlugin(root: string) {
  const refs = new Map<string, string>();
  return {
    name: "zp-src-assets-redirects",
    apply: "build" as const,
    buildStart(this: AssetEmitter) {
      refs.clear();
      for (const bron of srcAssetBestanden(root)) {
        refs.set(bron, this.emitFile({ type: "asset", name: path.basename(bron), originalFileName: bron, source: fs.readFileSync(path.join(root, bron)) }));
      }
    },
    generateBundle(this: AssetEmitter) {
      for (const [bron, ref] of refs) {
        for (const { from, to } of srcAssetStubDoelen(bron, `/${this.getFileName(ref)}`)) {
          this.emitFile({ type: "asset", fileName: `${from}/index.html`, source: srcAssetStubHtml(to) });
        }
      }
    },
  };
}