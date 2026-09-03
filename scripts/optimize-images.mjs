// Eenmalig script: verkleint en converteert grote afbeeldingen naar WebP.
//
// - src/assets: bestanden > 200 kB worden naar .webp geconverteerd, het
//   origineel wordt verwijderd en alle verwijzingen in src/ worden herschreven.
// - public/: bestanden > 200 kB worden alleen gerecomprimeerd met hetzelfde
//   formaat (PNG blijft PNG), want die worden op vaste paden geladen door o.a.
//   de PDF-generatie die geen WebP ondersteunt.
//
// Gebruik: bun scripts/optimize-images.mjs

import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIMIT = 200 * 1024;

/** Maximale breedte per gebruik. */
function maxWidthFor(file) {
  const name = path.basename(file).toLowerCase();
  if (/hero|office|team-meeting|team-walking|team-cheers|corporate/.test(name)) return 1920;
  if (/logo|icon|signature|favicon|approved/.test(name)) return 600;
  return 800;
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

async function main() {
  const targets = [];
  for (const dir of ["src/assets", "public"]) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      if (!IMAGE_RE.test(file)) continue;
      if (fs.statSync(file).size <= LIMIT) continue;
      targets.push(file);
    }
  }

  let before = 0;
  let after = 0;
  const renames = [];

  for (const file of targets) {
    const size = fs.statSync(file).size;
    before += size;
    const width = maxWidthFor(file);
    const isAsset = file.includes(`${path.sep}src${path.sep}assets${path.sep}`);
    const meta = await sharp(file).metadata();
    const resize = meta.width && meta.width > width ? { width } : undefined;

    if (isAsset) {
      const out = file.replace(/\.(png|jpe?g)$/i, ".webp");
      const buf = await sharp(file)
        .rotate()
        .resize(resize)
        .webp({ quality: 78, effort: 5 })
        .toBuffer();
      if (out !== file) {
        fs.writeFileSync(out, buf);
        fs.unlinkSync(file);
        renames.push([path.basename(file), path.basename(out)]);
      } else {
        fs.writeFileSync(file, buf);
      }
      after += buf.length;
    } else {
      const ext = path.extname(file).toLowerCase();
      const pipeline = sharp(file).rotate().resize(resize);
      const buf =
        ext === ".png"
          ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
          : ext === ".webp"
            ? await pipeline.webp({ quality: 80 }).toBuffer()
            : await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      fs.writeFileSync(file, buf);
      after += buf.length;
    }
  }

  // Verwijzingen bijwerken (alleen bestandsnamen die echt zijn omgezet).
  if (renames.length) {
    const codeFiles = walk(path.join(ROOT, "src")).filter((f) => /\.(tsx?|css)$/.test(f));
    for (const cf of codeFiles) {
      let text = fs.readFileSync(cf, "utf8");
      let changed = false;
      for (const [from, to] of renames) {
        if (text.includes(from)) {
          text = text.split(from).join(to);
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(cf, text);
    }
  }

  console.log(`Bestanden geoptimaliseerd: ${targets.length}`);
  console.log(`Voor:  ${(before / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Na:    ${(after / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Omgezet naar WebP: ${renames.length}`);
}

main();
