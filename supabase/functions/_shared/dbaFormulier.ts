// Leest de checklist "Aanvullende documentatie" uit de aangevinkte vakjes van het originele
// Word-formulier (word/document.xml), zonder AI. Ondersteunt 2 kolommen (aanwezig / niet aanwezig)
// en 3 kolommen (aanwezig / niet aanwezig / n.v.t.). Eerste vakje = aanwezig.
import { dbaDocSleutel, type DbaChecklistItem } from "./dbaScore.ts";

interface Alinea { delen: Array<{ t: string } | { vak: boolean }> }

function alineas(xml: string): Alinea[] {
  // Binnenste checkbox-SDT's vervangen door een marker.
  let x = xml.replace(/<w:sdt>(?:(?!<w:sdt>)[\s\S])*?<\/w:sdt>/g, (blok) => {
    if (!/w14:checkbox|<w:checkbox/i.test(blok)) return blok;
    const aan = /<w14:checked\s+w14:val="(1|true)"/.test(blok);
    // Houd alineagrenzen binnen het blok.
    const p = (blok.match(/<\/w:p>/g) || []).length;
    return `<vak v="${aan ? 1 : 0}"/>` + "</w:p>".repeat(p);
  });
  // Klassieke formuliervelden.
  x = x.replace(/<w:checkBox>[\s\S]*?<\/w:checkBox>/g, (blok) => {
    const aan = /<w:checked(?:\s+w:val="(1|true)")?\s*\/>/.test(blok) && !/<w:checked\s+w:val="(0|false)"/.test(blok)
      || /<w:default\s+w:val="1"/.test(blok) && !/<w:checked\s+w:val="(0|false)"/.test(blok);
    return `<vak v="${aan ? 1 : 0}"/>`;
  });
  const res: Alinea[] = [];
  let huidig: Alinea = { delen: [] };
  const re = /<vak v="([01])"\/>|<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(x)) !== null) {
    if (m[1] !== undefined) huidig.delen.push({ vak: m[1] === "1" });
    else if (m[2] !== undefined) {
      for (const stuk of m[2].split(/([☒☐])/)) {
        if (stuk === "☒") huidig.delen.push({ vak: true });
        else if (stuk === "☐") huidig.delen.push({ vak: false });
        else if (stuk) huidig.delen.push({ t: stuk });
      }
    } else if (m[0] === "</w:p>") { res.push(huidig); huidig = { delen: [] }; }
  }
  res.push(huidig);
  return res;
}

const ontsnap = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** null = geen checklist met vakjes gevonden. */
export function leesDbaChecklistUitXml(xml: string): DbaChecklistItem[] | null {
  const ps = alineas(xml);
  const start = ps.findIndex((p) => /aanvullende\s+(documentatie|dossier)/i.test(p.delen.map((d) => ("t" in d ? d.t : "")).join("")));
  if (start < 0) return null;
  let kolommen = 2;
  const rijen: Array<{ naam: string; vakken: boolean[] }> = [];
  let rij: { naam: string; vakken: boolean[] } | null = null;
  let kopKolommen = 0;
  for (let i = start + 1; i < ps.length; i++) {
    const tekst = ontsnap(ps[i].delen.map((d) => ("t" in d ? d.t : "")).join("")).replace(/\s+/g, " ").trim();
    if (tekst) {
      const sleutel = dbaDocSleutel(tekst);
      if (sleutel) {
        rij = { naam: tekst, vakken: [] };
        rijen.push(rij);
        // Alleen vakjes na de naam in dezelfde alinea horen bij deze rij.
        let naNaam = false;
        for (const d of ps[i].delen) {
          if ("t" in d) { if (d.t.trim()) naNaam = true; } else if (naNaam) rij.vakken.push(d.vak);
        }
        continue;
      }
      if (rijen.length === 0 && /^(van toepassing|aanwezig|niet|n\.?v\.?t)/i.test(tekst)) {
        kopKolommen += /n\.?v\.?t/i.test(tekst) ? 1 : (/^niet/i.test(tekst) ? 1 : (/aanwezig/i.test(tekst) ? 1 : 0));
      }
      rij = null; // andere tekst (subregels VCA, datum) sluit de rij af
      continue;
    }
    if (rij) for (const d of ps[i].delen) if (!("t" in d)) rij.vakken.push(d.vak);
  }
  if (rijen.length === 0 || rijen.every((r) => r.vakken.length === 0)) return null;
  kolommen = kopKolommen >= 3 ? 3 : 2;
  return rijen.map((r) => {
    const v = r.vakken.slice(0, kolommen);
    let status = "niet_ingevuld";
    if (v[0]) status = "aanwezig";
    else if (v[1]) status = "niet_aanwezig";
    else if (v[2]) status = "niet_van_toepassing";
    return { document_name: r.naam, status, manually_overridden: false };
  });
}

/** Formulierchecklist met handmatige wijzigingen uit de opgeslagen lijst (per documentsoort/naam). */
export function voegHandmatigSamen(formulier: DbaChecklistItem[], opgeslagen: unknown): DbaChecklistItem[] {
  const lijst = Array.isArray(opgeslagen) ? opgeslagen as DbaChecklistItem[] : [];
  const sleutel = (n: string) => dbaDocSleutel(n) ?? n.toLowerCase().replace(/\s+/g, " ").trim();
  const handmatig = new Map<string, DbaChecklistItem>();
  for (const it of lijst) {
    if (it && it.manually_overridden && typeof it.document_name === "string") handmatig.set(sleutel(it.document_name), it);
  }
  const uit = formulier.map((it) => {
    const h = handmatig.get(sleutel(it.document_name));
    if (h) { handmatig.delete(sleutel(it.document_name)); return { ...it, status: h.status, manually_overridden: true }; }
    return it;
  });
  for (const h of handmatig.values()) uit.push({ document_name: h.document_name, status: h.status, manually_overridden: true });
  return uit;
}
