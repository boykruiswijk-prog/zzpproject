/// <reference types="vite/client" />

// React 18 kent het camelCase `fetchPriority` nog niet en waarschuwt daarover in
// de console. We gebruiken daarom het HTML-attribuut in kleine letters op
// afbeeldingen. Let op: dit moet een `declare global` + `namespace React` zijn,
// niet `declare module "react"` — dat laatste vervangt de hele React-typing.
declare global {
  namespace React {
    interface ImgHTMLAttributes<T> {
      fetchpriority?: "high" | "low" | "auto";
    }
  }
}

export {};
