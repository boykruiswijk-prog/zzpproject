// @vitest-environment node
// C-aanvulling Factuurplanner 429: tempo, Retry-After, max 3 pogingen, nooit 'fout' en nooit dubbele POST.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { maakExactTempo, postMetSleutel, wachtTijdUit, ExactTijdelijkError, EXACT_MIN_INTERVAL_MS } from "../../supabase/functions/_shared/exactTempo";

const resp = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? "{}" : "x", { status, headers });
function klok() {
  let t = 0; const slapen: number[] = [];
  return { nu: () => t, slaap: async (ms: number) => { slapen.push(ms); t += ms; }, slapen };
}

describe("Exact-tempo", () => {
  it("houdt minimaal 1,1 seconde tussen aanroepen", async () => {
    const k = klok(); const tempo = maakExactTempo(k);
    const tijden: number[] = [];
    for (let i = 0; i < 3; i++) await tempo(async () => { tijden.push(k.nu()); return resp(200); });
    expect(EXACT_MIN_INTERVAL_MS).toBe(1100);
    expect(tijden[1] - tijden[0]).toBeGreaterThanOrEqual(1100);
    expect(tijden[2] - tijden[1]).toBeGreaterThanOrEqual(1100);
  });
  it("respecteert Retry-After en stopt na 3 pogingen", async () => {
    const k = klok(); const tempo = maakExactTempo(k); let n = 0;
    const r = await tempo(async () => { n++; return resp(429, { "retry-after": "5" }); });
    expect(n).toBe(3); expect(r.status).toBe(429);
    expect(k.slapen).toContain(5000);
  });
  it("wacht oplopend zonder Retry-After en herhaalt ook bij 503", async () => {
    expect([wachtTijdUit(null, 1), wachtTijdUit(null, 2), wachtTijdUit(null, 3)]).toEqual([2000, 4000, 8000]);
    const k = klok(); const tempo = maakExactTempo(k); let n = 0;
    const r = await tempo(async () => (++n === 1 ? resp(503) : resp(200)));
    expect(n).toBe(2); expect(r.status).toBe(200);
  });
  it("herhaalt een POST nooit automatisch", async () => {
    const k = klok(); const tempo = maakExactTempo(k); let n = 0;
    await tempo(async () => { n++; return resp(429); }, false);
    expect(n).toBe(1);
  });
});

describe("POST met sleutelcontrole", () => {
  const slaap = async () => {};
  it("429 en daarna 200 maakt precies 1 concept", async () => {
    let posts = 0; let zoeken = 0;
    const uit = await postMetSleutel(async () => (++posts === 1 ? resp(429) : resp(200)), async () => { zoeken++; return []; }, slaap);
    expect(uit.soort).toBe("aangemaakt"); expect(posts).toBe(2); expect(zoeken).toBe(1);
  });
  it("geen tweede POST als de sleutel na 429 toch in Exact staat", async () => {
    let posts = 0;
    const uit = await postMetSleutel(async () => { posts++; return resp(429); }, async () => [{ InvoiceID: "abc" }], slaap);
    expect(uit.soort).toBe("bestond"); expect(posts).toBe(1);
  });
  it("blijvend 429 wordt tijdelijk, maximaal 3 POST's", async () => {
    let posts = 0;
    const uit = await postMetSleutel(async () => { posts++; return resp(429); }, async () => [], slaap);
    expect(uit.soort).toBe("tijdelijk"); expect(posts).toBe(3);
  });
  it("503 op een POST wordt niet herhaald (onzeker)", async () => {
    let posts = 0;
    const uit = await postMetSleutel(async () => { posts++; return resp(503); }, async () => [], slaap);
    expect(uit.soort).toBe("antwoord"); expect(posts).toBe(1);
  });
});

describe("factuur-planner bij 429 op de sleutelcontrole", () => {
  const src = readFileSync("supabase/functions/factuur-planner/index.ts", "utf8");
  it("gooit een tijdelijke fout en legt de regel vast als 'tijdelijk', nooit 'fout'", () => {
    expect(src).toMatch(/isTijdelijkeStatus\(r\.status\)\) throw new ExactTijdelijkError\(r\.status, "sleutelcontrole"\)/);
    expect(src).toMatch(/if \(e instanceof ExactTijdelijkError\) \{ await zetTijdelijk\(e\.message\); uitgesteld\+\+; continue; \}/);
    const i = src.indexOf("e instanceof ExactTijdelijkError) { await zetTijdelijk");
    const j = src.indexOf('"geblokkeerd" : "fout"', i - 400);
    expect(j).toBeGreaterThan(i); // tijdelijk-tak staat vóór de fout-tak
    expect(new ExactTijdelijkError(429, "sleutelcontrole").message).not.toMatch(/^fout/);
  });
  it("vervangt eerdere 'tijdelijk'-rijen bij een nieuwe claim", () => {
    expect(src).toMatch(/update\(\{ status: "vervangen", vervangen_door: claim\.id \}\)[\s\S]{0,200}\.eq\("status", "tijdelijk"\)/);
  });
});
