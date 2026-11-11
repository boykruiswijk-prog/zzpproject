import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { zoekLegacyDoel } from "../src/config/legacyRedirects";

export interface NotFoundRow { pad: string; aantal: number; laatste_op: string }
export const NOT_FOUND_QUERY = "SELECT pad, aantal, laatste_op FROM public.not_found_log WHERE aantal >= 3 AND laatste_op >= now() - interval '30 days' ORDER BY pad";

/** The log stores lifetime totals, not individual hits: use a conservative recent-activity window. */
export function notFoundKandidaten(rows: NotFoundRow[], now = Date.now()): string[] {
  const cutoff = now - 30 * 24 * 60 * 60 * 1000;
  return [...new Set(rows.filter(r => r.aantal >= 3 && Date.parse(r.laatste_op) >= cutoff).map(r => r.pad))];
}

/** Only the explicitly rejected A9 photo is exempt, never all asset/file paths. */
export function bewusteFoto404(pad: string): boolean {
  return /^\/(?:en\/|de\/|fr\/)?src\/assets\/team-walking\.webp\/?$/.test(pad);
}

export async function notFoundFouten(
  pads: string[],
  status: (pad: string) => Promise<number>,
  redirect = zoekLegacyDoel,
): Promise<string[]> {
  const fouten: string[] = [];
  for (const pad of pads) {
    if (bewusteFoto404(pad)) continue;
    const doel = redirect(pad);
    const code = await status(doel ?? pad);
    if (code !== 200 && code !== 301) fouten.push(`${pad}: ${code}${doel ? ` (doel ${doel})` : ""}`);
  }
  return fouten;
}

/** Private read-only CLI, no anon grants or credentials in source or public output. */
export async function checkNotFoundLog(dist: string, host: string): Promise<void> {
  const result = JSON.parse(execFileSync("lovable", ["supabase", "query", NOT_FOUND_QUERY, "--json"], {
    encoding: "utf8", timeout: 45_000, maxBuffer: 2 * 1024 * 1024,
  })) as { rows?: NotFoundRow[] };
  if (!Array.isArray(result.rows)) throw new Error("[404-controle] Log niet leesbaar; controle niet overgeslagen.");
  const pads = notFoundKandidaten(result.rows);
  const fouten = await notFoundFouten(pads, async pad => {
    if (!pad.startsWith("/") || pad.startsWith("//")) return 404;
    const clean = pad.split("?")[0].replace(/^\/+/, "");
    const file = path.resolve(dist, clean);
    if (file.startsWith(path.resolve(dist) + path.sep)) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return 200;
      if (fs.existsSync(path.join(file, "index.html"))) return 200;
    }
    const response = await fetch(new URL(pad, host), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    await response.body?.cancel();
    return response.status;
  });
  if (fouten.length) throw new Error(`[404-controle] 3+ treffers, recent binnen 30 dagen, geen 200/301: ${fouten.join(", ")}`);
  console.log(`[404-controle] ${pads.length} logpaden gecontroleerd; alleen afgekeurde A9-foto uitgezonderd.`);
}