// @vitest-environment node
// Search Console-verificatie (Boy 2-11-2026): bestand moet letterlijk en zonder redirect bereikbaar zijn.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { legacyRedirects } from "@/config/legacyRedirects";

const NAAM = "googlede44f7e9b27c2920.html";
const PAD = `/${NAAM}`;

describe("Google Search Console-verificatiebestand", () => {
  it("staat in public met exact de opgegeven inhoud, zonder HTML of witregel", () => {
    expect(readFileSync(`public/${NAAM}`, "utf8")).toBe(`google-site-verification: ${NAAM}`);
  });

  it("wordt door geen enkele regel in _redirects geraakt, behalve de niet-geforceerde SPA-fallback", () => {
    const regels = readFileSync("public/_redirects", "utf8").split("\n")
      .map((r) => r.trim()).filter((r) => r && !r.startsWith("#"));
    const raakt = regels.filter((r) => {
      const [van] = r.split(/\s+/);
      const re = new RegExp("^" + van.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/:[a-z]+/gi, "[^/]+") + "$");
      return re.test(PAD);
    });
    expect(raakt).toEqual(["/*    /index.html    200"]);
  });

  it("staat niet in de legacy-redirects of de src/assets-regel", () => {
    expect(legacyRedirects.some((r) => r.from.replace(/\/$/, "") === NAAM || r.from === "*")).toBe(false);
    expect(PAD.startsWith("/src/assets/")).toBe(false);
  });
});
