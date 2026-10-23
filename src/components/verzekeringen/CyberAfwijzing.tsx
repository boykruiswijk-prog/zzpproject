import { cyberAfwijsRedenen, CYBER_LATER_TEKST } from "@/lib/cyberAfwijzing";
export function CyberAfwijzing({ antwoorden }: { antwoorden: unknown }) {
  const redenen = cyberAfwijsRedenen(antwoorden);
  if (!redenen.length) return null;
  return <div role="status" className="space-y-3 border-l-4 border-destructive bg-destructive/5 p-4 text-sm">
    <h4 className="font-semibold">Cyber kan met deze antwoorden niet worden toegevoegd</h4>
    <ul className="list-disc space-y-2 pl-5">{redenen.map((r) => <li key={r.id}>{r.tekst}</li>)}</ul>
    <p>Heb je je vergist? Je kunt je antwoorden hierboven aanpassen.</p>
    <p>{CYBER_LATER_TEKST}</p>
  </div>;
}