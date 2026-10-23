import { Link } from "@tanstack/react-router";

export function GuideCard({ guide }: { guide: { slug: string; title: string; summary: string; cover_url: string; published_at: string } }) {
  return (
    <Link to="/conseils/$slug" params={{ slug: guide.slug }} className="panel overflow-hidden hover:border-input hover:shadow-[var(--shadow-hover)]">
      {guide.cover_url && <img src={guide.cover_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
      <div className="p-4">
        <p className="text-xs text-text-3">{new Date(guide.published_at).toLocaleDateString("fr-MA")}</p>
        <h2 className="mt-1 font-bold">{guide.title}</h2>
        {guide.summary && <p className="mt-1 line-clamp-3 text-sm text-text-2">{guide.summary}</p>}
      </div>
    </Link>
  );
}
