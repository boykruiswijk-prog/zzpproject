import { trackWhatsApp } from "@/lib/tracking";

export function WhatsAppFloatingButton() {
  return (
    <a
      href="https://wa.me/31652064589"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Stuur ons een WhatsApp-bericht"
      onClick={() => trackWhatsApp()}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-transform duration-200 hover:scale-105"
      style={{
        backgroundColor: "#25D366",
        width: "48px",
        height: "48px",
      }}
    >
      <span
        className="hidden md:block"
        style={{ position: "absolute", inset: 0, borderRadius: "9999px", backgroundColor: "#25D366" }}
        aria-hidden
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="relative h-6 w-6 md:h-7 md:w-7"
        fill="#fff"
        aria-hidden="true"
      >
        <path d="M19.11 17.39c-.27-.13-1.58-.78-1.83-.87-.24-.09-.42-.13-.6.13-.18.27-.69.87-.85 1.05-.16.18-.31.2-.58.07-.27-.13-1.13-.42-2.15-1.33-.79-.71-1.33-1.58-1.49-1.85-.16-.27-.02-.42.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.47-.07-.13-.6-1.45-.83-1.98-.22-.52-.44-.45-.6-.46-.16-.01-.34-.01-.52-.01-.18 0-.47.07-.71.34-.24.27-.93.91-.93 2.22 0 1.31.96 2.57 1.09 2.75.13.18 1.88 2.87 4.55 4.02.64.27 1.13.43 1.52.55.64.2 1.22.17 1.68.1.51-.07 1.58-.65 1.81-1.27.22-.62.22-1.16.16-1.27-.07-.11-.24-.18-.51-.31zM16.03 5.33C9.93 5.33 4.97 10.29 4.97 16.39c0 2.15.62 4.16 1.69 5.85L4.8 27.18l5.1-1.79a11 11 0 005.93 1.72h.01c6.1 0 11.06-4.96 11.07-11.06 0-2.96-1.15-5.74-3.24-7.83a11 11 0 00-7.84-3.25zm0 20.31h-.01a9.27 9.27 0 01-4.72-1.29l-.34-.2-3.52 1.23 1.24-3.44-.22-.36a9.26 9.26 0 01-1.42-4.94c0-5.11 4.16-9.27 9.28-9.27 2.48 0 4.81.97 6.56 2.72a9.25 9.25 0 012.72 6.56c-.01 5.11-4.17 9.27-9.28 9.27z" />
      </svg>
    </a>
  );
}
