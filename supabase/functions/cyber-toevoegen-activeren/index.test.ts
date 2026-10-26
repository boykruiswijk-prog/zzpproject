import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cyberToevoegSpec, cyberToevoegMailData } from "../_shared/cyberToevoegenActivatie.ts";
import { beoordelingGeldig, cyberDocumentControle } from "../_shared/cyberBeoordeling.ts";
Deno.test("Pieter: lege beoordeling faalt voor writes; Telefonisch contact is geldig", () => {
  const body = { id: "d6a43c5f-8cff-4be8-9844-b5b696892c26", akkoord: true, notitie: "" };
  assertEquals(beoordelingGeldig(body), false);
  assertEquals(beoordelingGeldig({ ...body, notitie: "Telefonisch contact" }), true);
});
Deno.test("Certificaat transportfout blijft wachtend, geen activatiefout", async () => {
  assertEquals((await cyberDocumentControle(() => Promise.reject(new Error("offline")))).ok, false);
  assertEquals((await cyberDocumentControle(async () => new Response("gateway error", { status: 502 }))).ok, false);
  assertEquals((await cyberDocumentControle(async () => new Response(JSON.stringify({ success: true })))).ok, true);
});
Deno.test("cyber jaar onafhankelijk: 250 en eigen twaalf maanden", () => {
  const r = cyberToevoegSpec("2026-11-03", "jaar");
  assertEquals(r.bedrag_per_periode, 250);
  assertEquals(r.periode_start, "2026-11-03");
  assertEquals(r.periode_eind, "2027-11-02");
  assertEquals(cyberToevoegSpec("2026-11-03", "jaar", 1).periode_start, "2027-11-03");
});
Deno.test("cyber maand onafhankelijk: 27.50 en twaalf maanden looptijd", () => {
  const r = cyberToevoegSpec("2026-11-03", "maand");
  assertEquals(r.bedrag_per_periode, 27.50);
  assertEquals(r.periode_eind, "2026-12-02");
  assertEquals(r.cyber_einddatum, "2027-11-02");
});
Deno.test("jaar en maand mailgegevens sluiten aan op betaalwijze", () => {
  assertEquals(cyberToevoegMailData("Test", "2026-11-03", "jaar").cyber_incasso, "jaarlijks vooraf");
  assertEquals(cyberToevoegMailData("Test", "2026-11-03", "maand").cyber_incasso, "maandelijks");
});