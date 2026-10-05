import { useEffect, useState } from "react";
import { AANVRAAG_ID } from "@/lib/scrollNaarAanvraag";

/** True zolang het aanvraagformulier (#combinatiepolis) deels in beeld is. Zwevende knoppen verbergen zich dan. */
export function useAanvraagInBeeld(actief = true, rootMargin = "0px") {
  const [inBeeld, setInBeeld] = useState(false);
  useEffect(() => {
    if (!actief || typeof IntersectionObserver === "undefined") { setInBeeld(false); return; }
    let huidig: Element | null = null;
    const io = new IntersectionObserver((entries) => setInBeeld(entries.some((e) => e.isIntersecting)), { threshold: 0, rootMargin });
    // Het formulier wordt na verzenden of navigatie opnieuw opgebouwd: element periodiek opnieuw koppelen.
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
  }, [actief, rootMargin]);
  return inBeeld;
}
