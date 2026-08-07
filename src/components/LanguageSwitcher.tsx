import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES, useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav.lang")}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-brand hover:text-brand"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current?.label}</span>
      </button>
      {open && (
        <div className="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-brand-soft hover:text-brand-deep"
            >
              <span dir={l.dir}>{l.label}</span>
              {l.code === lang && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}