import { useLocation, Link } from "react-router-dom";
import { MessageCircle, Phone } from "lucide-react";
import { zetZekerOpen } from "@/components/zeker/zekerStore";
import { trackPhone } from "@/lib/tracking";

const HIDDEN_PATHS = ["/contact", "/verzekeringen"];

export function StickyMobileCTA() {
  const location = useLocation();
  const path = location.pathname.replace(/\/(nl|en|de|fr)(?=\/|$)/, "") || "/";

  // Hide on BAV wizard pages (homepage + verzekeringen), contact page, and admin
  if (path === "/" || HIDDEN_PATHS.includes(path) || path.startsWith("/admin")) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(56px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] font-semibold text-primary-foreground md:hidden"
    >
      <a
        href="tel:0204573077"
        onClick={() => trackPhone()}
        className="flex flex-1 items-center justify-center gap-2 bg-foreground text-center text-background"
      >
        <Phone className="h-4 w-4" />
        020 - 457 3077
      </a>
      <button
        type="button"
        onClick={() => zetZekerOpen(true)}
        aria-label="Open chat met Zeker, de digitale assistent"
        className="flex w-[72px] shrink-0 flex-col items-center justify-center gap-0.5 border-x border-background/20 bg-primary text-xs text-primary-foreground"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Chat
      </button>
      <Link
        to="/contact"
        className="flex flex-1 items-center justify-center bg-accent text-center text-accent-foreground"
      >
        Gratis gesprek →
      </Link>
    </div>
  );
}
