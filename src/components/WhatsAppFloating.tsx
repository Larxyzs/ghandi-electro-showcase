import { WHATSAPP_GENERAL_MESSAGE, whatsappLink } from "@/lib/company";

export function WhatsAppFloating() {
  return (
    <a
      href={whatsappLink(WHATSAPP_GENERAL_MESSAGE)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous contacter sur WhatsApp"
      className="fixed bottom-6 end-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[oklch(0.72_0.17_147)] text-[oklch(1_0_0)] shadow-[0_12px_30px_-8px_oklch(0.72_0.17_147_/_0.6)] transition-transform hover:scale-110"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M16.03 4C9.4 4 4.03 9.37 4.03 16c0 2.11.55 4.09 1.5 5.81L4 28l6.35-1.5A11.94 11.94 0 0 0 16.03 28c6.63 0 12-5.37 12-12s-5.37-12-12-12Zm0 21.8c-1.83 0-3.55-.5-5.03-1.36l-.36-.21-3.77.89.9-3.67-.23-.38A9.75 9.75 0 0 1 6.23 16c0-5.4 4.4-9.8 9.8-9.8s9.8 4.4 9.8 9.8-4.4 9.8-9.8 9.8Zm5.5-7.3c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.44-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.15-.15.33-.38.5-.58.13-.15.2-.28.3-.47.1-.2.05-.37-.03-.52-.07-.15-.65-1.6-.9-2.18-.23-.55-.47-.48-.65-.48h-.55c-.2 0-.5.07-.76.37-.26.3-1 1-1 2.42s1.03 2.8 1.18 3c.15.2 2.03 3.22 4.95 4.4 2.42.98 2.9.8 3.43.75.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.25.17-1.37-.07-.12-.27-.2-.57-.35Z" />
      </svg>
    </a>
  );
}
