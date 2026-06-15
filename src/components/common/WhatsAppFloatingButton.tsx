import { trackWhatsApp } from "@/lib/tracking";

export function WhatsAppFloatingButton() {
  return (
    <a
      href="https://wa.me/31652064589"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat met ons via WhatsApp"
      onClick={() => trackWhatsApp()}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-all hover:scale-110 hover:shadow-xl md:h-16 md:w-16"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="h-7 w-7 md:h-8 md:w-8 fill-white"
        aria-hidden="true"
      >
        <path d="M16.004 0h-.008C7.174 0 .002 7.174.002 16c0 3.5 1.13 6.744 3.05 9.376L1.05 31.36l6.196-1.98a15.91 15.91 0 0 0 8.758 2.62C24.83 32 32 24.826 32 16S24.83 0 16.004 0zm9.31 22.59c-.386 1.09-1.916 1.992-3.137 2.252-.836.178-1.928.32-5.604-1.204-4.7-1.946-7.726-6.722-7.962-7.032-.226-.31-1.9-2.526-1.9-4.82s1.168-3.412 1.638-3.892c.386-.394.84-.574 1.124-.574.34 0 .638.005.898.018.288.014.722-.11 1.13.866.42 1.004 1.426 3.464 1.55 3.714.124.252.206.546.04.876-.166.33-.248.534-.494.822-.246.288-.518.642-.74.864-.246.246-.502.512-.218 1.006.286.494 1.262 2.078 2.704 3.366 1.858 1.658 3.418 2.18 3.92 2.43.502.246.794.206 1.082-.124.288-.33 1.246-1.452 1.578-1.95.33-.494.66-.412 1.112-.246.452.166 2.87 1.354 3.366 1.6.494.246.824.372.948.578.124.206.124 1.18-.262 2.272z" />
      </svg>
    </a>
  );
}
