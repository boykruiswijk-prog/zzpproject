export function PensioenIllustratie() {
  return <svg viewBox="0 0 720 400" role="img" aria-label="Een beschermend schild verbonden met een pensioenpot aan de horizon" className="w-full text-accent">
    <path d="M30 320H690M30 240H690M30 160H690M30 80H690" stroke="currentColor" opacity=".1" />
    <path d="M75 303C195 303 220 238 325 238S437 126 600 85" fill="none" stroke="currentColor" strokeWidth="4" />
    <path d="M112 173 170 195V247C170 288 143 311 112 325 81 311 54 288 54 247V195Z" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="3" />
    <path d="m88 247 17 17 31-38" fill="none" stroke="currentColor" strokeWidth="4" />
    <g className="text-foreground" fill="hsl(var(--secondary))" stroke="currentColor" strokeWidth="2">
      <path d="M469 151H639V277C639 301 469 301 469 277Z"/><ellipse cx="554" cy="151" rx="85" ry="22"/><path d="M482 192C521 208 587 208 626 192M482 238C521 254 587 254 626 238" fill="none" />
    </g>
    <path d="M530 103V50M555 101V25M580 103V50" stroke="currentColor" strokeWidth="3" />
    <circle cx="325" cy="238" r="7" fill="currentColor"/>
    <text x="40" y="374" fill="currentColor" fontSize="16" fontFamily="inherit">JE BEDRIJF BESCHERMD</text><text x="460" y="374" fill="currentColor" fontSize="16" fontFamily="inherit">JOUW POT VOOR LATER</text>
  </svg>;
}
