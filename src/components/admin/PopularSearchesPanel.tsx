import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import type { PopularSearch } from "@/lib/catalog-types";

export function PopularSearchesPanel({
  terms,
  actions,
}: {
  terms: PopularSearch[];
  actions: {
    add: (term: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    move: (id: string, direction: "up" | "down") => Promise<void>;
  };
}) {
  const [term, setTerm] = useState("");

  return (
    <section className="max-w-2xl space-y-5 rounded-3xl border border-border bg-card p-7">
      <div>
        <h2 className="text-lg font-semibold">Recherches populaires</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Ces termes apparaissent sous la barre de recherche du site quand elle est vide.
        </p>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!term.trim()) return;
          await actions.add(term.trim());
          setTerm("");
        }}
        className="flex flex-wrap gap-3"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="ex. Réfrigérateur side by side"
          className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
        />
        <button
          type="submit"
          disabled={!term.trim()}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </form>

      {terms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-foreground/60">
          Aucun terme pour le moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {terms.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-3 rounded-2xl border border-border p-3.5"
            >
              <Search className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.term}</span>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => actions.move(row.id, "up")}
                aria-label="Monter"
                className="rounded-full px-2 py-1 text-xs font-semibold text-foreground/50 hover:text-brand disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === terms.length - 1}
                onClick={() => actions.move(row.id, "down")}
                aria-label="Descendre"
                className="rounded-full px-2 py-1 text-xs font-semibold text-foreground/50 hover:text-brand disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => actions.remove(row.id)}
                aria-label="Supprimer le terme"
                className="rounded-full p-2 text-foreground/50 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
