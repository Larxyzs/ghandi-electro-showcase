import { useState } from "react";
import { cn } from "@/lib/utils";

export function SeoText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel mt-6 px-5 py-4 text-sm text-text-2">
      <div className={cn("space-y-2 whitespace-pre-line", !open && "line-clamp-3")}>{text}</div>
      <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-bold text-foreground underline">{open ? "Réduire" : "Lire la suite"}</button>
    </div>
  );
}
