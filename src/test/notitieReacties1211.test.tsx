import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { bouwDraden, filterDraden, heeftNieuweReactie, isSysteemNaam, wortelId, zichtbareReacties } from "@/lib/notitieDraad";
import { ReactieInvoer, ReactieLijst } from "@/components/admin/NotitieReacties";

const n = (id: string, datum: string, parent_id: string | null = null, auteur_id = "ellen", systeem = false) => ({ id, datum, parent_id, auteur_id, systeem });

describe("reacties op notities", () => {
  it("reactie op reactie hangt aan dezelfde hoofdnotitie (één niveau)", () => {
    const rijen = [n("a", "2026-11-10T10:00:00Z"), n("r1", "2026-11-10T11:00:00Z", "a"), n("r2", "2026-11-10T12:00:00Z", "r1")];
    expect(wortelId("r2", new Map(rijen.map((r) => [r.id, r])))).toBe("a");
    const d = bouwDraden(rijen);
    expect(d).toHaveLength(1);
    expect(d[0].reacties.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
  it("hoofdnotitie met nieuwe reactie springt naar boven", () => {
    const d = bouwDraden([n("oud", "2026-11-01T10:00:00Z"), n("nieuw", "2026-11-11T10:00:00Z"), n("r", "2026-11-12T09:00:00Z", "oud")]);
    expect(d.map((x) => x.hoofd.id)).toEqual(["oud", "nieuw"]);
    expect(d[0].laatsteActiviteit).toBe("2026-11-12T09:00:00Z");
  });
  it("label nieuwe reactie alleen van een ander teamlid en jonger dan 24 uur", () => {
    const nu = new Date("2026-11-12T12:00:00Z");
    const [d] = bouwDraden([n("a", "2026-11-10T10:00:00Z"), n("r", "2026-11-12T09:00:00Z", "a", "boy")]);
    expect(heeftNieuweReactie(d, "ellen", nu)).toBe(true);
    expect(heeftNieuweReactie(d, "boy", nu)).toBe(false);
    expect(heeftNieuweReactie(d, "ellen", new Date("2026-11-13T10:00:00Z"))).toBe(false);
  });
  it("filter Alleen handgeschreven verbergt systeemnotities, Alles toont alles", () => {
    const d = bouwDraden([n("hand", "2026-11-10T10:00:00Z"), n("sys", "2026-11-11T10:00:00Z", null, "x", true)]);
    expect(filterDraden(d, "alles")).toHaveLength(2);
    expect(filterDraden(d, "handgeschreven").map((x) => x.hoofd.id)).toEqual(["hand"]);
    expect(isSysteemNaam("Systeem (reviewverzoek)")).toBe(true);
    expect(isSysteemNaam("automatisch")).toBe(true);
    expect(isSysteemNaam("Ellen Baars")).toBe(false);
  });
  it("meer dan 2 reacties zijn ingeklapt", () => {
    expect(zichtbareReacties([1, 2], false)).toEqual([1, 2]);
    expect(zichtbareReacties([1, 2, 3], false)).toEqual([]);
    render(<ReactieLijst reacties={["x", "y", "z"]} render={(r) => <p key={r}>{r}</p>} />);
    fireEvent.click(screen.getByText("3 reacties tonen"));
    expect(screen.getByText("z")).toBeTruthy();
  });
  it("reactie aanmaken met Enter", async () => {
    const plaats = vi.fn().mockResolvedValue(true);
    render(<ReactieInvoer onPlaatsen={plaats} />);
    fireEvent.click(screen.getByText("Reageren"));
    const veld = screen.getByLabelText("Reactie");
    fireEvent.change(veld, { target: { value: "Gebeld, klant belt terug" } });
    fireEvent.keyDown(veld, { key: "Enter" });
    await waitFor(() => expect(plaats).toHaveBeenCalledWith("Gebeld, klant belt terug"));
  });
  it("database: intrekken met reden, reacties niet verwijderbaar, één niveau", () => {
    const sql = readFileSync("drizzle/migrations/0270_notitie_reacties_1211.sql", "utf8");
    expect(sql).toContain("NEW.parent_id := w.id");
    expect(sql).toContain("reacties worden niet verwijderd");
    expect(sql).toMatch(/length\(btrim\(coalesce\(_reden,''\)\)\) < 3/);
    expect(sql).not.toMatch(/GRANT EXECUTE[^;]*TO anon/);
  });
});
