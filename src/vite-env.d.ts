/// <reference types="vite/client" />

// React 18 kent het camelCase `fetchPriority` nog niet en waarschuwt daarover.
// We gebruiken daarom het HTML-attribuut in kleine letters op afbeeldingen.
declare module "react" {
  interface ImgHTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
