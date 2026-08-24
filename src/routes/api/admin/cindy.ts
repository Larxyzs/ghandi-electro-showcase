import { createFileRoute } from "@tanstack/react-router";
import type { CindyEvent } from "@/lib/cindy-types";

export const Route = createFileRoute("/api/admin/cindy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { currentAdmin } = await import("@/lib/admin.server");
        const admin = await currentAdmin();
        if (!admin) return new Response("Unauthorized", { status: 401 });

        let query = "";
        let force = false;
        try {
          const body = (await request.json()) as { query?: string; force?: boolean };
          query = String(body.query ?? "").trim();
          force = Boolean(body.force);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (query.length < 2) return new Response("Bad request", { status: 400 });

        const { researchProduct } = await import("@/lib/cindy.server");
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: CindyEvent) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            try {
              await researchProduct(query, send, { force });
            } catch (error) {
              const message = error instanceof Error ? error.message : "RESEARCH_FAILED";
              send({
                type: "error",
                message:
                  message === "SEARCH_NOT_CONFIGURED"
                    ? "La recherche web n'est pas configurée (SearXNG)."
                    : message === "AI_NOT_CONFIGURED"
                      ? "L'assistant IA n'est pas configuré."
                      : message === "AI_RATE_LIMITED"
                        ? "Trop de requêtes, réessayez dans un instant."
                        : message === "AI_CREDITS"
                          ? "Crédits IA épuisés."
                          : `Recherche impossible (${message}).`,
              });
            } finally {
              send({ type: "done" });
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-store",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
