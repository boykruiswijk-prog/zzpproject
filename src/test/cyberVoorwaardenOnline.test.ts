import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CYBER_DOCUMENTEN } from "@/data/cyberDocumenten";
import { CYBER_AKKOORD } from "../../supabase/functions/_shared/cyber";

describe("officiële cyberdocumenten Boy 4-11", () => {
  it("verzekeringskaart is exact Ellens versie", () => {
    const pdf = readFileSync("public/voorwaarden/verzekeringskaart-cyberclear-hiscox-2022.pdf");
    expect(pdf.length).toBe(219293);
    expect(createHash("sha256").update(pdf).digest("hex")).toBe("157c79b423b71469c33cc96512938319af6dcbdc463e185d57b5bea44a29932f");
  });
  it("polisvoorwaarden zijn exact HCC-2022/01 van Ellen", () => {
    const pdf = readFileSync("public/voorwaarden/polisvoorwaarden-cyberclear-hiscox-hcc-2022-01.pdf");
    expect(pdf.length).toBe(1347269);
    expect(createHash("sha256").update(pdf).digest("hex")).toBe("198789f50489780c8b71bea43c4ebaf7e2bd03c4f658d4a1270a04ac2a0cdf56");
  });
  it("registreert uitsluitend de twee eigen gecontroleerde documenten", () => {
    expect(CYBER_DOCUMENTEN.map(d => d.path)).toEqual([
      "/voorwaarden/verzekeringskaart-cyberclear-hiscox-2022.pdf",
      "/voorwaarden/polisvoorwaarden-cyberclear-hiscox-hcc-2022-01.pdf",
    ]);
  });
  it("het akkoord blijft ongewijzigd", () => {
    expect(CYBER_AKKOORD).toBe("Ik begrijp dat cyber dagelijks opzegbaar is en dat ik al betaalde premie voor cyber bij opzeggen niet terugkrijg. Cyber is niet pauzeerbaar. De BAV + AVB blijft dagelijks opzegbaar.");
  });
});