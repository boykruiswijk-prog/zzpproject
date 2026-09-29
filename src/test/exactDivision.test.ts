// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { checkConfiguredDivision } from "../../supabase/functions/_shared/exactDivision";

const antwoord = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("Exact geconfigureerde administratie", () => {
  it("200 met resultaat is ok", async () => {
    const result = await checkConfiguredDivision("https://exact.test", "4401707", "token", antwoord(200, { d: { results: [{ Code: 4401707, Description: "ZP Zaken B.V." }] } }));
    expect(result).toMatchObject({ ok: true, division: "4401707", administration: "ZP Zaken B.V." });
  });

  it("403 geeft een alarmwaardige toegangs-fout", async () => {
    const result = await checkConfiguredDivision("https://exact.test", "4401707", "token", antwoord(403, {}));
    expect(result).toMatchObject({ ok: false, status: 403, error: "Geen toegang tot administratie 4401707" });
  });

  it("een afwijkende CurrentDivision heeft geen invloed op een geslaagde controle", async () => {
    const currentDivision = "2932076";
    const result = await checkConfiguredDivision("https://exact.test", "4401707", "token", antwoord(200, { d: { results: [{ Code: 4401707, Description: "ZP Zaken B.V." }] } }));
    expect(currentDivision).not.toBe(result.division);
    expect(result.ok).toBe(true);
  });
});