// Live controle F9 aanmeldingen: anon leest niets, schrijft niet direct, en de functie weigert zonder toestemming.
import fs from "node:fs";
import assert from "node:assert/strict";
const config = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter(s => s.includes("=")).map(s => { const i = s.indexOf("="); return [s.slice(0, i), s.slice(i + 1).replace(/^"|"$/g, "")]; }));
const url = config.VITE_SUPABASE_URL, key = config.VITE_SUPABASE_PUBLISHABLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const lees = await fetch(`${url}/rest/v1/aov_aanmeldingen?select=id`, { headers });
assert.ok([401, 403].includes(lees.status), `Anon mag niet lezen (${lees.status})`);
const direct = await fetch(`${url}/rest/v1/aov_aanmeldingen`, { method: "POST", headers, body: JSON.stringify({ naam: "Test", email: "test@zpzaken.nl", toestemming_doorgeven: true, toestemming_tekst: "x".repeat(30), doel: "advies", bron: "test" }) });
assert.ok([401, 403].includes(direct.status), `Anon mag niet direct schrijven (${direct.status})`);
const overzicht = await fetch(`${url}/rest/v1/rpc/aov_aanmeldingen_overzicht`, { method: "POST", headers, body: "{}" });
assert.ok([401, 403, 404].includes(overzicht.status), `Anon mag overzicht niet (${overzicht.status})`);
const zonder = await fetch(`${url}/rest/v1/rpc/aov_aanmelden`, { method: "POST", headers, body: JSON.stringify({ p_naam: "Test", p_email: "test@zpzaken.nl", p_telefoon: "", p_toestemming: false, p_toestemming_tekst: "x", p_doel: "advies", p_bron: "test" }) });
assert.equal(zonder.status, 400, "Zonder toestemming geweigerd"); assert.match(await zonder.text(), /aov_toestemming/);
console.log("4/4 live controles groen; geen rijen toegevoegd.");
