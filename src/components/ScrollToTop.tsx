import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (hash) {
      // Alleen het deel vóór "?" is het element-id (bijv. #combinatiepolis?pakket=jaarlijks-cyber).
      const id = decodeURIComponent(hash.replace("#", "").split("?")[0]);
      // Pagina's laden soms later in: blijf maximaal 4 seconden zoeken naar het element.
      let pogingen = 0;
      let timer = 0;
      const probeer = () => {
        const element = id ? document.getElementById(id) : null;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (++pogingen < 40) timer = window.setTimeout(probeer, 100);
      };
      timer = window.setTimeout(probeer, 100);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, key]);

  return null;
}
