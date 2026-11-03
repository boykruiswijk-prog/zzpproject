import { describe, it, expect } from "vitest";
import { isTestInvoer, isPlaceholderEmail, isPlaceholderTelefoon } from "../../supabase/functions/_shared/testInvoer";

describe("placeholder-testinvoer", () => {
  it("herkent bekende placeholders", () => {
    for (const t of ["0612345678", "06 12345678", "+31612345678", "0600000000", "0123456789"]) expect(isPlaceholderTelefoon(t)).toBe(true);
    for (const e of ["jan@bed.nl", " JAN@bed.nl ", "test@test.nl", "a@example.com", "b@voorbeeld.nl"]) expect(isPlaceholderEmail(e)).toBe(true);
    expect(isTestInvoer({ email: "jan@bed.nl", telefoon: null })).toBe(true);
  });
  it("raakt echte klanten niet", () => {
    for (const t of ["0612345679", "0201234567", "0687654321"]) expect(isPlaceholderTelefoon(t)).toBe(false);
    for (const e of ["jan@bedrijf.nl", "piet@test.com", "info@examples.nl", "test@gmail.com"]) expect(isPlaceholderEmail(e)).toBe(false);
    expect(isTestInvoer({ email: "jan@jansen.nl", telefoon: "0612345670" })).toBe(false);
  });
});
