// Live-controle Zeker (D-aanvulling Cyber upsell). Gebruik: bun scripts/zekerCyberEval.ts (vereist ANTHROPIC_API_KEY). Geen database, geen mails.
import { bouwSysteemPrompt, ZEKER_STANDAARD_MODEL } from "../supabase/functions/_shared/zeker";
import { ZEKER_CYBER_VRAGEN } from "../src/test/zekerCyberLater.test";

const verboden = /advies|adviseur|bemiddelaar|tussenperso/i;
const nlWoorden = /\b(je|kun|kunt|het|een|niet|jouw|wij|ons)\b/gi;
let fout = 0;
for (const v of ZEKER_CYBER_VRAGEN) {
  // EN-vraag na een eerder Nederlands gesprek: taal moet de laatste vraag volgen.
  const messages = v.taal === "en"
    ? [{ role: "user", content: "Wat kost de BAV + AVB?" }, { role: "assistant", content: "De BAV + AVB kost € 55 per maand of € 600 per jaar." }, { role: "user", content: v.vraag }]
    : [{ role: "user", content: v.vraag }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ZEKER_MODEL || ZEKER_STANDAARD_MODEL, max_tokens: 600, system: bouwSysteemPrompt({ taal: "nl", artikelen: [] }), messages }),
  });
  const j: any = await r.json();
  const tekst = (j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  const missers = v.kern.filter((re) => !re.test(tekst)).map(String);
  if (verboden.test(tekst)) missers.push("verboden woord");
  if (/geen zekere informatie|not sure|no certain/i.test(tekst)) missers.push("onzeker antwoord");
  if (v.taal === "en" && (tekst.match(nlWoorden) ?? []).length > 2) missers.push("niet Engels");
  console.log(`\n[${missers.length ? "FOUT" : "OK"}] ${v.vraag}\n${tekst || JSON.stringify(j).slice(0, 300)}${missers.length ? `\nMist: ${missers.join(", ")}` : ""}`);
  if (missers.length) fout++;
}
process.exit(fout ? 1 : 0);
