import { useState, useEffect } from "react";
import { Phone, MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function StickyContactBar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2"
        >
          <a
            href="tel:0232010502"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-medium"
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">023 - 201 0502</span>
          </a>
          <a
            href="https://wa.me/31612345678"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-accent text-accent-foreground px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-medium"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">WhatsApp</span>
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
