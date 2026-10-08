import { describe, it, expect } from "vitest";
import { kiesBeeld } from "../../supabase/functions/artikel-afbeelding/kiesBeeld";

class Weigering extends Error {}
const structureel = (e: unknown) => e instanceof Weigering;

describe("kiesBeeld (artikelafbeelding)", () => {
  it("valt direct terug bij een gesimuleerde weigering, zonder tweede poging", async () => {
    let calls = 0;
    const r = await kiesBeeld(async () => { calls++; throw new Weigering("Visuele controle geweigerd"); }, async () => ({ accepted: true, reason: "" }), structureel);
    expect(r.image).toBeUndefined();
    expect(r.structureel).toBe(true);
    expect(calls).toBe(1);
  });
  it("maximaal 2 pogingen bij afkeuring, dan terugval", async () => {
    let calls = 0;
    const r = await kiesBeeld(async () => { calls++; return "x"; }, async () => ({ accepted: false, reason: "tekst zichtbaar" }), structureel);
    expect(calls).toBe(2);
    expect(r.image).toBeUndefined();
    expect(r.structureel).toBe(false);
  });
  it("tijdelijke fout telt als poging en eindigt in terugval", async () => {
    const r = await kiesBeeld(async () => { throw new Error("time-out"); }, async () => ({ accepted: true, reason: "" }), structureel);
    expect(r.attempts).toBe(2);
    expect(r.image).toBeUndefined();
  });
  it("zonder sleutel: terugval", async () => {
    const r = await kiesBeeld(null, async () => ({ accepted: true, reason: "" }), structureel);
    expect(r.image).toBeUndefined();
  });
});
