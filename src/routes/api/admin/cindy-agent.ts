import { createFileRoute } from "@tanstack/react-router";
import type { CindyAgentEvent, CindyChatMessage } from "@/lib/cindy-types";

export const Route = createFileRoute("/api/admin/cindy-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { currentAdmin } = await import("@/lib/admin.server");
        const admin = await currentAdmin();
        if (!admin) return new Response("Unauthorized", { status: 401 });

        let messages: CindyChatMessage[] = [];
        try {
          const body = (await request.json()) as { messages?: unknown };
          messages = (Array.isArray(body.messages) ? body.messages : [])
            .map((raw) => {
              const item = raw as { role?: unknown; content?: unknown };
              const role = item.role === "assistant" ? "assistant" : "user";
              return { role, content: String(item.content ?? "").slice(0, 8000) } as CindyChatMessage;
            })
            .filter((message) => message.content.trim().length > 0)
            .slice(-24);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (messages.length === 0) return new Response("Bad request", { status: 400 });

        const { runCindyAgent } = await import("@/lib/cindy-agent.server");
        const encoder = new TextEncoder();

        const humanError = (message: string) =>
          message === "SEARCH_NOT_CONFIGURED"
            ? "La recherche web n'est pas configurée (clé Tavily manquante)."
            : message === "AI_NOT_CONFIGURED"
              ? "L'assistant IA n'est pas configuré."
              : message === "AI_RATE_LIMITED"
                ? "L'IA est saturée : j'ai patienté plusieurs fois sans succès. Relancez dans une minute, je reprends là où j'en étais."

                : message === "AI_CREDITS"
                  ? "Crédits IA épuisés."
                  : `Une erreur est survenue (${message}).`;

        // The admin's "Stop" button aborts the request; the agent stops its
        // retries and long page crawls instead of finishing them.
        const stopper = new AbortController();
        request.signal.addEventListener("abort", () => stopper.abort());

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let closed = false;
            const send = (event: CindyAgentEvent) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              } catch {
                closed = true;
              }
            };
            try {
              await runCindyAgent({ messages, emit: send, signal: stopper.signal });
            } catch (error) {
              const message = error instanceof Error ? error.message : "UNKNOWN";
              if (!stopper.signal.aborted) {
                send({ type: "error", message: humanError(message) });
                send({ type: "done" });
              }
            } finally {
              closed = true;
              try {
                controller.close();
              } catch {
                /* already closed by the aborted client */
              }
            }
          },
          cancel() {
            stopper.abort();
          },
        });


        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
