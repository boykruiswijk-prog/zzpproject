// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lijktCircle8, toonCircle8Knop } from "@/lib/circle8";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { Circle8Knop } from "@/components/admin/Circle8Knop";

describe("lijktCircle8", () => {
  it("herkent ZPCIR-nummers", () => expect(lijktCircle8({ polisnummer: "ZPCIR4000" })).toBe(true));
  it("herkent Circle8 in de toelichting", () =>
    expect(lijktCircle8({ polisnummer: "", details: { toelichting: "opdracht via Circle8 beëindigd" } })).toBe(true));
  it("herkent varianten in de bedrijfsnaam", () => {
    expect(lijktCircle8({ details: { bedrijfsnaam: "Circle 8 B.V." } })).toBe(true);
    expect(lijktCircle8({ details: { bedrijfsnaam: "circl8" } })).toBe(true);
  });
  it("geeft false bij een gewone opzegging", () =>
    expect(lijktCircle8({ polisnummer: "ZPBAV5094", details: { toelichting: "test niets" } })).toBe(false));
});

describe("Circle8-knop", () => {
  const wrap = (ui: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

  it("verschijnt niet bij een verwerkte opzegging", () => {
    const a = { id: "1", type: "opzeggen", polisnummer: "ZPCIR4000", opzegging_verwerkt_op: "2026-10-13T10:00:00Z", koppeling_status: "niet_gekoppeld" };
    expect(toonCircle8Knop(a)).toBe(false);
    expect(wrap(<Circle8Knop aanvraag={a} />)).not.toMatch(/circle8/i);
  });

  it("verschijnt niet bij een zeker gekoppelde opzegging", () =>
    expect(toonCircle8Knop({ type: "opzeggen", koppeling_status: "zeker", onderneming_id: "o1" })).toBe(false));

  it("toont 'Lijkt Circle8' bij een herkende niet-verwerkte opzegging", () => {
    expect(wrap(<Circle8Knop aanvraag={{ id: "2", type: "opzeggen", polisnummer: "ZPCIR4000", koppeling_status: "niet_gekoppeld" }} />)).toContain("Lijkt Circle8");
  });
});
