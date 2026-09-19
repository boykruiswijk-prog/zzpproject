// Onzichtbaar veld tegen spambots. Niet zichtbaar, niet focusbaar, niet
// voorgelezen door schermlezers — alleen geautomatiseerde invullers vullen het.
import type { FormGuard } from "@/lib/antiSpam";

export function HoneypotField({ guard }: { guard: FormGuard }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
        padding: 0,
        margin: -1,
      }}
    >
      <label htmlFor="website_url">Laat dit veld leeg</label>
      <input id="website_url" type="text" {...guard.honeypotProps} />
    </div>
  );
}
