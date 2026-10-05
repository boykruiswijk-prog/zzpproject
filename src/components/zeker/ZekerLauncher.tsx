import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAanvraagInBeeld } from "@/lib/useAanvraagInBeeld";
import { COOKIE_KEUZE_EVENT, cookieKeuzeGemaakt, useZekerOpen, zekerVerborgenOp, zetZekerOpen } from "./zekerStore";

const ZekerChatWindow = lazy(() => import("./ZekerChatWindow"));

/** Desktopknop (boven de WhatsApp-knop, vaste tussenruimte) + lazy chatvenster. */
export function ZekerLauncher() {
  const { pathname } = useLocation();
  const open = useZekerOpen();
  const [cookieKlaar, setCookieKlaar] = useState(false);
  const [geladen, setGeladen] = useState(false);
  const formulierInBeeld = useAanvraagInBeeld();

  useEffect(() => {
    setCookieKlaar(cookieKeuzeGemaakt());
    const f = () => setCookieKlaar(true);
    window.addEventListener(COOKIE_KEUZE_EVENT, f);
    return () => window.removeEventListener(COOKIE_KEUZE_EVENT, f);
  }, []);
  useEffect(() => { if (open) setGeladen(true); }, [open]);

  if (zekerVerborgenOp(pathname)) return null;

  return (
    <>
      {cookieKlaar && !open && !formulierInBeeld && (
        <button
          type="button"
          onClick={() => zetZekerOpen(true)}
          aria-label="Open chat met Zeker, de digitale assistent"
          className="fixed bottom-[92px] right-4 z-50 hidden h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 md:flex"
        >
          <MessageCircle className="h-7 w-7" aria-hidden="true" />
        </button>
      )}
      {geladen && (
        <Suspense fallback={null}>
          <ZekerChatWindow open={open} onClose={() => zetZekerOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
