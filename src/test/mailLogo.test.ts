import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { metMailKop, MAIL_LOGO_URL } from "../../supabase/functions/_shared/mailLayout";
import { createMailGate } from "../../supabase/functions/_shared/mail";

const FN = join(__dirname, "../../supabase/functions");
const LOGO_TAG = `src="${MAIL_LOGO_URL}" alt="ZP Zaken" height="40"`;

describe("gedeelde mailkop met logo", () => {
  it("zet het logo bovenaan en laat de inhoud ongewijzigd", () => {
    const html = "<p>Hallo Ellen</p>";
    const uit = metMailKop(html);
    expect(uit).toContain(LOGO_TAG);
    expect(uit.endsWith(html)).toBe(true);
  });
  it("plaatst het logo direct na <body> en voegt het nooit dubbel toe", () => {
    const uit = metMailKop("<html><body style=\"x\"><p>a</p></body></html>");
    expect(uit).toMatch(/<body style="x"><div[^>]*><img src="https:\/\/zpzaken\.nl\/logo\.png"/);
    expect(metMailKop(uit)).toBe(uit);
  });
  it("elke mail via de verzendstap bevat het logo (productie en preview)", () => {
    const gate = createMailGate("test", new Request("https://zpzaken.nl/x", { headers: { origin: "https://zpzaken.nl" } }));
    expect(gate.plan({ to: "a@b.nl", subject: "s", html: "<p>x</p>" }).html).toContain(LOGO_TAG);
    const preview = createMailGate("test", new Request("http://localhost/x", { headers: { origin: "http://localhost:8080" } }));
    expect(preview.plan({ to: "a@b.nl", subject: "s", html: "<p>x</p>" }).html).toContain(LOGO_TAG);
  });
});

describe("elke mailtemplate en verzender toont het logo", () => {
  it("alle auth-mailtemplates bevatten het logo", () => {
    const dir = join(FN, "_shared/email-templates");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
      const s = readFileSync(join(dir, f), "utf8");
      expect(s, f).toContain(`src="${MAIL_LOGO_URL}"`);
      expect(s, f).toContain('alt="ZP Zaken"');
    }
  });
  it("elke Resend-verzender stuurt plan.html (gate met logo) of gebruikt metMailKop", () => {
    const bestanden: string[] = [];
    const loop = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) loop(p);
        else if (p.endsWith(".ts") && !p.endsWith("_test.ts")) bestanden.push(p);
      }
    };
    loop(FN);
    const verzenders = bestanden.filter((p) => {
      const s = readFileSync(p, "utf8");
      return /api\.resend\.com\/emails"|resend\.emails\.send/.test(s);
    });
    expect(verzenders.length).toBeGreaterThan(15);
    for (const p of verzenders) {
      const s = readFileSync(p, "utf8");
      const ok = s.includes("metMailKop(") || (s.includes("createMailGate") || s.includes(".plan(")) && s.includes("plan.html");
      expect(ok, p).toBe(true);
    }
  });
});
