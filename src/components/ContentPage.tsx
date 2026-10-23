import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";

/** Standard content page: breadcrumb + white panel on the grey page. */
export function ContentPage({ title, crumbs = [], children, wide }: { title: string; crumbs?: { label: string; to: string }[]; children: ReactNode; wide?: boolean }) {
  return (
    <SiteLayout>
      <section className={wide ? "shell py-4" : "shell max-w-4xl py-4"}>
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-text-2">
          <Link to="/" className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Accueil</Link>
          {crumbs.map((c) => (
            <span key={c.to} className="inline-flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5" /><a href={c.to}>{c.label}</a></span>
          ))}
          <ChevronRight className="h-3.5 w-3.5" /> <span className="font-bold text-foreground">{title}</span>
        </nav>
        {children}
      </section>
    </SiteLayout>
  );
}

/** Very small, safe text formatter: "## " titles, "- " lists, "![](url)" images, blank-line paragraphs. */
export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-text-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.every((l) => l.startsWith("- "))) return <ul key={i} className="list-disc space-y-1 ps-5">{lines.map((l, k) => <li key={k}>{l.slice(2)}</li>)}</ul>;
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-lg font-bold text-foreground">{b.slice(3)}</h2>;
        if (b.startsWith("### ")) return <h3 key={i} className="pt-1 font-bold text-foreground">{b.slice(4)}</h3>;
        const img = b.match(/^!\[([^\]]*)\]\((https:\/\/[^)\s]+)\)$/);
        if (img) return <img key={i} src={img[2]} alt={img[1]} loading="lazy" className="w-full rounded-md object-contain" />;
        return <p key={i} className="whitespace-pre-line">{b}</p>;
      })}
    </div>
  );
}

export function pageMeta(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
