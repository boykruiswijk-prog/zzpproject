import logoZp from "@/assets/logo-zp.webp";
import { cn } from "@/lib/utils";

/**
 * ZP Zaken-beeldmerk met ®-teken rechtsboven (Benelux-merk ZP ZAKEN (fig.), RE-260811-46010).
 * Alleen bij het logo gebruiken, nooit achter de woorden "ZP Zaken" in lopende tekst.
 * Het teken is ca. 35-40% van de logohoogte (via em ten opzichte van de logohoogte).
 */
export function MerkLogo({ hoogtePx, lazy = false, className }: { hoogtePx: number; lazy?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex items-start", className)} style={{ fontSize: Math.round(hoogtePx * 0.5) }}>
      <img
        decoding="async"
        loading={lazy ? "lazy" : undefined}
        {...(!lazy ? { fetchpriority: "high" } : {})}
        src={logoZp}
        alt="ZP Zaken logo"
        width={161}
        height={90}
        style={{ height: hoogtePx }}
        className="w-auto object-contain"
      />
      <span aria-hidden="true" className="-ml-[0.05em] font-normal leading-none text-foreground">®</span>
    </span>
  );
}
