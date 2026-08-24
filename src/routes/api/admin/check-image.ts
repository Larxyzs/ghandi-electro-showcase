import { createFileRoute } from "@tanstack/react-router";

type Verdict = {
  ok: boolean;
  verdict: "good" | "warn" | "bad";
  summary: string;
  issues: string[];
  advice: string;
};

const SYSTEM = `Tu es Cindy, assistante qualité images pour un site d'électroménager (Ghandi Home Electro).
On te donne une image destinée à une fiche produit ou un dossier de catalogue.
Vérifie: le sujet est-il bien un produit d'électroménager visible et net ? le cadrage/l'échelle sont-ils bons (produit centré, pas rogné, pas minuscule, pas trop zoomé) ? le fond est-il propre ? y a-t-il des filigranes, textes parasites, logos de revendeurs, collages ou basse résolution ?
Réponds STRICTEMENT en JSON: {"verdict":"good"|"warn"|"bad","summary":"une phrase courte en français","issues":["problème court", ...],"advice":"conseil court en français"}
Si tout va bien: verdict "good", issues vide, advice "".`;

export const Route = createFileRoute("/api/admin/check-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { currentAdmin } = await import("@/lib/admin.server");
        if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });

        let source = "";
        let meta = "";
        try {
          const body = (await request.json()) as {
            imageData?: string;
            imageUrl?: string;
            width?: number;
            height?: number;
          };
          source = String(body.imageData || body.imageUrl || "");
          if (body.width && body.height) {
            meta = `Dimensions réelles: ${body.width}x${body.height}px (ratio ${(body.width / body.height).toFixed(2)}).`;
          }
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!/^(https?:\/\/|data:image\/)/.test(source)) {
          return new Response("Bad request", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("AI not configured", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: [
                  { type: "text", text: `Analyse cette image. ${meta}` },
                  { type: "image_url", image_url: { url: source } },
                ],
              },
            ],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          const message =
            upstream.status === 429
              ? "Trop de requêtes, réessayez dans un instant."
              : upstream.status === 402
                ? "Crédits IA épuisés."
                : `Vérification impossible (${upstream.status}). ${text.slice(0, 120)}`;
          return new Response(JSON.stringify({ error: message }), {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const json = (await upstream.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = json.choices?.[0]?.message?.content ?? "";
        const match = /\{[\s\S]*\}/.exec(raw);
        let parsed: Partial<Verdict> = {};
        try {
          parsed = match ? (JSON.parse(match[0]) as Partial<Verdict>) : {};
        } catch {
          parsed = {};
        }
        const verdict: Verdict["verdict"] =
          parsed.verdict === "bad" ? "bad" : parsed.verdict === "warn" ? "warn" : "good";
        const result: Verdict = {
          ok: verdict === "good",
          verdict,
          summary: String(parsed.summary ?? (verdict === "good" ? "Image correcte." : "Image à revoir.")),
          issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 5) : [],
          advice: String(parsed.advice ?? ""),
        };
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
