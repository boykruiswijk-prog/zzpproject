// Interne paginabron staat los van utm-velden en klik-ID's.
export function saneerInterneBron(waarde: unknown): "evi-pagina" | null {
  return waarde === "evi-pagina" ? "evi-pagina" : null;
}