import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { searchIndex, type SearchEntry } from "@/data/searchIndex";

export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const fuse = useMemo(
    () =>
      new Fuse(searchIndex, {
        keys: ["title", "keywords", "snippet"],
        threshold: 0.4,
        includeMatches: false,
        ignoreLocation: true,
      }),
    []
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results: SearchEntry[] = debounced
    ? fuse.search(debounced).slice(0, 8).map((r) => r.item)
    : [];

  const go = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Zoeken op de website"
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-foreground/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op de website..."
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {debounced && results.length === 0 && (
                <div className="px-4 py-8 text-sm text-muted-foreground">
                  Geen resultaten gevonden voor "{debounced}". Probeer een ander zoekwoord of bel ons via{" "}
                  <a href="tel:+31204573077" className="text-accent font-medium">
                    020 - 457 3077
                  </a>
                  .
                </div>
              )}

              {results.map((r) => (
                <button
                  key={r.path}
                  onClick={() => go(r.path)}
                  className="w-full text-left px-4 py-3 hover:bg-secondary transition-colors border-b border-border/50 last:border-b-0"
                >
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.snippet}</p>
                  <p className="text-xs text-accent mt-1">{r.path}</p>
                </button>
              ))}

              {!debounced && (
                <div className="px-4 py-6 text-xs text-muted-foreground">
                  Typ om te zoeken. Druk op <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">Esc</kbd> om te sluiten.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
