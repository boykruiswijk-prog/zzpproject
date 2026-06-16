import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, MessageCircle, Mail, ArrowRight } from "lucide-react";

type CTA = { label: string; href: string; variant: "primary" | "secondary"; icon?: React.ComponentType<{ className?: string }> };
type PopupConfig = { title: string; body: string; ctas: CTA[]; badge?: string };

const SESSION_PREFIX = "zp_exit_intent_";

// Path key → popup config. Matches normalized path (stripped of lang prefix).
const POPUP_CONFIGS: Record<string, PopupConfig> = {
  "/verzekeringen": {
    badge: "Hulp nodig?",
    title: "Welk product past bij jou?",
    body: "We hebben verzekeringen voor BAV, AOV, pensioen en zorg. Niet zeker welke je nodig hebt? Vraag advies.",
    ctas: [
      { label: "Vraag advies", href: "/contact", variant: "primary", icon: ArrowRight },
      { label: "Sluit", href: "#close", variant: "secondary" },
    ],
  },
  "/bav-avb": {
    badge: "Nog even sparren?",
    title: "Nog niet zeker welke optie past?",
    body: "Onze specialisten helpen je in 5 minuten de juiste keuze maken. Bel ons, stuur een WhatsApp, of laat je gegevens achter.",
    ctas: [
      { label: "Bel 020 - 457 3077", href: "tel:0204573077", variant: "primary", icon: Phone },
      { label: "WhatsApp", href: "https://wa.me/31652064589", variant: "primary", icon: MessageCircle },
      { label: "Niet nu", href: "#close", variant: "secondary" },
    ],
  },
  "/aov": {
    badge: "Vragen?",
    title: "Vragen over arbeidsongeschiktheid?",
    body: "Een AOV is een complexe keuze. Onze partner SharePeople helpt je gratis een passende oplossing vinden.",
    ctas: [
      { label: "Plan een gesprek", href: "/contact", variant: "primary", icon: ArrowRight },
      { label: "Meer informatie", href: "/aov", variant: "secondary" },
      { label: "Sluit", href: "#close", variant: "secondary" },
    ],
  },
  "/pensioen": {
    badge: "Pensioenadvies",
    title: "Pensioenkeuzes voor zelfstandigen",
    body: "Je pensioen is belangrijk. Wij leggen graag in een gratis gesprek je opties uit.",
    ctas: [
      { label: "Neem contact op", href: "/contact", variant: "primary", icon: ArrowRight },
      { label: "Sluit", href: "#close", variant: "secondary" },
    ],
  },
};

const ALLOWED_PATHS = new Set(Object.keys(POPUP_CONFIGS));

function normalizePath(pathname: string): string {
  const stripped = pathname.replace(/^\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
  return stripped.replace(/\/+$/, "") || "/";
}

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const location = useLocation();
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = normalizePath(location.pathname);
    if (!ALLOWED_PATHS.has(path)) return;

    const sessionKey = `${SESSION_PREFIX}${path}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const loadedAt = Date.now();
    const cfg = POPUP_CONFIGS[path];

    const recordInteraction = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener("click", recordInteraction);
    window.addEventListener("keydown", recordInteraction);

    const trigger = () => {
      if (Date.now() - loadedAt < 8_000) return;
      if (Date.now() - lastInteractionRef.current < 3_000) return;
      sessionStorage.setItem(sessionKey, "1");
      setConfig(cfg);
      setOpen(true);
      cleanup();
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget === null && e.clientY <= 10) trigger();
    };

    const onPopState = (e: PopStateEvent) => {
      if (Date.now() - loadedAt < 8_000) return;
      if (sessionStorage.getItem(sessionKey)) return;
      // Show popup, push state back to intercept
      sessionStorage.setItem(sessionKey, "1");
      setConfig(cfg);
      setOpen(true);
      window.history.pushState(null, "", window.location.href);
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("click", recordInteraction);
      window.removeEventListener("keydown", recordInteraction);
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("popstate", onPopState);
    // Push a state so mobile back can be intercepted
    window.history.pushState(null, "", window.location.href);

    return cleanup;
  }, [location.pathname]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && config && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.3 }}
            className="relative w-[90%] max-w-[480px] rounded-2xl bg-background p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Sluiten"
            >
              <X className="h-5 w-5" />
            </button>

            {config.badge && (
              <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                {config.badge}
              </span>
            )}

            <h3 className="mt-4 text-2xl font-bold leading-tight text-foreground">
              {config.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{config.body}</p>

            <div className="mt-6 flex flex-col gap-2">
              {config.ctas.map((cta) => {
                if (cta.href === "#close") {
                  return (
                    <button
                      key={cta.label}
                      type="button"
                      onClick={close}
                      className="block w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline py-2"
                    >
                      {cta.label}
                    </button>
                  );
                }
                const Icon = cta.icon;
                const isExternal = cta.href.startsWith("http") || cta.href.startsWith("tel:") || cta.href.startsWith("mailto:");
                const base =
                  cta.variant === "primary"
                    ? "bg-accent text-accent-foreground hover:opacity-90"
                    : "bg-muted text-foreground hover:bg-muted/70";
                return (
                  <a
                    key={cta.label}
                    href={cta.href}
                    {...(isExternal && cta.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    onClick={close}
                    className={`flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3 text-sm font-semibold transition ${base}`}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {cta.label}
                  </a>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
