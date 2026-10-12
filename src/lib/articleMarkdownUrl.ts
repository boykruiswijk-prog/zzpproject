import { defaultUrlTransform } from "react-markdown";

/** Behoud telefoonlinks, zonder de bestaande URL-beveiliging te verruimen. */
export function articleMarkdownUrl(value: string, key: string): string {
  if (key === "href" && /^tel:/i.test(value)) return value;
  return defaultUrlTransform(value);
}