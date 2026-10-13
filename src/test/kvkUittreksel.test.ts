// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { controleerUittreksel, uittrekselVerplicht, UITTREKSEL_MAX_BYTES } from "@/lib/kvkUittreksel";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

describe("uploadveld KVK-uittreksel", () => {
  it("alleen bij starter en API niet operationeel", () => {
    expect(uittrekselVerplicht(true, false)).toBe(true);
    expect(uittrekselVerplicht(true, null)).toBe(true);
    expect(uittrekselVerplicht(true, true)).toBe(false);
    expect(uittrekselVerplicht(false, false)).toBe(false);
  });
  it("accepteert echte pdf, png en jpg", () => {
    expect(controleerUittreksel("u.pdf", 1000, PDF)).toEqual({ ok: true, mime: "application/pdf" });
    expect(controleerUittreksel("u.PNG", 1000, PNG)).toEqual({ ok: true, mime: "image/png" });
    expect(controleerUittreksel("u.jpeg", 1000, JPG)).toEqual({ ok: true, mime: "image/jpeg" });
  });
  it("weigert verkeerd type, vervalste extensie en te groot", () => {
    expect(controleerUittreksel("u.docx", 1000, PDF).ok).toBe(false);
    expect(controleerUittreksel("u.pdf", 1000, EXE).ok).toBe(false);
    expect(controleerUittreksel("u.png", 1000, PDF).ok).toBe(false);
    expect(controleerUittreksel("u.pdf", UITTREKSEL_MAX_BYTES + 1, PDF).ok).toBe(false);
    expect(controleerUittreksel("u.pdf", 0, PDF).ok).toBe(false);
  });
});

describe("server en opslag", () => {
  const wiz = readFileSync("supabase/functions/process-bav-wizard/index.ts", "utf8");
  it("server weigert starter zonder uittreksel als de API niet operationeel is", () => {
    expect(wiz).toMatch(/klantClaimtStarter && !\(await kvkApiOperationeel\(supabase\)\)/);
    expect(wiz).toContain('weiger(400, UITTREKSEL_VERPLICHT, "kvk_uittreksel"');
    expect(wiz.indexOf('"kvk_uittreksel", { field')).toBeLessThan(wiz.indexOf("BEWIJSRECORD SEPA"));
  });
  it("upload: uuid-bestandsnaam, nooit overschrijven, status-check geeft geen sleutel", () => {
    const up = readFileSync("supabase/functions/kvk-uittreksel-upload/index.ts", "utf8");
    expect(up).toContain("crypto.randomUUID()");
    expect(up).toContain("upsert: false");
    expect(readFileSync("supabase/functions/kvk-api-status/index.ts", "utf8")).toContain("JSON.stringify({ operationeel })");
  });
  it("bucket alleen leesbaar voor team, geen schrijfpolicy", () => {
    const sql = readFileSync("drizzle/migrations/0125_kvk_uittreksel_starter.sql", "utf8");
    expect(sql).toContain("ON storage.objects FOR SELECT TO authenticated");
    expect(sql).not.toMatch(/storage\.objects FOR (INSERT|UPDATE|DELETE|ALL)/);
    expect(sql).not.toMatch(/TO anon/);
  });
});
