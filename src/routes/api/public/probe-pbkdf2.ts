import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/probe-pbkdf2")({
  server: {
    handlers: {
      GET: async () => {
        const results: Record<string, string> = {};
        for (const iterations of [1000, 100_000, 100_001, 120_000]) {
          try {
            const key = await crypto.subtle.importKey(
              "raw",
              new TextEncoder().encode("test"),
              "PBKDF2",
              false,
              ["deriveBits"],
            );
            await crypto.subtle.deriveBits(
              { name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(16), iterations },
              key,
              256,
            );
            results[String(iterations)] = "ok";
          } catch (error) {
            results[String(iterations)] = error instanceof Error ? error.message : "err";
          }
        }
        return Response.json(results);
      },
    },
  },
});
