import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Phone, RotateCcw, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { parseMarkdownLite, type Inline } from "@/lib/zeker/markdownLite";
import { submitPublicForm, useFormGuard } from "@/lib/antiSpam";
import { trackPhone, trackWhatsApp } from "@/lib/tracking";
import { ZEKER_TEKSTEN, type ZekerTaal } from "./zekerTeksten";

type Actie = "terugbelformulier" | "afsluiten" | "offerte" | "bellen" | "whatsapp";
interface Bericht { id?: string | null; rol: "user" | "assistant"; tekst: string; acties?: { acties: Actie[]; sector?: string | null } | null; feedback?: number | null; lokaal?: boolean }

const SESSIE_KEY = "zp_zeker_sessie";
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zeker-chat`;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const fnHeaders = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };

function taalUitPad(p: string): ZekerTaal {
  const m = p.match(/^\/(en|de|fr)(?=\/|$)/);
  return (m?.[1] as ZekerTaal) ?? "nl";
}
function leesSessie(): string | null { try { return sessionStorage.getItem(SESSIE_KEY); } catch { return null; } }
function zetSessie(id: string | null) { try { id ? sessionStorage.setItem(SESSIE_KEY, id) : sessionStorage.removeItem(SESSIE_KEY); } catch { /* noop */ } }

export default function ZekerChatWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const taal = taalUitPad(pathname);
  const T = ZEKER_TEKSTEN[taal];
  const lp = (p: string) => (taal === "nl" || !p.startsWith("/") ? p : `/${taal}${p}`);

  const [sessieId, setSessieId] = useState<string | null>(leesSessie);
  const [berichten, setBerichten] = useState<Bericht[]>([]);
  const [invoer, setInvoer] = useState("");
  const [bezig, setBezig] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lijstRef = useRef<HTMLDivElement>(null);
  const invoerRef = useRef<HTMLTextAreaElement>(null);
  const terugFocus = useRef<HTMLElement | null>(null);

  // Geschiedenis van de server ophalen (alleen sessie-id staat in de browser).
  useEffect(() => {
    if (!sessieId) return;
    fetch(FN_URL, { method: "POST", headers: fnHeaders, body: JSON.stringify({ actie: "geschiedenis", sessieId }) })
      .then((r) => r.json()).then((d) => setBerichten((d?.berichten ?? []) as Bericht[])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { lijstRef.current?.scrollTo({ top: lijstRef.current.scrollHeight }); }, [berichten, bezig, formOpen]);

  // Focus-trap + Esc.
  useEffect(() => {
    if (!open) return;
    terugFocus.current = document.activeElement as HTMLElement;
    setTimeout(() => invoerRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); terugFocus.current?.focus?.(); };
  }, [open, onClose]);

  const verstuur = useCallback(async (tekstIn: string) => {
    const tekst = tekstIn.trim().slice(0, 2000);
    if (!tekst || bezig) return;
    setInvoer("");
    setBezig(true);
    setBerichten((b) => [...b, { rol: "user", tekst }, { rol: "assistant", tekst: "", lokaal: true }]);
    const zetLaatste = (f: (m: Bericht) => Bericht) => setBerichten((b) => { const c = [...b]; c[c.length - 1] = f(c[c.length - 1]); return c; });
    try {
      const res = await fetch(FN_URL, { method: "POST", headers: fnHeaders, body: JSON.stringify({ actie: "bericht", sessieId, tekst, taal, pagina: pathname }) });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        const d = await res.json().catch(() => ({}));
        if (d?.sessieId) { setSessieId(d.sessieId); zetSessie(d.sessieId); }
        zetLaatste((m) => ({ ...m, tekst: d?.tekst || T.fout, acties: { acties: d?.acties ?? ["bellen", "whatsapp"] } }));
        return;
      }
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          if (!chunk.startsWith("data:")) continue;
          let ev: any; try { ev = JSON.parse(chunk.slice(5)); } catch { continue; }
          if (ev.type === "sessie") { setSessieId(ev.id); zetSessie(ev.id); }
          else if (ev.type === "delta") zetLaatste((m) => ({ ...m, tekst: m.tekst + ev.tekst }));
          else if (ev.type === "acties") zetLaatste((m) => ({ ...m, acties: { acties: ev.acties, sector: ev.sector } }));
          else if (ev.type === "klaar") zetLaatste((m) => ({ ...m, id: ev.berichtId, lokaal: false }));
          else if (ev.type === "fout") zetLaatste((m) => ({ ...m, tekst: m.tekst || ev.tekst || T.fout, acties: { acties: ev.acties ?? ["bellen"] } }));
        }
      }
    } catch {
      zetLaatste((m) => ({ ...m, tekst: m.tekst || T.fout, acties: { acties: ["bellen", "whatsapp"] } }));
    } finally {
      setBezig(false);
    }
  }, [bezig, sessieId, taal, pathname, T.fout]);

  const feedback = async (idx: number, waarde: 1 | -1) => {
    const m = berichten[idx];
    if (!m?.id || !sessieId) return;
    const nieuw = m.feedback === waarde ? null : waarde;
    setBerichten((b) => b.map((x, i) => (i === idx ? { ...x, feedback: nieuw } : x)));
    fetch(FN_URL, { method: "POST", headers: fnHeaders, body: JSON.stringify({ actie: "feedback", sessieId, berichtId: m.id, waarde: nieuw }) }).catch(() => {});
  };

  const nieuwGesprek = () => { zetSessie(null); setSessieId(null); setBerichten([]); setFormOpen(false); invoerRef.current?.focus(); };

  const renderInline = (parts: Inline[], key: string) => parts.map((p, i) =>
    p.type === "text" ? <span key={`${key}-${i}`}>{p.text}</span>
      : p.href.startsWith("/") ? <Link key={`${key}-${i}`} to={lp(p.href)} onClick={() => { if (window.innerWidth < 768) onClose(); }} className="font-medium text-primary underline underline-offset-2">{p.text}</Link>
      : <a key={`${key}-${i}`} href={p.href} target={p.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{p.text}</a>);

  const actieKnop = (a: Actie, sector?: string | null) => {
    const cls = "inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground";
    if (a === "terugbelformulier") return <button key={a} type="button" className={cls} onClick={() => setFormOpen(true)}>{T.acties[a]}</button>;
    if (a === "bellen") return <a key={a} href="tel:+31204573077" onClick={() => trackPhone()} className={cls}><Phone className="h-3 w-3" aria-hidden="true" />{T.acties[a]}</a>;
    if (a === "whatsapp") return <a key={a} href="https://wa.me/31652064589" target="_blank" rel="noopener noreferrer" onClick={() => trackWhatsApp()} className={cls}>{T.acties[a]}</a>;
    const to = a === "afsluiten" ? lp("/verzekeringen#combinatiepolis") : lp(`/offerte${sector ? `?sector=${encodeURIComponent(sector)}` : ""}`);
    return <button key={a} type="button" className={cls} onClick={() => { navigate(to); if (window.innerWidth < 768) onClose(); }}>{T.acties[a]}</button>;
  };

  if (!open) return null;

  const leeg = berichten.length === 0;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${T.titel}, ${T.subtitel}`}
      className="fixed inset-0 z-[80] flex flex-col bg-background pb-[env(safe-area-inset-bottom)] md:inset-auto md:bottom-4 md:right-4 md:h-[600px] md:max-h-[calc(100vh-2rem)] md:w-[400px] md:overflow-hidden md:rounded-2xl md:border md:border-border md:pb-0 md:shadow-2xl"
    >
      <header className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15"><MessageCircle className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{T.titel}</p>
          <p className="truncate text-xs opacity-90">{T.subtitel}</p>
        </div>
        <button type="button" onClick={nieuwGesprek} aria-label={T.nieuw} title={T.nieuw} className="rounded-full p-2 hover:bg-primary-foreground/15"><RotateCcw className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" onClick={onClose} aria-label={T.sluiten} className="rounded-full p-2 hover:bg-primary-foreground/15"><X className="h-5 w-5" aria-hidden="true" /></button>
      </header>

      <div ref={lijstRef} className="flex-1 space-y-3 overflow-y-auto bg-secondary/40 px-4 py-4" aria-live="polite">
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">{T.welkom}</div>
        {leeg && (
          <div className="flex flex-wrap gap-2 pt-1">
            {T.suggesties.map((s) => (
              <button key={s} type="button" onClick={() => verstuur(s)} className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-medium text-foreground hover:border-primary hover:text-primary">{s}</button>
            ))}
          </div>
        )}
        {berichten.map((m, idx) => m.rol === "user" ? (
          <div key={idx} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground">{m.tekst}</div>
        ) : (
          <div key={idx} className="max-w-[92%] space-y-2">
            {m.tekst ? (
              <div className="space-y-2 break-words rounded-2xl rounded-tl-sm bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
                {parseMarkdownLite(m.tekst).map((b, bi) => b.type === "p"
                  ? <p key={bi}>{renderInline(b.inhoud, `${idx}-${bi}`)}</p>
                  : <ul key={bi} className="list-disc space-y-1 pl-5">{b.items.map((it, ii) => <li key={ii}>{renderInline(it, `${idx}-${bi}-${ii}`)}</li>)}</ul>)}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 rounded-2xl bg-card px-3.5 py-3 shadow-sm" aria-label={T.typen}>
                {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d * 150}ms` }} />)}
              </div>
            )}
            {m.acties?.acties?.length ? <div className="flex flex-wrap gap-2">{m.acties.acties.map((a) => actieKnop(a, m.acties?.sector))}</div> : null}
            {m.id && !m.lokaal && (
              <div className="flex gap-1">
                <button type="button" onClick={() => feedback(idx, 1)} aria-label={T.nuttig} aria-pressed={m.feedback === 1} className={`rounded p-1 ${m.feedback === 1 ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}><ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /></button>
                <button type="button" onClick={() => feedback(idx, -1)} aria-label={T.nietNuttig} aria-pressed={m.feedback === -1} className={`rounded p-1 ${m.feedback === -1 ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}><ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </div>
            )}
          </div>
        ))}
        {formOpen && <TerugbelFormulier taal={taal} sessieId={sessieId} onKlaar={(ok) => { setFormOpen(false); setBerichten((b) => [...b, { rol: "assistant", tekst: ok ? T.form.bevestiging : T.form.fout, lokaal: true, acties: ok ? null : { acties: ["bellen"] } }]); }} onAnnuleer={() => setFormOpen(false)} />}
      </div>

      <div className="border-t border-border bg-background px-3 pb-3 pt-2">
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
          {T.disclaimer} <Link to={lp("/cookies#chat-assistent")} className="underline underline-offset-2 hover:text-foreground">{T.disclaimerLink}</Link>
        </p>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); verstuur(invoer); }}>
          <label htmlFor="zeker-invoer" className="sr-only">{T.placeholder}</label>
          <textarea
            id="zeker-invoer" ref={invoerRef} rows={1} maxLength={2000} value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); verstuur(invoer); } }}
            placeholder={T.placeholder}
            className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" disabled={bezig || !invoer.trim()} aria-label={T.versturen} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  );
}

function TerugbelFormulier({ taal, sessieId, onKlaar, onAnnuleer }: { taal: ZekerTaal; sessieId: string | null; onKlaar: (ok: boolean) => void; onAnnuleer: () => void }) {
  const F = ZEKER_TEKSTEN[taal].form;
  const guard = useFormGuard();
  const [v, setV] = useState({ naam: "", telefoon: "", email: "", moment: F.momenten[0], vraag: "", toestemming: false });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const veld = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    if (!sessieId) { setFout(F.fout); return; }
    const delen = v.naam.trim().split(/\s+/);
    const voornaam = delen.shift() ?? "";
    const achternaam = delen.join(" ") || "-";
    setBezig(true);
    try {
      await submitPublicForm("leads", {
        type: "contact", voornaam, achternaam, telefoon: v.telefoon.trim(), email: v.email.trim(), opmerkingen: v.vraag.trim(),
        extra_data: { bron: "chat-zeker", chat_sessie_id: sessieId, voorkeursmoment: v.moment, toestemming: v.toestemming },
      }, guard);
      onKlaar(true);
    } catch (err) {
      setFout(err instanceof Error ? err.message : F.fout);
    } finally { setBezig(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-sm" aria-label={F.titel}>
      <p className="text-sm font-semibold">{F.titel}</p>
      <input {...guard.honeypotProps} className="hidden" />
      <label className="block text-xs font-medium">{F.naam}<input required maxLength={100} autoComplete="name" className={veld} value={v.naam} onChange={(e) => setV({ ...v, naam: e.target.value })} /></label>
      <label className="block text-xs font-medium">{F.telefoon}<input required type="tel" inputMode="tel" maxLength={20} pattern="[+0-9 ()-]{10,20}" autoComplete="tel" className={veld} value={v.telefoon} onChange={(e) => setV({ ...v, telefoon: e.target.value })} /></label>
      <label className="block text-xs font-medium">{F.email}<input type="email" maxLength={150} autoComplete="email" className={veld} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
      <label className="block text-xs font-medium">{F.moment}
        <select className={veld} value={v.moment} onChange={(e) => setV({ ...v, moment: e.target.value })}>{F.momenten.map((m) => <option key={m}>{m}</option>)}</select>
      </label>
      <label className="block text-xs font-medium">{F.vraag}<textarea rows={2} maxLength={500} className={veld} value={v.vraag} onChange={(e) => setV({ ...v, vraag: e.target.value })} /></label>
      <label className="flex items-start gap-2 text-xs leading-snug">
        <input type="checkbox" required checked={v.toestemming} onChange={(e) => setV({ ...v, toestemming: e.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
        <span>{F.toestemming}</span>
      </label>
      {fout && <p role="alert" className="text-xs text-destructive">{fout}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={bezig || !v.toestemming} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{F.versturen}</button>
        <button type="button" onClick={onAnnuleer} className="rounded-lg border border-border px-3 py-2 text-sm">{F.annuleren}</button>
      </div>
    </form>
  );
}
