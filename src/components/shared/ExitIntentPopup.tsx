import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const SESSION_KEY = "zp_exit_intent_shown";
const EXCLUDED_PATHS = ["/ad"];
// The BAV wizard lives on the homepage and /verzekeringen — exclude both
const EXCLUDED_WIZARD_PATHS = ["/", "/verzekeringen"];

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = location.pathname.replace(/\/(nl|en|de|fr)(?=\/|$)/, "") || "/";
    if (EXCLUDED_PATHS.includes(path)) return;
    if (EXCLUDED_WIZARD_PATHS.includes(path)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    let lastY = window.scrollY;
    let reached50 = false;

    const onScroll = () => {
      const y = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? y / docHeight : 0;
      if (!reached50 && pct >= 0.5) reached50 = true;

      if (reached50 && y < lastY - 5) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setOpen(true);
        window.removeEventListener("scroll", onScroll);
      }
      lastY = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  const close = () => setOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
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

            <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
              Gratis en vrijblijvend
            </span>

            <h3 className="mt-4 text-2xl font-bold leading-tight text-foreground">
              Wacht even — bereken in 30 seconden wat jij betaalt
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Veel zzp'ers betalen onnodig veel via hun platform. Wij rekenen het voor je uit.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                <div className="text-2xl font-bold text-foreground">€0</div>
                <div className="mt-1 text-xs text-muted-foreground">eigen risico bij ZP Zaken</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                <div className="text-2xl font-bold text-foreground">5.000+</div>
                <div className="mt-1 text-xs text-muted-foreground">tevreden zzp'ers</div>
              </div>
            </div>

            <Link
              to="/waarom-zp-zaken"
              onClick={close}
              className="mt-6 block w-full rounded-lg bg-accent px-6 py-3 text-center text-sm font-semibold text-accent-foreground shadow-sm transition hover:opacity-90"
            >
              Bereken mijn besparing →
            </Link>

            <button
              type="button"
              onClick={close}
              className="mt-3 block w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              Nee, ik betaal liever meer
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
