// Markdown-lite voor Zeker: alleen alinea's, "- "-lijsten en links naar interne paden, tel: of de WhatsApp-link.
export type Inline = { type: "text"; text: string } | { type: "link"; text: string; href: string };
export type Blok = { type: "p"; inhoud: Inline[] } | { type: "ul"; items: Inline[][] };

export function isVeiligeLink(href: string): boolean {
  return /^\/(?!\/)[\w\-/#?=&.%]*$/.test(href) || /^tel:\+?\d+$/.test(href) || href === "https://wa.me/31652064589" || /^mailto:info@zpzaken\.nl$/.test(href);
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push({ type: "text", text: s.slice(i, m.index) });
    out.push(isVeiligeLink(m[2]) ? { type: "link", text: m[1], href: m[2] } : { type: "text", text: m[1] });
    i = m.index + m[0].length;
  }
  if (i < s.length) out.push({ type: "text", text: s.slice(i) });
  return out.map((x) => (x.type === "text" ? { ...x, text: x.text.replace(/\*\*|__/g, "") } : x));
}

export function parseMarkdownLite(tekst: string): Blok[] {
  const blokken: Blok[] = [];
  let para: string[] = [];
  let lijst: Inline[][] | null = null;
  const flushP = () => { if (para.length) { blokken.push({ type: "p", inhoud: parseInline(para.join(" ")) }); para = []; } };
  const flushL = () => { if (lijst) { blokken.push({ type: "ul", items: lijst }); lijst = null; } };
  for (const raw of tekst.split("\n")) {
    const r = raw.trim();
    const li = r.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (li) { flushP(); (lijst ??= []).push(parseInline(li[1])); }
    else if (!r) { flushP(); flushL(); }
    else { flushL(); para.push(r.replace(/^#+\s*/, "")); }
  }
  flushP(); flushL();
  return blokken;
}
