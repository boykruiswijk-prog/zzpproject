const BUNDEL_VOORWAARDEN = [
  ["Bundelprijs", "[prijs volgt]"],
  ["Voordeel voor ZP Zaken-klanten bij Evi", "[voorwaarden volgen]"],
  ["Voorwaarden bundel", "[voorwaarden volgen]"],
] as const;
export function BundelVoorwaarden() {
  return <div className="grid gap-4 md:grid-cols-3">{BUNDEL_VOORWAARDEN.map(([label, waarde]) => <div key={label} className="border-2 border-dashed border-accent/50 rounded-md p-5"><p className="text-sm font-semibold">{label}:</p><p className="mt-2 text-accent font-medium">{waarde}</p></div>)}</div>;
}
