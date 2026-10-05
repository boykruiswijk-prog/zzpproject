import { useState, useEffect } from "react";
import { Phone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trackPhone } from "@/lib/tracking";
import { useAanvraagInBeeld } from "@/lib/useAanvraagInBeeld";

export function StickyContactBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const formulierInBeeld = useAanvraagInBeeld();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && !formulierInBeeld && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-24 z-50 hidden items-center gap-2 lg:flex"
        >
          <a
            href="tel:0204573077"
            onClick={() => trackPhone()}
            className="flex items-center gap-2 whitespace-nowrap bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-medium"
          >
            <Phone className="h-4 w-4" />
            <span>020 - 457 3077</span>
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-card border border-border shadow text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sluiten"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
