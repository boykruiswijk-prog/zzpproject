import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MedewerkersUitleg, MEDEWERKERS_UITLEG } from "@/components/shared/MedewerkersUitleg";

describe("MedewerkersUitleg", () => {
  it("rendert een knop met het juiste aria-label", () => {
    render(<MedewerkersUitleg />);
    expect(screen.getByRole("button", { name: "Uitleg aantal medewerkers" })).toBeTruthy();
  });
  it("is bereikbaar met het toetsenbord en toont de tekst", async () => {
    render(<MedewerkersUitleg />);
    const knop = screen.getByRole("button", { name: "Uitleg aantal medewerkers" });
    knop.focus();
    expect(document.activeElement).toBe(knop);
    fireEvent.keyDown(knop, { key: "Enter" });
    fireEvent.click(knop);
    expect(await screen.findByText(MEDEWERKERS_UITLEG)).toBeTruthy();
  });
  it("heeft de exacte uitlegtekst", () => {
    expect(MEDEWERKERS_UITLEG).toBe("Heb je een bv? Dan tel je jezelf ook mee. Werk je alleen in je bv, vul dan 1 in. Heb je daarnaast mensen in dienst, tel die erbij op.");
  });
});
