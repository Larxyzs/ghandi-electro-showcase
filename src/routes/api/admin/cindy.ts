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
        let refs: string[] = [];
        try {
          const body = (await request.json()) as {
            query?: string;
            force?: boolean;
            refs?: unknown;
          };
          query = String(body.query ?? "").trim();
          force = Boolean(body.force);
          refs = Array.isArray(body.refs)
            ? body.refs
                .map((r) => String(r ?? "").trim())
                .filter((r) => r.length >= 2)
                .slice(0, 40)
            : [];
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (refs.length === 0 && query.length < 2) return new Response("Bad request", { status: 400 });

        const { researchProduct } = await import("@/lib/cindy.server");
        const encoder = new TextEncoder();

        const humanError = (message: string) =>
          message === "SEARCH_NOT_CONFIGURED"
            ? "La recherche web n'est pas configurée (SearXNG)."
            : message === "AI_NOT_CONFIGURED"
              ? "L'assistant IA n'est pas configuré."
              : message === "AI_RATE_LIMITED"
                ? "Trop de requêtes, réessayez dans un instant."
                : message === "AI_CREDITS"
                  ? "Crédits IA épuisés."
                  : `Recherche impossible (${message}).`;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: CindyEvent) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };
            try {
              if (refs.length > 1) {
                // ---- Bulk mode: one product at a time, cache-first, no repeats ----
                const seen = new Set<string>();
                const unique = refs.filter((ref) => {
                  const key = ref.toLowerCase().replace(/[^a-z0-9]/g, "");
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });

                unique.forEach((ref, index) => {
                  send({ type: "bulk_item", item: { index, ref, status: "pending" } });
                });

                let ok = 0;
                let failed = 0;

                for (let index = 0; index < unique.length; index += 1) {
                  const ref = unique[index]!;
                  send({ type: "bulk_item", item: { index, ref, status: "running" } });
                  let cached = false;
                  let product = null as Awaited<ReturnType<typeof researchProduct>>;
                  let failure: string | null = null;
                  try {
                    product = await researchProduct(
                      ref,
                      (event) => {
                        if (event.type === "result") {
                          cached = Boolean(event.cached);
                          return;
                        }
                        if (event.type === "activity") {
                          send({ ...event, id: `b${index}-${event.id}` });
                          return;
                        }
                        if (event.type === "error") failure = event.message;
                      },
                      { force },
                    );
                  } catch (error) {
                    failure = humanError(error instanceof Error ? error.message : "RESEARCH_FAILED");
                  }

                  if (product) {
                    ok += 1;
                    send({
                      type: "bulk_item",
                      item: { index, ref, status: "done", cached, product },
                    });
                  } else {
                    failed += 1;
                    send({
                      type: "bulk_item",
                      item: {
                        index,
                        ref,
                        status: "error",
                        message: failure ?? "Aucune fiche produit trouvée.",
                      },
                    });
                  }
                }

                send({ type: "bulk_summary", total: unique.length, ok, failed });
              } else {
                await researchProduct(refs[0] ?? query, send, { force });
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : "RESEARCH_FAILED";
              send({ type: "error", message: humanError(message) });
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
