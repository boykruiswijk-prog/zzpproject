// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { cyberAkkoordSql } from "../../scripts/cyberAkkoordSql";
import { CYBER_AKKOORD } from "../../supabase/functions/_shared/cyber";
import { CYBER_GEBIED_PUBLIEK } from "../config/cyberPubliek";

describe("A16 cyber evidence and counting rules", () => {
  it("new trigger text equals the authoritative customer consent", () => {
    const migration = readdirSync("drizzle/migrations").find(p => p.includes("cyber_akkoord_2610_e6_behouden"));
    if (!migration) throw new Error("Migration missing");
    expect(readFileSync(`drizzle/migrations/${migration}`, "utf8")).toContain(cyberAkkoordSql());
    expect(cyberAkkoordSql()).toContain(CYBER_AKKOORD);
  });
  it("linked test leads are excluded from the signup branch", () => {
    const migration = readdirSync("drizzle/migrations").find(p => p.includes("a16_cyber_bewijs_telling"));
    if (!migration) throw new Error("Migration missing");
    expect(readFileSync(`drizzle/migrations/${migration}`, "utf8")).toContain("NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = b.lead_id AND coalesce(l.is_test,false))");
  });
  it("public cyber territory remains Europe", () => {
    expect(CYBER_GEBIED_PUBLIEK).toBe("Cyberdekkingsgebied: Europa.");
  });
});

describe("Lovable host directives without production changes", () => {
  const html = readFileSync("index.html", "utf8");
  const script = html.match(/<script>\s*(\(function \(\) \{\s*var h = location.hostname[\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error("Host guard missing");
  it.each(["zzpproject.lovable.app", "id-preview--example.lovable.app", "zpzaken.nl", "www.zpzaken.nl", "localhost", "lovable.app.evil.test"])("%s only gets Lovable directives when appropriate", host => {
    const meta = { content: "index, follow", getAttribute() { return this.content; }, setAttribute(_key: string, value: string) { this.content = value; } };
    const canonical = { href: "https://zpzaken.nl/verzekeringen", getAttribute() { return this.href; }, setAttribute(_key: string, value: string) { this.href = value; } };
    vm.runInNewContext(script, {
      location: { hostname: host, pathname: "/verzekeringen/" },
      document: { querySelectorAll: () => [meta], querySelector: () => canonical, addEventListener() {}, head: {} },
      MutationObserver: class { observe() {} },
    });
    expect(meta.content).toBe(host.endsWith(".lovable.app") ? "noindex, follow" : "index, follow");
    expect(canonical.href).toBe("https://zpzaken.nl/verzekeringen");
  });
});