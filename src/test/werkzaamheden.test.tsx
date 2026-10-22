// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { WerkzaamhedenVeld } from "@/components/shared/WerkzaamhedenVeld";
import { werkzaamhedenFout, kortKoppelingTekst } from "../../supabase/functions/_shared/werkzaamheden";

function Form() {
  const [value, setValue] = useState("");
  return <form onSubmit={e => { e.preventDefault(); if (!werkzaamhedenFout(value)) verzend(value); }}>
    <label htmlFor="werk">Omschrijving werkzaamheden</label><WerkzaamhedenVeld id="werk" value={value} onChange={setValue} /><button type="submit">Versturen</button>
  </form>;
}
const verzend = vi.fn();
describe("werkzaamheden maximaal 1.000 tekens", () => {
  it.each([50, 999, 1000])("accepteert en bewaart alle %i tekens", n => {
    const text = "a".repeat(n);
    expect(werkzaamhedenFout(text)).toBeNull();
    render(<Form />); fireEvent.change(screen.getByLabelText("Omschrijving werkzaamheden"), { target: { value: text } });
    fireEvent.click(screen.getByText("Versturen")); expect(verzend).toHaveBeenLastCalledWith(text);
  });
  it("weigert 1.500 tekens vóór versturen met duidelijke uitleg", () => {
    verzend.mockClear(); render(<Form />);
    fireEvent.change(screen.getByLabelText("Omschrijving werkzaamheden"), { target: { value: "a".repeat(1500) } });
    expect(screen.getByRole("alert").textContent).toContain("maximaal 1.000 tekens");
    fireEvent.click(screen.getByText("Versturen")); expect(verzend).not.toHaveBeenCalled();
  });
  it("kort alleen een beperkte koppeling in met drie puntjes", () => {
    expect(kortKoppelingTekst("a".repeat(1000), 60)).toBe("a".repeat(57) + "...");
    expect(kortKoppelingTekst("a".repeat(50), 60)).toBe("a".repeat(50));
  });
});