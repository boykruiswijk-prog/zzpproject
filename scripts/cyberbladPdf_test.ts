import { renderLokaalCyber, FICTIEF_CYBER } from "./cyberCertificaatPreview.ts";
import { renderLokaalCertificaat } from "./certificaatPreview.ts";

async function pdfTekst(bytes: Uint8Array) {
  const command = new Deno.Command("pdftotext", { args: ["-", "-"], stdin: "piped", stdout: "piped" }).spawn();
  const writer = command.stdin.getWriter(); await writer.write(bytes); await writer.close();
  const output = await command.output();
  if (!output.success) throw new Error("PDF extraction failed");
  return new TextDecoder().decode(output.stdout).replace(/\s+/g, " ");
}
for (const type of ["cyber", "bav"] as const) {
  for (const cyclus of ["maand", "jaar"] as const) {
    Deno.test(`CYBERBLAD echte PDF tekst ${type} ${cyclus}`, async () => {
      const r = type === "cyber"
        ? await renderLokaalCyber({ ...FICTIEF_CYBER, certificaathouder: "Faasen Coaching", cyber_certificaatnummer: "ZPCYB0001", betaalcyclus: cyclus })
        : await renderLokaalCertificaat(true, { gekozen_pakket: cyclus === "jaar" ? "jaarlijks_cyber" : "maandelijks_cyber" });
      const tekst = await pdfTekst(r.pdfBytes);
      for (const waarde of [cyclus === "jaar" ? "EUR 250 per jaar" : "EUR 27,50 per maand", "EUR 50.000 per schade", "EUR 500 per schade, bij cyberfraude EUR 1.000", "eerste 72 uur tot EUR 15.000, zonder eigen risico.", "Al betaalde premie voor cyber krijg je bij opzeggen niet terug. Cyber is niet pauzeerbaar."]) {
        if (!tekst.includes(waarde)) throw new Error(`Missing ${waarde}`);
      }
      if (/Cyber[: ]+(?:is )?dagelijks opzegbaar/i.test(tekst)) throw new Error("Forbidden certificate cancellation text");
      if (type === "cyber" && !tekst.includes("ZPCYB0001")) throw new Error("Missing cyber number");
    });
  }
}