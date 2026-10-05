import { openTerugbelKlik } from "@/components/shared/TerugbelDialog";
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { MessageCircle, Phone, Zap } from "lucide-react";
import { zekerVerborgenOp, zetZekerOpen } from "@/components/zeker/zekerStore";
import { SITE_CONFIG } from "@/config/site";
import { getPakket } from "@/data/bavPakketten";
import { AANVRAAG_ID, scrollNaarAanvraag } from "@/lib/scrollNaarAanvraag";

const HIDDEN_PATHS = ["/contact"];
const AANVRAAG_PATHS = ["/", "/verzekeringen"];

function WhatsAppIcoon() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M16.004 0h-.008C7.174 0 .002 7.174.002 16c0 3.5 1.13 6.744 3.05 9.376L1.05 31.36l6.196-1.98a15.91 15.91 0 0 0 8.758 2.62C24.83 32 32 24.826 32 16S24.83 0 16.004 0zm9.31 22.59c-.386 1.09-1.916 1.992-3.137 2.252-.836.178-1.928.32-5.604-1.204-4.7-1.946-7.726-6.722-7.962-7.032-.226-.31-1.9-2.526-1.9-4.82s1.168-3.412 1.638-3.892c.386-.394.84-.574 1.124-.574.34 0 .638.005.898.018.288.014.722-.11 1.13.866.42 1.004 1.426 3.464 1.55 3.714.124.252.206.546.04.876-.166.33-.248.534-.494.822-.246.288-.518.642-.74.864-.246.246-.502.512-.218 1.006.286.494 1.262 2.078 2.704 3.366 1.858 1.658 3.418 2.18 3.92 2.43.502.246.794.206 1.082-.124.288-.33 1.246-1.452 1.578-1.95.33-.494.66-.412 1.112-.246.452.166 2.87 1.354 3.366 1.6.494.246.824.372.948.578.124.206.124 1.18-.262 2.272z" />
    </svg>
  );
}

/** True zolang het aanvraagformulier (deels) in beeld is. */
function useAanvraagInBeeld(actief: boolean) {
  const [inBeeld, setInBeeld] = useState(false);
  useEffect(() => {
    if (!actief || typeof IntersectionObserver === "undefined") { setInBeeld(false); return; }
    let huidig: Element | null = null;
    const io = new IntersectionObserver((entries) => setInBeeld(entries.some((e) => e.isIntersecting)), { threshold: 0, rootMargin: "0px 0px -40% 0px" });
    // Het formulier wordt na verzenden opnieuw opgebouwd: element periodiek opnieuw koppelen.
    const koppel = () => {
      const el = document.getElementById(AANVRAAG_ID);
      if (el === huidig) return;
      if (huidig) io.unobserve(huidig);
      huidig = el;
      if (el) io.observe(el); else setInBeeld(false);
    };
    koppel();
    const t = window.setInterval(koppel, 1000);
    return () => { window.clearInterval(t); io.disconnect(); };
  }, [actief]);
  return inBeeld;
}

export function StickyMobileCTA() {
  const location = useLocation();
  const path = location.pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
  const aanvraagPagina = AANVRAAG_PATHS.includes(path);
  const formulierInBeeld = useAanvraagInBeeld(aanvraagPagina);
  const chatToegestaan = !zekerVerborgenOp(location.pathname);

  if (HIDDEN_PATHS.includes(path) || path.startsWith("/admin")) return null;

  const balk = "fixed bottom-0 left-0 right-0 z-40 flex h-[calc(56px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] text-sm font-semibold md:hidden";

  if (aanvraagPagina) {
    if (formulierInBeeld) return null;
    const maand = getPakket("maandelijks");
    return (
      <div className={balk}>
        <a
          href={`#${AANVRAAG_ID}`}
          onClick={(e) => scrollNaarAanvraag(e)}
          className="flex flex-1 items-center justify-center gap-2 bg-accent text-center text-accent-foreground"
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          Afsluiten vanaf €{maand.prijs}/mnd
        </a>
        <a
          href={SITE_CONFIG.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat met ons via WhatsApp"
          className="flex w-14 shrink-0 items-center justify-center border-l border-background/20 bg-foreground text-background"
        >
          <WhatsAppIcoon />
        </a>
        {chatToegestaan && (
          <button
            type="button"
            onClick={() => zetZekerOpen(true)}
            aria-label="Open chat met Zeker, de digitale assistent"
            className="flex w-14 shrink-0 items-center justify-center border-l border-background/20 bg-primary text-primary-foreground"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${balk} text-primary-foreground`}>
      <a href="tel:0204573077" className="flex flex-1 items-center justify-center gap-2 bg-foreground text-center text-background">
        <Phone className="h-4 w-4" />
        020 - 457 3077
      </a>
      {chatToegestaan && <button
        type="button"
        onClick={() => zetZekerOpen(true)}
        aria-label="Open chat met Zeker, de digitale assistent"
        className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 border-x border-background/20 bg-primary text-xs text-primary-foreground"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Chat
      </button>}
      <Link to="/contact" onClick={openTerugbelKlik} className="flex flex-1 items-center justify-center bg-accent text-center text-accent-foreground">
        Vrijblijvend gesprek →
      </Link>
    </div>
  );
}
